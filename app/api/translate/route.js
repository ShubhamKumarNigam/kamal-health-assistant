import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { languages } from "@/lib/languages";

export const runtime = "nodejs";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const MAX_TEXTS = 120;
const MAX_TEXT_LENGTH = 400;

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

function parseJsonObject(content) {
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

function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
}

function requestedLanguage(code) {
    return languages.find((language) => language.code === code) || null;
}

function systemPrompt(language) {
    return `You translate UI text for the KAMAL health assistant.

Target language: ${language.name} (${language.nativeName}).

Rules:
- Return JSON only.
- Return one object named "translations".
- Preserve every input key exactly.
- Translate values naturally for product UI.
- Keep KAMAL, brand names, URLs, emails, numbers, units, and code-like tokens unchanged.
- Do not add explanations, markdown, or extra keys.

Schema:
{
  "translations": {
    "Original text": "Translated text"
  }
}`;
}

export async function POST(request) {
    const apiKey = groqApiKey();
    if (!apiKey) {
        return NextResponse.json({ ok: false, message: "Groq is not configured. Set GROQ_API_KEY in .env.local." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const language = requestedLanguage(body.languageCode);
    if (!language) {
        return NextResponse.json({ ok: false, message: "Unsupported language." }, { status: 400 });
    }

    if (language.code === "en") {
        return NextResponse.json({ ok: true, model: MODEL, translations: {} });
    }

    const texts = [...new Set(Array.isArray(body.texts) ? body.texts.map(normalizeText).filter(Boolean) : [])]
        .filter((text) => /[A-Za-z]/.test(text))
        .slice(0, MAX_TEXTS);

    if (!texts.length) {
        return NextResponse.json({ ok: true, model: MODEL, translations: {} });
    }

    const source = Object.fromEntries(texts.map((text) => [text, ""]));

    try {
        const response = await fetch(GROQ_CHAT_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL,
                temperature: 0,
                max_tokens: 2500,
                messages: [
                    { role: "system", content: systemPrompt(language) },
                    {
                        role: "user",
                        content: JSON.stringify({
                            targetLanguage: language.name,
                            translations: source
                        })
                    }
                ]
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return NextResponse.json({
                ok: false,
                message: data?.error?.message || "Translation model could not respond."
            }, { status: response.status });
        }

        const parsed = parseJsonObject(data?.choices?.[0]?.message?.content || "");
        const translations = parsed?.translations && typeof parsed.translations === "object" ? parsed.translations : {};
        const normalizedTranslations = {};
        texts.forEach((text) => {
            const translated = normalizeText(translations[text]);
            if (translated) {
                normalizedTranslations[text] = translated;
            }
        });

        return NextResponse.json({
            ok: true,
            model: MODEL,
            translations: normalizedTranslations
        });
    }
    catch (error) {
        console.error("Translation failed", error);
        return NextResponse.json({ ok: false, message: "Translation failed. Please try again." }, { status: 500 });
    }
}
