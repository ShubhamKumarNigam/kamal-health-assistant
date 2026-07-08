import fs from "fs";
import path from "path";

export const REPORT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_CAUTION = "This report is AI-assisted and is not a final medical diagnosis. A qualified clinician should confirm important findings, worsening symptoms, and treatment decisions.";

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

function genderLabel(value) {
    return ({
        female: "Female",
        male: "Male",
        non_binary: "Non-binary",
        prefer_not_to_say: "Prefer not to say"
    })[value] || value || "Not provided";
}

export function intakePreText(intake) {
    if (!intake) {
        return "No patient pre-text or intake information is available yet.";
    }
    return [
        `Age: ${intake.age} years`,
        `Gender: ${genderLabel(intake.gender)}`,
        `Height: ${intake.heightCm} cm`,
        `Weight: ${intake.weightKg} kg`,
        `Allergies: ${intake.allergies || "None reported"}`,
        `Main concern: ${intake.mainConcern || "Not stated"}`
    ].join("\n");
}

function latestSessionPreText(latestSession, intake) {
    return latestSession?.preConsultationText || intakePreText(intake);
}

function compactText(value, maxLength = 260) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength - 1).trim()}...`;
}

function formatReportDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!match) {
        return value || "Not available";
    }
    const [, year, month, day, hour, minute] = match;
    const monthName = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ][Number(month) - 1];
    return `${Number(day)} ${monthName} ${year}${hour && minute ? `, ${hour}:${minute}` : ""}`;
}

function sessionRecommendations(diagnosis) {
    return toList(diagnosis.recommendedNextSteps)
        .concat(toList(diagnosis.recommendedNextStep))
        .concat(toList(diagnosis.nextSteps))
        .concat(toList(diagnosis.doctorRecommendations))
        .filter(Boolean);
}

function sessionSelfCare(diagnosis) {
    return toList(diagnosis.selfCare).concat(toList(diagnosis.selfCareGuidance)).filter(Boolean);
}

function diagnosisDisplayNumber(session, index) {
    const number = Number.parseInt(session?.diagnosis?.displayNumber, 10);
    return Number.isInteger(number) && number > 0 ? number : index + 1;
}

function buildDiagnosisHighlights(diagnosisSessions = []) {
    return diagnosisSessions.map((session, index) => {
        const diagnosis = session?.diagnosis || {};
        const recommendations = [...new Set(sessionRecommendations(diagnosis))];
        const redFlags = [...new Set(toList(diagnosis.redFlags))];
        const selfCare = [...new Set(sessionSelfCare(diagnosis))];
        const likelyConditions = toList(diagnosis.likelyConditions);
        const primaryCondition = diagnosis.primaryDisease || likelyConditions[0] || "Unclear - needs clinician evaluation";
        const reasoning = diagnosis.reasoning || session?.formattedSummary || "No reasoning saved.";
        const displayNumber = diagnosisDisplayNumber(session, index);
        return {
            title: `Diagnosis ${displayNumber}${index === 0 ? " - latest" : ""}`,
            isLatest: index === 0,
            savedAt: formatReportDate(session?.createdAt),
            primaryCondition,
            likelyConditions,
            confidenceLevel: diagnosis.confidenceLevel || "Not specified",
            mainPoint: compactText(reasoning, index === 0 ? 520 : 240),
            preText: session?.preConsultationText || "Not available",
            doctorRecommendations: recommendations.slice(0, index === 0 ? 6 : 3),
            selfCare: selfCare.slice(0, index === 0 ? 5 : 2),
            redFlags: redFlags.slice(0, index === 0 ? 5 : 2)
        };
    });
}

function combinedDiagnosisSummary(diagnosisHighlights = []) {
    if (!diagnosisHighlights.length) {
        return "";
    }
    return diagnosisHighlights.map((session) => {
        const label = session.isLatest ? "Latest diagnosis" : session.title;
        return `${label}: ${session.primaryCondition}. ${session.mainPoint}`;
    }).join("\n\n");
}

function sourceText({ user, intake, latestSession, diagnosisSessions = [] }) {
    const sessionsText = diagnosisSessions.length
        ? diagnosisSessions.map((session, index) => {
            const diagnosis = session?.diagnosis || {};
            const transcript = Array.isArray(session?.transcript) ? session.transcript : [];
            return [
                `Diagnosis session ${index + 1}`,
                `Saved at: ${session.createdAt || "Not available"}`,
                "Pre text:",
                session.preConsultationText || "Not available",
                "Diagnosis JSON:",
                JSON.stringify(diagnosis, null, 2),
                "Saved formatted diagnosis summary:",
                session.formattedSummary || "No saved diagnosis summary is available.",
                "Conversation transcript:",
                transcript.map((turn) => `${turn.role === "assistant" ? "Doctor AI" : "Patient"}: ${turn.content}`).join("\n\n") || "No transcript saved."
            ].join("\n");
        }).join("\n\n---\n\n")
        : "No saved diagnosis sessions are available.";
    return [
        `Patient name: ${user?.name || latestSession?.patientName || "Patient"}`,
        `Patient email: ${user?.email || latestSession?.patientEmail || "Not available"}`,
        "",
        "Latest pre text:",
        latestSessionPreText(latestSession, intake),
        "",
        "All diagnosis history, newest first:",
        sessionsText
    ].join("\n");
}

function fallbackReport({ user, intake, latestSession, diagnosisSessions = [] }) {
    const diagnosis = latestSession?.diagnosis || {};
    const recommendedNextSteps = toList(diagnosis.recommendedNextSteps)
        .concat(toList(diagnosis.recommendedNextStep))
        .concat(toList(diagnosis.nextSteps));
    const redFlags = toList(diagnosis.redFlags);
    const selfCare = toList(diagnosis.selfCare).concat(toList(diagnosis.selfCareGuidance));
    const diagnosisHighlights = buildDiagnosisHighlights(diagnosisSessions);
    const historySummary = combinedDiagnosisSummary(diagnosisHighlights);

    return {
        patientName: user?.name || latestSession?.patientName || "Patient",
        patientEmail: user?.email || latestSession?.patientEmail || "Not available",
        preText: latestSessionPreText(latestSession, intake),
        summary: historySummary || diagnosis.reasoning || latestSession?.formattedSummary || "No completed diagnosis summary is available yet.",
        doctorRecommendations: recommendedNextSteps.length ? recommendedNextSteps : ["Consult a qualified clinician with this report."],
        selfCare: selfCare.length ? selfCare : ["Follow safe supportive care and clinician advice."],
        redFlags: redFlags.length ? redFlags : ["Seek urgent care for severe, sudden, worsening, or emergency symptoms."],
        diagnosisHighlights,
        caution: diagnosis.caution || diagnosis.doctorConfirmationNote || DEFAULT_CAUTION,
        source: diagnosisSessions.length ? "All saved diagnosis history" : "Latest patient intake"
    };
}

function normalizeReport(raw, fallback) {
    const combinedSummary = combinedDiagnosisSummary(fallback.diagnosisHighlights);
    const modelSummary = String(raw?.summary || "").trim();
    return {
        patientName: String(raw?.patientName || fallback.patientName).trim(),
        patientEmail: String(raw?.patientEmail || fallback.patientEmail).trim(),
        preText: String(raw?.preText || fallback.preText).trim(),
        summary: combinedSummary
            ? `${modelSummary || fallback.summary}\n\nDiagnosis summary from all saved sessions:\n${combinedSummary}`
            : String(raw?.summary || fallback.summary).trim(),
        doctorRecommendations: toList(raw?.doctorRecommendations).length ? toList(raw.doctorRecommendations) : fallback.doctorRecommendations,
        selfCare: toList(raw?.selfCare).length ? toList(raw.selfCare) : fallback.selfCare,
        redFlags: toList(raw?.redFlags).length ? toList(raw.redFlags) : fallback.redFlags,
        diagnosisHighlights: fallback.diagnosisHighlights,
        caution: String(raw?.caution || fallback.caution || DEFAULT_CAUTION).trim(),
        source: fallback.source
    };
}

function systemPrompt() {
    return `You are KAMAL Report AI. Create a concise patient report for sharing with a doctor.

Rules:
- Use only the supplied patient data, pre text, diagnosis, and transcript.
- Do not invent lab values, imaging findings, diagnoses, dates, medicines, or doctor names.
- Put patient name, patient email, and preText first in the JSON.
- Analyse all supplied diagnosis history. Make the summary patient-friendly but clinically useful, and include the latest important information.
- The newest diagnosis is most important. Include more detail from the latest diagnosis while still summarizing every saved diagnosis session.
- If there are 4 saved diagnoses, the report must reflect all 4. Do not ignore older sessions.
- Keep lists short, specific, and doctor-ready.
- Include red flags and a doctor confirmation caution.
- Do not include hidden reasoning, markdown, or extra text.

Return JSON only:
{
  "patientName": "name",
  "patientEmail": "email",
  "preText": "pre-consultation text",
  "summary": "doctor-ready summary from all diagnosis history and other available information",
  "doctorRecommendations": ["step"],
  "selfCare": ["safe care item"],
  "redFlags": ["urgent sign"],
  "caution": "${DEFAULT_CAUTION}"
}`;
}

export function reportToText(report) {
    const list = (title, items) => [
        `${title}:`,
        ...(toList(items).length ? toList(items).map((item) => `- ${item}`) : ["- Not specified"])
    ].join("\n");
    return [
        "KAMAL Patient Report",
        "",
        `Patient name: ${report.patientName}`,
        `Patient email: ${report.patientEmail}`,
        "",
        "Pre text:",
        report.preText,
        "",
        "Summary:",
        report.summary,
        "",
        "All diagnosis sessions:",
        ...(Array.isArray(report.diagnosisHighlights) && report.diagnosisHighlights.length
            ? report.diagnosisHighlights.flatMap((session) => [
                "",
                session.title,
                `Saved at: ${session.savedAt}`,
                `Primary condition: ${session.primaryCondition}`,
                `Confidence: ${session.confidenceLevel}`,
                `Main point: ${session.mainPoint}`,
                "Pre text:",
                session.preText,
                "",
                list("Doctor recommendations from this diagnosis", session.doctorRecommendations),
                "",
                list("Self-care from this diagnosis", session.selfCare),
                "",
                list("Red flags from this diagnosis", session.redFlags)
            ])
            : ["- No saved diagnosis sessions available."]),
        "",
        list("Doctor recommendations", report.doctorRecommendations),
        "",
        list("Self-care", report.selfCare),
        "",
        list("Red flags", report.redFlags),
        "",
        "Caution:",
        report.caution
    ].join("\n");
}

export async function buildPatientReport({ user, intake, latestSession, diagnosisSessions = [] }) {
    const fallback = fallbackReport({ user, intake, latestSession, diagnosisSessions });
    const apiKey = groqApiKey();
    if (!apiKey) {
        return {
            report: fallback,
            text: reportToText(fallback),
            generatedBy: "fallback",
            warning: "Groq is not configured. Generated report from saved diagnosis data."
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
                model: REPORT_MODEL,
                temperature: 0.15,
                max_tokens: 1600,
                messages: [
                    { role: "system", content: systemPrompt() },
                    { role: "user", content: sourceText({ user, intake, latestSession, diagnosisSessions }) }
                ]
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                report: fallback,
                text: reportToText(fallback),
                generatedBy: "fallback",
                warning: data?.error?.message || "Groq report generation failed. Generated report from saved diagnosis data."
            };
        }
        const parsed = parseJson(data?.choices?.[0]?.message?.content || "");
        const report = normalizeReport(parsed || {}, fallback);
        return {
            report,
            text: reportToText(report),
            generatedBy: REPORT_MODEL,
            warning: ""
        };
    }
    catch (error) {
        console.error("Patient report generation failed", error);
        return {
            report: fallback,
            text: reportToText(fallback),
            generatedBy: "fallback",
            warning: "Report generation failed. Generated report from saved diagnosis data."
        };
    }
}
