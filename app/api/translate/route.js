import { NextResponse } from "next/server";
import { chatProviderConfig, fetchChatCompletion } from "@/lib/aiProviderClient";
import { languages } from "@/lib/languages";

export const runtime = "nodejs";

const GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile";
const MAX_TEXTS = 45;
const MAX_TEXT_LENGTH = 240;

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
    const provider = chatProviderConfig({ fallbackModel: GROQ_FALLBACK_MODEL });
    if (!provider) {
        return NextResponse.json({ ok: false, message: "AI provider is not configured. Set OPENCODE_API_KEY or GROQ_API_KEY." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const language = requestedLanguage(body.languageCode);
    if (!language) {
        return NextResponse.json({ ok: false, message: "Unsupported language." }, { status: 400 });
    }

    if (language.code === "en") {
        return NextResponse.json({ ok: true, model: provider.model, provider: provider.name, translations: {} });
    }

    const texts = [...new Set(Array.isArray(body.texts) ? body.texts.map(normalizeText).filter(Boolean) : [])]
        .filter((text) => /[A-Za-z]/.test(text))
        .slice(0, MAX_TEXTS);

    if (!texts.length) {
        return NextResponse.json({ ok: true, model: provider.model, provider: provider.name, translations: {} });
    }

    const source = Object.fromEntries(texts.map((text) => [text, ""]));

    try {
        const result = await fetchChatCompletion({
            url: provider.url,
            apiKey: provider.apiKey,
            model: provider.model,
            temperature: 0,
            maxTokens: 1000,
            fallbackMessage: "Translation model could not respond.",
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
        });
        if (!result.ok) {
            return NextResponse.json({
                ok: false,
                message: result.message
            }, { status: result.status });
        }

        const data = result.data;
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
            model: provider.model,
            provider: provider.name,
            translations: normalizedTranslations
        });
    }
    catch (error) {
        console.error("Translation failed", error);
        return NextResponse.json({ ok: false, message: "Translation failed. Please try again." }, { status: 500 });
    }
}
