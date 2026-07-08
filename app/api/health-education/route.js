import { NextResponse } from "next/server";
import { chatProviderConfig, fetchChatCompletion } from "@/lib/aiProviderClient";

export const runtime = "nodejs";

const GROQ_FALLBACK_MODEL = "qwen/qwen3-32b";

function stripJsonFence(content) {
    return String(content || "")
        .trim()
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

function parseJson(content) {
    const stripped = stripJsonFence(content);
    try {
        return JSON.parse(stripped);
    }
    catch {
        const start = stripped.indexOf("{");
        const end = stripped.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(stripped.slice(start, end + 1));
            }
            catch {
                return parsePartialJson(stripped);
            }
        }
    }
    return parsePartialJson(stripped);
}

function decodeJsonString(value) {
    try {
        return JSON.parse(`"${value}"`);
    }
    catch {
        return String(value || "").replace(/\\"/g, "\"").replace(/\\n/g, " ").trim();
    }
}

function partialStringField(content, field) {
    const match = String(content || "").match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
    return match ? decodeJsonString(match[1]) : "";
}

function partialArrayField(content, field) {
    const match = String(content || "").match(new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`));
    if (!match) {
        return [];
    }
    return [...match[1].matchAll(/"((?:\\.|[^"\\])*)"/g)].map((entry) => decodeJsonString(entry[1]));
}

function parsePartialJson(content) {
    const fallback = {
        summary: partialStringField(content, "summary"),
        keyPoints: partialArrayField(content, "keyPoints"),
        selfCare: partialArrayField(content, "selfCare"),
        askDoctor: partialArrayField(content, "askDoctor"),
        redFlags: partialArrayField(content, "redFlags"),
        disclaimer: partialStringField(content, "disclaimer")
    };
    const hasContent = fallback.summary ||
        fallback.keyPoints.length ||
        fallback.selfCare.length ||
        fallback.askDoctor.length ||
        fallback.redFlags.length ||
        fallback.disclaimer;
    return hasContent ? fallback : null;
}

function toList(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 6);
    }
    if (typeof value === "string" && value.trim()) {
        return value
            .split(/\n|;/)
            .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
            .filter(Boolean)
            .slice(0, 6);
    }
    return [];
}

function normalizeEducation(raw, question) {
    return {
        question,
        summary: String(raw?.summary || "I could not generate a clear answer. Please ask again with more detail.").trim(),
        keyPoints: toList(raw?.keyPoints),
        selfCare: toList(raw?.selfCare),
        askDoctor: toList(raw?.askDoctor),
        redFlags: toList(raw?.redFlags),
        disclaimer: String(raw?.disclaimer || "This is general health education, not a diagnosis or treatment plan. A qualified clinician should confirm medical decisions.").trim()
    };
}

function systemPrompt() {
    return `You are KAMAL Health Education AI.

Purpose:
- Answer general medical education questions clearly for patients.
- Explain common conditions, symptoms, prevention, tests, treatments, and when to seek care.
- Do not diagnose the user, do not prescribe restricted medicines, and do not replace a doctor.

Safety:
- If symptoms sound urgent, tell the user to seek emergency care immediately.
- Keep advice practical, cautious, and evidence-aligned.
- Mention that guidance is general education and a qualified clinician should confirm care.
- Do not include hidden reasoning, chain-of-thought, markdown, or <think> tags.

Return JSON only:
{
  "summary": "direct answer in 35 words or fewer",
  "keyPoints": ["point 1", "point 2"],
  "selfCare": ["safe care item 1", "safe care item 2"],
  "askDoctor": ["when to call a clinician"],
  "redFlags": ["urgent warning sign"],
  "disclaimer": "general medical education disclaimer"
}`;
}

export async function POST(request) {
    const provider = chatProviderConfig({ fallbackModel: GROQ_FALLBACK_MODEL });
    if (!provider) {
        return NextResponse.json({ ok: false, message: "AI provider is not configured. Set OPENCODE_API_KEY or GROQ_API_KEY." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const question = String(body.question || "").replace(/\s+/g, " ").trim().slice(0, 1200);
    if (question.length < 3) {
        return NextResponse.json({ ok: false, message: "Ask a health question first." }, { status: 400 });
    }

    const result = await fetchChatCompletion({
        url: provider.url,
        apiKey: provider.apiKey,
        model: provider.model,
        temperature: 0.2,
        maxTokens: 1000,
        fallbackMessage: "The health education model could not answer right now. Please try again.",
        messages: [
            { role: "system", content: systemPrompt() },
            { role: "user", content: question }
        ]
    });
    if (!result.ok) {
        return NextResponse.json({
            ok: false,
            message: result.message
        }, { status: result.status });
    }

    const data = result.data;
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = parseJson(content);
    if (!parsed) {
        return NextResponse.json({
            ok: true,
            model: provider.model,
            provider: provider.name,
            answer: normalizeEducation({ summary: content }, question)
        });
    }

    return NextResponse.json({
        ok: true,
        model: provider.model,
        provider: provider.name,
        answer: normalizeEducation(parsed, question)
    });
}
