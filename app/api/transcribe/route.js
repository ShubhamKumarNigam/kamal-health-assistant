import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

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

    const payload = new FormData();
    payload.set("model", MODEL);
    payload.set("file", audio, audio.name || "voice-message.webm");

    try {
        const response = await fetch(GROQ_TRANSCRIPTION_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`
            },
            body: payload
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return NextResponse.json({
                ok: false,
                message: data?.error?.message || "Voice transcription failed."
            }, { status: response.status });
        }
        return NextResponse.json({
            ok: true,
            model: MODEL,
            text: String(data.text || "").trim()
        });
    }
    catch (error) {
        console.error("Voice transcription failed", error);
        return NextResponse.json({ ok: false, message: "Voice transcription failed. Please try again." }, { status: 500 });
    }
}
