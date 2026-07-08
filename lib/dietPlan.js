import fs from "fs";
import path from "path";

export const DIET_MODEL = "qwen/qwen3-32b";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_CAUTION = "Diet guidance is supportive and should not replace clinician advice, especially for diabetes, kidney disease, pregnancy, children, allergies, swallowing difficulty, or emergency symptoms.";

function sanitizeApiKey(value) {
    return String(value || "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, "")
        .trim();
}

function localEnvGroqKey() {
    try {
        const envPath = path.join(process.cwd(), ".env.local");
        const envText = fs.readFileSync(envPath, "utf8");
        const line = envText
            .split("\n")
            .find((entry) => entry.trim().startsWith("GROQ_API_KEY="));
        if (!line) {
            return "";
        }
        return sanitizeApiKey(line.slice(line.indexOf("=") + 1));
    }
    catch {
        return "";
    }
}

function groqApiKey() {
    return localEnvGroqKey() || sanitizeApiKey(process.env.GROQ_API_KEY);
}

function stripJsonFence(content) {
    return String(content || "")
        .trim()
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

function parseJson(content) {
    try {
        return JSON.parse(stripJsonFence(content));
    }
    catch {
        const text = String(content || "");
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(text.slice(start, end + 1));
            }
            catch {
                return null;
            }
        }
    }
    return null;
}

function toList(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
        return value
            .split(/\n|;/)
            .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
            .filter(Boolean);
    }
    return [];
}

function fallbackDietPlan({ intake, latestSession }) {
    const diagnosis = latestSession?.diagnosis || {};
    const concern = intake?.mainConcern || diagnosis.primaryDisease || "current health concern";
    const allergies = intake?.allergies || "None reported";
    return {
        summary: `Supportive diet plan for ${concern}. Keep meals simple, balanced, and easy to tolerate. Allergies: ${allergies}.`,
        meals: [
            { title: "Breakfast", detail: "Soft, light breakfast such as oats, poha, upma, or curd rice if tolerated. Add fruit only if suitable for your condition." },
            { title: "Lunch", detail: "Dal or lean protein with rice or roti and cooked vegetables. Keep oil and spice moderate." },
            { title: "Evening", detail: "Soup, fruit, buttermilk, or a small doctor-safe snack depending on appetite and symptoms." },
            { title: "Hydration", detail: "Sip water or oral fluids regularly. Avoid dehydration, especially with fever, vomiting, diarrhea, or low intake." }
        ],
        avoid: [
            "Very oily, spicy, or heavy meals while symptoms are active.",
            "Foods that conflict with reported allergies or clinician advice.",
            "Alcohol and self-prescribed supplements during illness unless approved by a clinician."
        ],
        caution: diagnosis.caution || DEFAULT_CAUTION
    };
}

function sourceText({ user, intake, latestSession, report }) {
    const diagnosis = latestSession?.diagnosis || {};
    return [
        `Patient name: ${user?.name || latestSession?.patientName || "Patient"}`,
        `Patient email: ${user?.email || latestSession?.patientEmail || "Not available"}`,
        "",
        "Patient intake:",
        latestSession?.preConsultationText || "No intake text available.",
        "",
        "Latest diagnosis:",
        JSON.stringify(diagnosis, null, 2),
        "",
        "Doctor-ready report:",
        report?.text || "No generated report text available."
    ].join("\n");
}

function normalizeDietPlan(raw, fallback) {
    const meals = Array.isArray(raw?.meals)
        ? raw.meals.map((meal) => ({
            title: String(meal?.title || "").trim(),
            detail: String(meal?.detail || "").trim()
        })).filter((meal) => meal.title && meal.detail).slice(0, 4)
        : [];
    return {
        summary: String(raw?.summary || fallback.summary).trim(),
        meals: meals.length === 4 ? meals : fallback.meals,
        avoid: toList(raw?.avoid).length ? toList(raw.avoid).slice(0, 5) : fallback.avoid,
        caution: String(raw?.caution || fallback.caution || DEFAULT_CAUTION).trim()
    };
}

function systemPrompt() {
    return `You are KAMAL Diet AI. Create a highly personal but conservative diet plan from the latest completed diagnosis and report.

Rules:
- Use only the supplied intake, diagnosis, and report.
- Diet is lower priority than medical diagnosis. If there is no completed diagnosis/report context, do not invent a plan.
- Keep the output stable and practical; do not vary wording unnecessarily.
- Do not prescribe medicines, supplements, restricted diets, fasting, or disease-specific medical nutrition therapy unless clearly supported.
- Respect allergies and red flags.
- Use common Indian meal options when suitable, but keep advice general enough for safety.
- Return JSON only, no markdown.

Return exactly:
{
  "summary": "short personalized diet summary",
  "meals": [
    { "title": "Breakfast", "detail": "specific guidance" },
    { "title": "Lunch", "detail": "specific guidance" },
    { "title": "Evening", "detail": "specific guidance" },
    { "title": "Hydration", "detail": "specific guidance" }
  ],
  "avoid": ["food or pattern to avoid"],
  "caution": "${DEFAULT_CAUTION}"
}`;
}

export async function buildDietPlan({ user, intake, latestSession, report }) {
    const fallback = fallbackDietPlan({ intake, latestSession });
    if (!latestSession || !report?.text) {
        return {
            plan: null,
            generatedBy: "none",
            warning: "Complete a diagnosis session and generate a patient report before creating a personal diet plan."
        };
    }

    const apiKey = groqApiKey();
    if (!apiKey) {
        return {
            plan: fallback,
            generatedBy: "fallback",
            warning: "Groq is not configured. Generated a stable fallback diet plan from saved diagnosis data."
        };
    }

    try {
        const response = await fetch(GROQ_CHAT_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: DIET_MODEL,
                temperature: 0,
                top_p: 0.2,
                max_tokens: 1200,
                messages: [
                    { role: "system", content: systemPrompt() },
                    { role: "user", content: sourceText({ user, intake, latestSession, report }) }
                ]
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                plan: fallback,
                generatedBy: "fallback",
                warning: data?.error?.message || "Diet model failed. Generated a stable fallback diet plan from saved diagnosis data."
            };
        }
        const parsed = parseJson(data?.choices?.[0]?.message?.content || "");
        return {
            plan: normalizeDietPlan(parsed || {}, fallback),
            generatedBy: DIET_MODEL,
            warning: ""
        };
    }
    catch (error) {
        console.error("Diet plan generation failed", error);
        return {
            plan: fallback,
            generatedBy: "fallback",
            warning: "Diet model failed. Generated a stable fallback diet plan from saved diagnosis data."
        };
    }
}
