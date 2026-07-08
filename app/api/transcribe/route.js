import { NextResponse } from "next/server";
import { fetchGroqJson, groqApiKey } from "@/lib/aiProviderClient";

export const runtime = "nodejs";

const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(request) {
    const apiKey = groqApiKey();
    if (!apiKey) {
        return NextResponse.json({ ok: false, message: "Groq is not configured. Set GROQ_API_KEY in .env.local." }, { status: 503 });
    }

    const form = await request.formData().catch(() => null);
    const audio = form?.get("audio");
    if (!(audio instanceof File) || audio.size <= 0) {
        return NextResponse.json({ ok: false, message: "Record audio before transcribing." }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
        return NextResponse.json({ ok: false, message: "Audio recording is too large. Please record a shorter message." }, { status: 413 });
    }

    try {
        const result = await fetchGroqJson({
            url: GROQ_TRANSCRIPTION_URL,
            apiKey,
            retryAttempts: 1,
            fallbackMessage: "Voice transcription failed.",
            body: () => {
                const payload = new FormData();
                payload.set("model", MODEL);
                payload.set("file", audio, audio.name || "voice-message.webm");
                return payload;
            }
        });
        if (!result.ok) {
            return NextResponse.json({
                ok: false,
                message: result.message
            }, { status: result.status });
        }
        return NextResponse.json({
            ok: true,
            model: MODEL,
            text: String(result.data.text || "").trim()
        });
    }
    catch (error) {
        console.error("Voice transcription failed", error);
        return NextResponse.json({ ok: false, message: "Voice transcription failed. Please try again." }, { status: 500 });
    }
}
