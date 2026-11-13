const MAX_SECTION_BYTES = 3500;
export const REPORT_REQUEST_GAP_MS = 65000;

// Preserve every character in order, including whitespace and page markers.
export function splitReportSections(text, maxBytes = MAX_SECTION_BYTES) {
    const encoder = new TextEncoder();
    const sections = [];
    let current = "";
    for (const line of text.match(/[^\n]*\n|[^\n]+$/g) || []) {
        if (encoder.encode(current + line).length <= maxBytes) {current += line; continue;}
        if (current) sections.push(current);
        current = "";
        for (const character of line) {
            if (encoder.encode(current + character).length > maxBytes && current) {sections.push(current); current = "";}
            current += character;
        }
    }
    if (current) sections.push(current);
    return sections;
}

function pause(ms, signal) {
    return new Promise((resolve, reject) => {
        signal?.throwIfAborted();
        const onAbort = () => {clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError"));};
        const timer = setTimeout(() => {signal?.removeEventListener("abort", onAbort); resolve();}, ms);
        signal?.addEventListener("abort", onAbort, {once:true});
    });
}

export async function analyseReportSections(payload, {signal, progress = () => {}, fetcher = fetch, wait = pause} = {}) {
    const text = String(payload.get("reportText") || "");
    const sections = text ? splitReportSections(text) : [""];
    const results = [];
    let sent = false;
    for (let i = 0; i < sections.length; i++) {
        let result;
        for (let attempt = 0; attempt < 3; attempt++) {
            signal?.throwIfAborted();
            if (sent) {
                progress(`Waiting for the free AI allowance. Section ${i + 1} of ${sections.length} is next. Keep this page open; each section may take about a minute.`);
                await wait(REPORT_REQUEST_GAP_MS, signal);
            }
            signal?.throwIfAborted();
            progress(`Analysing section ${i + 1} of ${sections.length}…`);
            const part = new FormData();
            for (const [key, value] of payload.entries()) part.set(key, value);
            part.set("reportText", sections[i]);
            part.set("sectionMode", "true");
            part.set("sectionIndex", String(i + 1));
            part.set("sectionCount", String(sections.length));
            sent = true;
            const response = await fetcher("/api/analyser", {method:"POST", body:part, signal});
            result = await response.json().catch(() => ({message:"The analyser is temporarily unavailable. Please try again."}));
            if (response.status === 429 && attempt < 2) continue;
            if (!response.ok || !result.ok) throw new Error(`${result.message || "The analyser could not process this report."} No complete analysis was produced (${results.length} of ${sections.length} sections finished).`);
            break;
        }
        results.push(result.analysis);
    }
    if (results.length === 1) return results[0];
    const list = key => results.flatMap((item, i) => (item[key] || []).map(value => `Section ${i + 1}: ${value}`));
    return {
        ...results[0],
        generatedAt: new Date().toISOString(),
        summary: `All ${results.length} report sections were processed. Read the section findings below alongside the original report.`,
        answer: results.map((item, i) => `Section ${i + 1}: ${item.answer}`).join("\n\n"),
        findings: list("findings"), possibleConcerns: list("possibleConcerns"),
        recommendedNextSteps: list("recommendedNextSteps"), redFlags: list("redFlags"),
        limitations: ["Sections were analysed separately. Cross-page relationships and reference ranges split across sections may not be resolved. This is not a combined clinical assessment.", ...new Set(results.flatMap(item => item.limitations || []))]
    };
}
