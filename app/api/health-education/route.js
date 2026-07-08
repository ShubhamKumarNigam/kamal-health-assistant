import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "qwen/qwen3-32b";

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
  "summary": "short direct answer in patient-friendly language",
  "keyPoints": ["important point 1", "important point 2"],
  "selfCare": ["safe general supportive care item"],
  "askDoctor": ["what to ask a clinician or when to book a visit"],
  "redFlags": ["urgent warning sign"],
  "disclaimer": "general medical education disclaimer"
}`;
}

export async function POST(request) {
    const apiKey = groqApiKey();
    if (!apiKey) {
        return NextResponse.json({ ok: false, message: "Qwen is not configured. Set GROQ_API_KEY in .env.local." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const question = String(body.question || "").replace(/\s+/g, " ").trim().slice(0, 1200);
    if (question.length < 3) {
        return NextResponse.json({ ok: false, message: "Ask a health question first." }, { status: 400 });
    }

    const response = await fetch(GROQ_CHAT_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            temperature: 0.2,
            max_tokens: 900,
            messages: [
                { role: "system", content: systemPrompt() },
                { role: "user", content: question }
            ]
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        return NextResponse.json({
            ok: false,
            message: data?.error?.message || "Qwen could not answer right now. Please try again."
        }, { status: response.status });
    }

    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = parseJson(content);
    if (!parsed) {
        return NextResponse.json({
            ok: true,
            model: MODEL,
            answer: normalizeEducation({ summary: content }, question)
        });
    }

    return NextResponse.json({
        ok: true,
        model: MODEL,
        answer: normalizeEducation(parsed, question)
    });
}
