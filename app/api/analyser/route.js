import { NextResponse } from "next/server";
import { chatProviderConfig, fetchChatCompletion } from "@/lib/aiProviderClient";

export const runtime = "nodejs";

const GROQ_FALLBACK_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 18000;
const DEFAULT_CAUTION = "This is AI-assisted health information, not a final medical diagnosis. A qualified clinician or radiologist should confirm important findings, especially for X-rays, scans, abnormal reports, or worsening symptoms.";

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

function cleanText(value) {
    return String(value || "")
        .replace(/\u0000/g, " ")
        .replace(/[^\S\r\n]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function extractPdfText(buffer) {
    const raw = buffer.toString("latin1");
    const literalStrings = [...raw.matchAll(/\(([^()]{3,})\)/g)]
        .map((match) => match[1])
        .join("\n");
    const textObjects = [...raw.matchAll(/BT([\s\S]*?)ET/g)]
        .map((match) => match[1].replace(/[^\x20-\x7E\n\r]/g, " "))
        .join("\n");
    return cleanText(`${literalStrings}\n${textObjects}`).slice(0, MAX_EXTRACTED_CHARS);
}

function extractFileText({ buffer, type, name }) {
    const lowerName = String(name || "").toLowerCase();
    if (type === "application/pdf" || lowerName.endsWith(".pdf")) {
        return extractPdfText(buffer);
    }
    if (type.startsWith("text/") ||
        /(\.txt|\.csv|\.md|\.json|\.html|\.xml|\.rtf)$/i.test(lowerName)) {
        return cleanText(buffer.toString("utf8")).slice(0, MAX_EXTRACTED_CHARS);
    }
    return "";
}

function isImageFile({ type, name }) {
    return type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(String(name || ""));
}

function imageDataUrl({ buffer, type }) {
    const mimeType = type && type.startsWith("image/") ? type : "image/jpeg";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function toList(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
        return value
            .split(/\n|;/)
            .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
            .filter(Boolean);
    }
    return [];
}

function normalizeAnalysis(raw, fallback) {
    return {
        file: fallback.file,
        generatedAt: new Date().toISOString(),
        summary: String(raw?.summary || "The analyser could not produce a reliable summary from the submitted details.").trim(),
        findings: toList(raw?.findings),
        possibleConcerns: toList(raw?.possibleConcerns),
        answer: String(raw?.answer || "No direct answer was generated.").trim(),
        recommendedNextSteps: toList(raw?.recommendedNextSteps),
        redFlags: toList(raw?.redFlags),
        limitations: toList(raw?.limitations),
        doctorNote: String(raw?.doctorNote || DEFAULT_CAUTION).trim(),
        caution: String(raw?.caution || DEFAULT_CAUTION).trim()
    };
}

function systemPrompt() {
    return `You are KAMAL Analyser, a cautious clinical document, image, and patient-query analyser.

You receive a patient query, file metadata, extracted report text when available, and sometimes an uploaded medical image.

Rules:
- Use only the provided details and extracted text. Do not invent measurements, radiology findings, lab values, dates, or patient history.
- If an uploaded image is provided, inspect it cautiously and describe only visible, non-definitive observations. State when image quality, orientation, or missing clinical context limits interpretation.
- If the uploaded file is a PDF or document with no extracted text and no image content, clearly state that the file could not be read and a clinician should review the original file.
- If extracted report text is available, summarize it in patient-friendly language and identify important abnormalities, normal results, missing information, and follow-up questions.
- Answer the patient's typed query directly when possible.
- Mention emergency red flags when relevant.
- Do not claim certainty, do not replace a doctor, and do not prescribe restricted medicines.
- Do not include hidden reasoning, chain-of-thought, markdown, or extra text.

Return JSON only with this schema:
{
  "summary": "short patient-friendly summary",
  "findings": ["important finding 1"],
  "possibleConcerns": ["possible concern 1"],
  "answer": "answer to the patient's typed query",
  "recommendedNextSteps": ["step 1"],
  "redFlags": ["urgent warning sign 1"],
  "limitations": ["limitation 1"],
  "doctorNote": "doctor confirmation note",
  "caution": "${DEFAULT_CAUTION}"
}`;
}

export async function POST(request) {
    const provider = chatProviderConfig({ fallbackModel: GROQ_FALLBACK_MODEL });
    if (!provider) {
        return NextResponse.json({ ok: false, message: "AI provider is not configured. Set OPENCODE_API_KEY or GROQ_API_KEY." }, { status: 503 });
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
        return NextResponse.json({ ok: false, message: "Send a query and an optional file." }, { status: 400 });
    }

    const query = String(form.get("query") || "").trim();
    const file = form.get("file");
    if (!query && !(file instanceof File && file.size > 0)) {
        return NextResponse.json({ ok: false, message: "Add a query or upload a report/image to analyse." }, { status: 400 });
    }

    let fileContext = {
        name: "No file uploaded",
        type: "none",
        size: 0,
        extractedTextAvailable: false,
        imageIncluded: false
    };
    let extractedText = "";
    let imageUrl = "";

    if (file instanceof File && file.size > 0) {
        if (file.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json({ ok: false, message: "Upload a file smaller than 8 MB." }, { status: 413 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileType = file.type || "";
        const fileName = file.name || "";
        const imageIncluded = isImageFile({ type: fileType, name: fileName });
        extractedText = extractFileText({ buffer, type: fileType, name: fileName });
        imageUrl = imageIncluded ? imageDataUrl({ buffer, type: fileType }) : "";
        fileContext = {
            name: fileName || "uploaded file",
            type: fileType || "unknown",
            size: file.size,
            extractedTextAvailable: Boolean(extractedText),
            imageIncluded
        };
    }

    const userContent = [
        `Patient query: ${query || "No typed query provided."}`,
        `Uploaded file name: ${fileContext.name}`,
        `Uploaded file type: ${fileContext.type}`,
        `Uploaded file size: ${fileContext.size} bytes`,
        `Extracted text available: ${fileContext.extractedTextAvailable ? "yes" : "no"}`,
        `Image content included for model review: ${fileContext.imageIncluded ? "yes" : "no"}`,
        "",
        "Extracted file text:",
        extractedText || "No readable text could be extracted from the upload."
    ].join("\n");
    const userMessage = imageUrl
        ? {
            role: "user",
            content: [
                { type: "text", text: userContent },
                { type: "image_url", image_url: { url: imageUrl } }
            ]
        }
        : { role: "user", content: userContent };

    try {
        const result = await fetchChatCompletion({
            url: provider.url,
            apiKey: provider.apiKey,
            model: provider.model,
            temperature: 0.15,
            maxTokens: 950,
            fallbackMessage: "The analyser model could not respond. Please try again.",
            messages: [
                { role: "system", content: systemPrompt() },
                userMessage
            ]
        });
        if (!result.ok) {
            return NextResponse.json({
                ok: false,
                message: result.message
            }, { status: result.status });
        }
        const data = result.data;
        const parsed = parseJson(data?.choices?.[0]?.message?.content || "");
        const analysis = normalizeAnalysis(parsed || {}, {
            file: fileContext
        });
        return NextResponse.json({
            ok: true,
            model: provider.model,
            provider: provider.name,
            analysis
        });
    }
    catch (error) {
        console.error("Analyser failed", error);
        return NextResponse.json({ ok: false, message: "The analyser could not process this request. Please try again." }, { status: 500 });
    }
}
