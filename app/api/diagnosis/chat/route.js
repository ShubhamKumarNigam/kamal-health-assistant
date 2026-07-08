import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DIAGNOSIS_SESSION_COOKIE, verifyDiagnosisSessionJwt } from "@/lib/auth/diagnosisSessionJwt";
import {
    SESSION_COOKIE,
    getLatestPatientIntake,
    getUserBySessionToken,
    listDiagnosisSessions,
    saveDiagnosisSession
} from "@/lib/auth/sqliteStore";

export const runtime = "nodejs";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "qwen/qwen3-32b";
const DEFAULT_CAUTION = "Caution: This is AI-assisted health guidance, not a final medical diagnosis. Seek urgent medical care for severe, sudden, worsening, or emergency symptoms.";
const MIN_DIAGNOSIS_TURNS = 5;
const MAX_DIAGNOSIS_TURNS = 16;

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

function normalizeMessages(messages) {
    if (!Array.isArray(messages)) {
        return [];
    }
    return messages
        .map((message) => ({
            role: message?.role === "assistant" ? "assistant" : "user",
            content: String(message?.content || "").trim().slice(0, 3000)
        }))
        .filter((message) => message.content)
        .slice(-(MAX_DIAGNOSIS_TURNS * 2 + 2));
}

function diagnosisList(value) {
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

function uniqueList(...values) {
    return [...new Set(values.flatMap((value) => diagnosisList(value)).filter(Boolean))];
}

function compactText(value, maxLength = 700) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength - 1).trim()}...`;
}

function normalizeDiagnosis(rawDiagnosis = {}) {
    const likelyConditions = uniqueList(rawDiagnosis.likelyConditions);
    const primaryDisease = String(rawDiagnosis.primaryDisease || likelyConditions[0] || "Unclear - needs clinician evaluation").trim();

    return {
        primaryDisease,
        likelyConditions,
        confidenceLevel: String(rawDiagnosis.confidenceLevel || "Not specified").trim(),
        reasoning: String(rawDiagnosis.reasoning || "No reasoning saved.").trim(),
        recommendedNextSteps: uniqueList(
            rawDiagnosis.recommendedNextSteps,
            rawDiagnosis.recommendedNextStep,
            rawDiagnosis.nextSteps,
            rawDiagnosis.doctorRecommendations,
            rawDiagnosis.doctorRecommendation
        ),
        redFlags: uniqueList(rawDiagnosis.redFlags, rawDiagnosis.warningSigns, rawDiagnosis.urgentWarningSigns),
        selfCare: uniqueList(rawDiagnosis.selfCare, rawDiagnosis.selfCareGuidance, rawDiagnosis.homeCare),
        doctorConfirmationNote: String(rawDiagnosis.doctorConfirmationNote || "A qualified doctor should confirm this assessment.").trim(),
        caution: String(rawDiagnosis.caution || DEFAULT_CAUTION).trim()
    };
}

function patientTurnCount(messages) {
    return messages.filter((message) => message.role === "user").length;
}

function latestPatientMessage(messages) {
    return [...messages].reverse().find((message) => message.role === "user")?.content || "";
}

function wantsToEndSession(message) {
    const text = String(message || "").trim().toLowerCase();
    if (!text) {
        return false;
    }
    return /\b(end|stop|quit|exit|done|leave|bye|goodbye|thank you doctor|thanks doctor|thank you|thanks|that's all|that is all|no more)\b/.test(text)
        || /(?:धन्यवाद|शुक्रिया|बस|खत्म|अलविदा)/.test(text);
}

function fallbackDiagnosis({ intake, reason }) {
    return {
        primaryDisease: "Unclear - needs clinician evaluation",
        likelyConditions: ["Needs clinician evaluation"],
        confidenceLevel: "Low",
        reasoning: reason || "The session ended before enough reliable detail was available for a specific diagnosis.",
        recommendedNextSteps: [
            "Consult a qualified doctor with the saved symptom history.",
            "Seek urgent care immediately if symptoms are severe, sudden, worsening, or involve breathing difficulty, chest pain, fainting, or confusion."
        ],
        redFlags: [
            "Severe or worsening symptoms",
            "Chest pain, severe shortness of breath, fainting, confusion, or blue lips",
            "High fever or symptoms that do not improve"
        ],
        selfCare: [
            "Rest and stay hydrated if safe for your condition.",
            "Avoid self-medicating with prescription medicines without a clinician.",
            `Keep a note of your main concern: ${intake.mainConcern}`
        ],
        doctorConfirmationNote: "A qualified doctor should confirm this assessment.",
        caution: DEFAULT_CAUTION
    };
}

function stripJsonFence(content) {
    return content
        .trim()
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

function parseDoctorJson(content) {
    try {
        return JSON.parse(stripJsonFence(content));
    }
    catch {
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(content.slice(start, end + 1));
            }
            catch {
                return null;
            }
        }
    }
    return null;
}

function fallbackFollowUp(messages) {
    const askedText = messages
        .filter((message) => message.role === "assistant")
        .map((message) => message.content.toLowerCase())
        .join("\n");
    const followUps = [
        "How long have you had these symptoms?",
        "On a scale of 1-10, how severe is it right now?",
        "Have you had this before, or any related conditions?",
        "What changed most recently with your symptoms?"
    ];
    return followUps.find((question) => !askedText.includes(question.toLowerCase())) || "Please share the one most important detail you have not told me yet.";
}

function patientContext({ user, intake }) {
    return [
        `Patient name: ${user.name}`,
        `Patient email: ${user.email}`,
        `Age: ${intake.age}`,
        `Gender: ${intake.gender}`,
        `Height: ${intake.heightCm} cm`,
        `Weight: ${intake.weightKg} kg`,
        `Allergies: ${intake.allergies || "None reported"}`,
        `Main concern: ${intake.mainConcern}`
    ].join("\n");
}

function priorReportContext(diagnosisSessions = []) {
    if (!diagnosisSessions.length) {
        return "No previous completed diagnosis report is available.";
    }
    return diagnosisSessions.slice(0, 6).map((session, index) => {
        const diagnosis = session?.diagnosis || {};
        const likelyConditions = diagnosisList(diagnosis.likelyConditions).slice(0, 5);
        const recommendations = uniqueList(
            diagnosis.recommendedNextSteps,
            diagnosis.recommendedNextStep,
            diagnosis.nextSteps,
            diagnosis.doctorRecommendations,
            diagnosis.doctorRecommendation
        ).slice(0, 5);
        const redFlags = uniqueList(diagnosis.redFlags, diagnosis.warningSigns, diagnosis.urgentWarningSigns).slice(0, 5);
        const selfCare = uniqueList(diagnosis.selfCare, diagnosis.selfCareGuidance, diagnosis.homeCare).slice(0, 4);
        return [
            `Previous report ${index + 1}${index === 0 ? " (latest saved)" : ""}`,
            `Saved at: ${session?.createdAt || "Not available"}`,
            `Pre text: ${compactText(session?.preConsultationText, 450) || "Not available"}`,
            `Primary condition: ${compactText(diagnosis.primaryDisease || likelyConditions[0] || "Not specified", 180)}`,
            `Likely conditions: ${likelyConditions.length ? likelyConditions.join("; ") : "Not specified"}`,
            `Confidence: ${diagnosis.confidenceLevel || "Not specified"}`,
            `Reasoning: ${compactText(diagnosis.reasoning || session?.formattedSummary, 520) || "Not available"}`,
            `Doctor recommendations: ${recommendations.length ? recommendations.join("; ") : "Not specified"}`,
            `Self-care: ${selfCare.length ? selfCare.join("; ") : "Not specified"}`,
            `Red flags: ${redFlags.length ? redFlags.join("; ") : "Not specified"}`
        ].join("\n");
    }).join("\n\n---\n\n");
}

function systemPrompt({ user, intake, diagnosisSessions, turnCount, forceComplete, endRequested }) {
    return `You are KAMAL Doctor AI, a careful multilingual clinical intake assistant.

Patient context:
${patientContext({ user, intake })}

Previous report context from saved diagnosis history:
${priorReportContext(diagnosisSessions)}

Session control:
- Current patient turn count including starting concern: ${turnCount}.
- Preferred diagnosis window: complete the diagnosis from turn ${MIN_DIAGNOSIS_TURNS} through turn ${MAX_DIAGNOSIS_TURNS}.
- Do not continue beyond ${MAX_DIAGNOSIS_TURNS} patient turns.
- ${forceComplete ? "You MUST return status \"complete\" now and save a final diagnosis summary from available facts. Do not ask another follow-up question." : "If fewer than 5 patient turns are available, ask one useful follow-up unless there are emergency red flags or the patient wants to end."}
- ${endRequested ? "The patient appears to be ending the session. Respect that and return status \"complete\" with the best available cautious diagnosis summary." : "If the patient says end, stop, leave, bye, thank you doctor, thanks, done, or similar, return status \"complete\" and do not ask another question."}

Rules:
- Stay strictly within the patient's health concern. Do not give irrelevant or informal information.
- Use the previous report context as background medical history when it is relevant to the current concern.
- Do not assume old symptoms are happening now unless the patient confirms them in the current session.
- When prior reports mention allergies, red flags, repeated symptoms, likely conditions, or past recommendations, consider them while choosing follow-up questions and final diagnosis.
- Reply in the same language as the patient when possible. If the patient mixes languages, respond in a clear multilingual style matching them.
- Ask exactly one focused follow-up question at a time until enough information is available.
- Before diagnosis, collect the essentials when relevant: onset, duration, severity, location, progression, associated symptoms, red flags, medications, allergies, pregnancy/age risk, chronic disease, and recent exposures.
- Continue with follow-up questions for enough turns to be clinically satisfied, but complete by turn ${MAX_DIAGNOSIS_TURNS}. Aim to finish once enough evidence is available from turn ${MIN_DIAGNOSIS_TURNS} onward.
- If emergency red flags appear, tell the patient to seek urgent care immediately and still keep the response concise.
- Do not claim certainty, do not replace a qualified doctor, and do not prescribe restricted medicines.
- Give a complete diagnosis summary when enough information has been gathered, when the patient ends the session, or when the max turn limit is reached. In the final summary, clearly state the most likely disease or condition name first. If not enough information is available and completion is not forced, status must be "follow_up".
- Keep replies concise, clinically useful, and patient-friendly.
- Do not include hidden reasoning, chain-of-thought, or <think> tags.

Return JSON only. Do not use markdown or extra text.
Schema:
{
  "status": "follow_up" | "complete",
  "language": "detected patient language",
  "reply": "patient-facing response. For follow_up, include exactly one question. For complete, include a concise final assessment.",
  "caution": "${DEFAULT_CAUTION}",
  "diagnosis": {
    "primaryDisease": "single most likely disease or condition name, or 'Unclear - needs clinician evaluation'",
    "likelyConditions": ["condition 1", "condition 2"],
    "confidenceLevel": "Low" | "Moderate" | "High",
    "reasoning": "brief reasoning based only on provided facts",
    "recommendedNextSteps": ["step 1", "step 2"],
    "redFlags": ["urgent warning sign 1", "urgent warning sign 2"],
    "selfCare": ["safe supportive care item 1"],
    "doctorConfirmationNote": "A qualified doctor should confirm this assessment."
  }
}`;
}

async function callGroq({ user, intake, diagnosisSessions, messages }) {
    const apiKey = groqApiKey();
    if (!apiKey) {
        return {
            ok: false,
            status: 503,
            message: "Groq is not configured. Set GROQ_API_KEY in .env.local."
        };
    }
    const turnCount = patientTurnCount(messages);
    const endRequested = wantsToEndSession(latestPatientMessage(messages));
    const forceComplete = endRequested || turnCount >= MAX_DIAGNOSIS_TURNS;
    const response = await fetch(GROQ_CHAT_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            temperature: 0.2,
            max_tokens: 1200,
            messages: [
                { role: "system", content: systemPrompt({ user, intake, diagnosisSessions, turnCount, forceComplete, endRequested }) },
                ...messages
            ]
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            message: data?.error?.message || "The diagnosis model could not respond. Please try again."
        };
    }
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = parseDoctorJson(content);
    if (!parsed) {
        if (forceComplete) {
            return {
                ok: true,
                output: {
                    status: "complete",
                    reply: endRequested
                        ? "I will end the session now and save a cautious diagnosis summary to your history."
                        : "I will end the session now because the maximum diagnosis turns have been reached, and save a cautious diagnosis summary to your history.",
                    caution: DEFAULT_CAUTION,
                    diagnosis: fallbackDiagnosis({
                        intake,
                        reason: endRequested
                            ? "The patient ended the session before a specific diagnosis could be confirmed from the available details."
                            : "The maximum turn limit was reached before a specific diagnosis could be confirmed from the available details."
                    })
                }
            };
        }
        return {
            ok: true,
            output: {
                status: "follow_up",
                reply: fallbackFollowUp(messages),
                caution: DEFAULT_CAUTION
            }
        };
    }
    if (forceComplete && parsed.status !== "complete") {
        return {
            ok: true,
            output: {
                ...parsed,
                status: "complete",
                reply: endRequested
                    ? "I will end the session now and save the best available cautious diagnosis summary to your history."
                    : "I will end the session now because the maximum diagnosis turns have been reached, and save the best available cautious diagnosis summary to your history.",
                caution: parsed.caution || DEFAULT_CAUTION,
                diagnosis: parsed.diagnosis || fallbackDiagnosis({
                    intake,
                    reason: endRequested
                        ? "The patient ended the session before a specific diagnosis could be confirmed from the available details."
                        : "The maximum turn limit was reached before a specific diagnosis could be confirmed from the available details."
                })
            }
        };
    }
    return { ok: true, output: parsed };
}

export async function POST(request) {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        return NextResponse.json({ ok: false, message: "Please sign in before starting diagnosis." }, { status: 401 });
    }
    const intake = getLatestPatientIntake(user.id);
    if (!intake?.mainConcern) {
        return NextResponse.json({ ok: false, message: "Save your concern before the diagnosis session can continue." }, { status: 400 });
    }
    const hasDiagnosisSession = verifyDiagnosisSessionJwt(cookieStore.get(DIAGNOSIS_SESSION_COOKIE)?.value, {
        userId: user.id,
        intakeId: intake.id
    });
    if (!hasDiagnosisSession) {
        return NextResponse.json({ ok: false, message: "Start a diagnosis session first." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const messages = normalizeMessages(body.messages);
    if (!messages.length || messages[messages.length - 1].role !== "user") {
        return NextResponse.json({ ok: false, message: "Send a patient message to continue diagnosis." }, { status: 400 });
    }
    const diagnosisSessions = listDiagnosisSessions(user.id);
    try {
        const result = await callGroq({ user, intake, diagnosisSessions, messages });
        if (!result.ok) {
            return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
        }
        const output = result.output;
        const isComplete = output.status === "complete";
        const assistantMessage = {
            role: "assistant",
            content: String(output.reply || fallbackFollowUp(messages)).trim(),
            caution: String(output.caution || DEFAULT_CAUTION).trim()
        };
        let savedSession = null;
        if (isComplete) {
            const diagnosis = normalizeDiagnosis({
                ...output.diagnosis,
                caution: assistantMessage.caution
            });
            const saveResult = saveDiagnosisSession(user, intake, [...messages, assistantMessage], diagnosis);
            if (!saveResult.ok) {
                return NextResponse.json({ ok: false, message: saveResult.message }, { status: saveResult.status });
            }
            savedSession = saveResult.diagnosisSession;
        }
        return NextResponse.json({
            ok: true,
            model: MODEL,
            status: isComplete ? "complete" : "follow_up",
            message: assistantMessage,
            diagnosis: isComplete ? savedSession?.diagnosis : null,
            historyId: savedSession?.id || null
        });
    }
    catch (error) {
        console.error("Diagnosis chat failed", error);
        return NextResponse.json({ ok: false, message: "The diagnosis session could not continue. Please try again." }, { status: 500 });
    }
}
