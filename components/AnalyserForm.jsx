"use client";

import { useMemo, useState } from "react";
import { Activity, AlertCircle, ClipboardCheck, Download, FileText, FileWarning, ImageUp, ListChecks, Loader2, Send, ShieldCheck, Stethoscope, TriangleAlert } from "lucide-react";
import { ClinicalCard } from "@/components/ClinicalCard";

const initialForm = {
    query: ""
};

function ReportList({ title, items, emptyText, icon: Icon, tone = "default" }) {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    const toneClass = tone === "warning"
        ? "border-[#F59E0B]/35 bg-amber-50"
        : tone === "danger"
            ? "border-red-200 bg-red-50"
            : "border-[#609665]/20 bg-[#F2FBF7]";
    return (<section className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon aria-hidden="true" className="h-5 w-5 text-primary"/>
        <h3 className="text-base font-extrabold text-text-primary">{title}</h3>
      </div>
      {safeItems.length ? (<ul className="grid gap-2">
          {safeItems.map((item) => (<li className="rounded-lg bg-white/80 px-3 py-2 text-sm font-semibold leading-6 text-text-primary" key={item}>
              {item}
            </li>))}
        </ul>) : (<p className="text-sm font-medium leading-6 text-text-secondary">{emptyText}</p>)}
    </section>);
}

function formatBytes(size) {
    if (!size) {
        return "0 B";
    }
    if (size < 1024) {
        return `${size} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildReportText(analysis) {
    if (!analysis) {
        return "";
    }
    const list = (title, items) => [
        title,
        ...(Array.isArray(items) && items.length ? items.map((item) => `- ${item}`) : ["- Not specified"])
    ].join("\n");
    return [
        "KAMAL Analyser Patient Report",
        "",
        `File: ${analysis.file?.name || "No file uploaded"}`,
        "",
        `Summary: ${analysis.summary || "Not specified"}`,
        "",
        `Query answer: ${analysis.answer || "Not specified"}`,
        "",
        list("Findings", analysis.findings),
        "",
        list("Possible concerns", analysis.possibleConcerns),
        "",
        list("Recommended next steps", analysis.recommendedNextSteps),
        "",
        list("Red flags", analysis.redFlags),
        "",
        list("Limitations", analysis.limitations),
        "",
        `Doctor note: ${analysis.doctorNote || "A qualified clinician should confirm this assessment."}`,
        `Caution: ${analysis.caution || ""}`
    ].join("\n");
}

export function AnalyserForm() {
    const [form, setForm] = useState(initialForm);
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState({ type: "idle", message: "" });
    const [analysis, setAnalysis] = useState(null);
    const isSubmitting = status.type === "loading";
    const reportText = useMemo(() => buildReportText(analysis), [analysis]);

    function updateField(event) {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    }

    function updateFile(event) {
        setFile(event.target.files?.[0] || null);
    }

    async function submitForm(event) {
        event.preventDefault();
        setStatus({ type: "loading", message: "Analysing patient information..." });
        setAnalysis(null);

        const payload = new FormData();
        payload.set("query", form.query);
        if (file) {
            payload.set("file", file);
        }

        try {
            const response = await fetch("/api/analyser", {
                method: "POST",
                body: payload
            });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                setStatus({ type: "error", message: result.message || "The analyser could not process this file." });
                return;
            }
            setAnalysis(result.analysis);
            setStatus({ type: "success", message: "Analysis complete." });
        }
        catch {
            setStatus({ type: "error", message: "The analyser could not connect. Please try again." });
        }
    }

    function downloadReport() {
        const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `kamal-analyser-report-${Date.now()}.txt`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    return (<div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <section className="rounded-lg border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xl font-bold text-text-primary">
              <Stethoscope aria-hidden="true" className="h-6 w-6 text-primary"/>
              <h2>Patient analyser</h2>
            </div>
            <p className="mt-2 leading-7 text-text-secondary">
              Upload a PDF, document, JPEG, or report image and add the question you want checked.
            </p>
          </div>
        </div>

        <form className="mt-5 grid gap-5" onSubmit={submitForm}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-text-primary">Upload file or image</span>
            <span className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#609665]/60 bg-[#DAF8EF]/60 p-5 text-center transition hover:bg-[#DAF8EF]">
              <ImageUp aria-hidden="true" className="h-9 w-9 text-primary"/>
              <span className="font-bold text-text-primary">
                {file ? file.name : "Choose PDF, document, JPEG, PNG, or report file"}
              </span>
              <span className="text-sm font-semibold text-text-secondary">
                {file ? `${file.type || "Unknown type"} - ${formatBytes(file.size)}` : "Maximum upload: 8 MB"}
              </span>
              <input accept=".pdf,.txt,.csv,.md,.json,.jpg,.jpeg,.png,.webp,.rtf,image/*,application/pdf,text/*" className="sr-only" onChange={updateFile} type="file"/>
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-text-primary">Query for analyser</span>
            <textarea className="min-h-32 w-full rounded-lg border border-border bg-[#edf8ef] px-4 py-3 text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none" name="query" onChange={updateField} placeholder="Ask what you want to understand from this report, X-ray, or diagnosis document." rows={5} value={form.query}/>
          </label>

          {status.message ? (<p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${status.type === "error" ? "bg-red-50 text-emergency" : "bg-teal-50 text-primary"}`}>
              {status.type === "error" ? (<AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0"/>) : null}
              <span>{status.message}</span>
            </p>) : null}

          <button className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70" disabled={isSubmitting} type="submit">
            {isSubmitting ? (<Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>) : (<Send aria-hidden="true" className="h-5 w-5"/>)}
            <span>{isSubmitting ? "Analysing..." : "Send to analyser"}</span>
          </button>
        </form>
      </section>

      <aside className="space-y-4">
        {analysis ? (<section className="overflow-hidden rounded-lg border border-border bg-surface shadow-soft">
            <div className="border-b border-border bg-[#10231F] p-5 text-white">
              <div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-normal text-[#9BE7D9]">KAMAL analyser report</p>
                  <h2 className="mt-2 text-2xl font-extrabold leading-tight">Medical file analysis</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#DDFBF6]">
                    {analysis.file?.name || "No file uploaded"}
                  </p>
                </div>
              </div>
            </div>

            <div className="kamal-analyser-report-body grid gap-4 p-5">
              <section className="rounded-lg border border-[#609665]/25 bg-[#DAF8EF]/70 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Activity aria-hidden="true" className="h-5 w-5 text-primary"/>
                  <h3 className="text-base font-extrabold text-text-primary">Summary</h3>
                </div>
                <p className="leading-7 text-text-primary">{analysis.summary}</p>
              </section>

              <section className="rounded-lg border border-border bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ClipboardCheck aria-hidden="true" className="h-5 w-5 text-primary"/>
                  <h3 className="text-base font-extrabold text-text-primary">Answer to your query</h3>
                </div>
                <p className="leading-7 text-text-secondary">{analysis.answer}</p>
              </section>

              <div className="grid gap-4">
                <ReportList emptyText="No specific findings were returned." icon={ListChecks} items={analysis.findings} title="Key findings"/>
                <ReportList emptyText="No possible concerns were returned." icon={FileWarning} items={analysis.possibleConcerns} title="Possible concerns" tone="warning"/>
                <ReportList emptyText="No next steps were returned." icon={ClipboardCheck} items={analysis.recommendedNextSteps} title="Recommended next steps"/>
                <ReportList emptyText="No urgent red flags were returned." icon={TriangleAlert} items={analysis.redFlags} title="Red flags" tone="danger"/>
                <ReportList emptyText="No limitations were returned." icon={ShieldCheck} items={analysis.limitations} title="Limitations"/>
              </div>

              <section className="rounded-lg border border-border bg-[#F8FAFC] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Stethoscope aria-hidden="true" className="h-5 w-5 text-primary"/>
                  <h3 className="text-base font-extrabold text-text-primary">Doctor confirmation</h3>
                </div>
                <p className="leading-7 text-text-secondary">{analysis.doctorNote}</p>
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
                  {analysis.caution}
                </p>
              </section>

              <button className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-base font-semibold text-text-primary transition hover:border-primary" onClick={downloadReport} type="button">
                <Download aria-hidden="true" className="h-5 w-5"/>
                <span>Download report</span>
              </button>
            </div>
          </section>) : (<>
          <ClinicalCard title="Analyser report" tone="accent">
            <div className="flex gap-3">
              <ImageUp aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary"/>
              <p>Report details will appear here after the analyser reads the submitted information.</p>
            </div>
          </ClinicalCard>
          <ClinicalCard title="Supported files">
            <ul className="grid gap-2">
              <li>PDF, text, CSV, Markdown, JSON, and report documents with readable text</li>
              <li>JPEG, PNG, WebP, and X-ray images for visual review</li>
              <li>Typed patient questions for targeted analysis</li>
            </ul>
          </ClinicalCard>

          <ClinicalCard title="Clinical caution">
            <div className="flex gap-3">
              <FileText aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary"/>
              <p>
                The analyser is for explanation and triage support. A doctor should confirm diagnosis, X-ray findings, and treatment decisions.
              </p>
            </div>
          </ClinicalCard>
        </>)}
      </aside>
    </div>);
}
