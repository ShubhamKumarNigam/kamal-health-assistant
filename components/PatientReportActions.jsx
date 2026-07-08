"use client";

import { Download, Mail, Send, Stethoscope } from "lucide-react";
import { useState } from "react";

export function PatientReportActions({ fileName, reportText }) {
    const [recipientEmail, setRecipientEmail] = useState("");
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);

    function downloadReport() {
        const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setMessage("Report downloaded.");
    }

    async function sendReport() {
        setIsSending(true);
        setMessage("");
        try {
            const response = await fetch("/api/reports/mail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recipientEmail })
            });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.message || "Could not email report.");
            }
            setMessage(result.message || "Report emailed.");
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not email report.");
        }
        finally {
            setIsSending(false);
        }
    }

    return (<div className="grid gap-4">
      <label className="block">
        <span className="mb-2 flex items-center gap-2 text-sm font-bold text-text-primary">
          <Stethoscope aria-hidden="true" className="h-4 w-4 text-primary"/>
          Email recipient
        </span>
        <input className="min-h-12 w-full rounded-lg border border-border bg-[#edf8ef] px-4 py-3 text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none" onChange={(event) => setRecipientEmail(event.target.value)} placeholder="doctor@example.com or your email" type="email" value={recipientEmail}/>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <button className="touch-target inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-base font-semibold text-text-primary transition hover:border-primary" onClick={downloadReport} type="button">
          <Download aria-hidden="true" className="h-5 w-5"/>
          <span>Download report</span>
        </button>
        <button className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70" disabled={isSending || !recipientEmail.trim()} onClick={sendReport} type="button">
          {isSending ? (<Mail aria-hidden="true" className="h-5 w-5"/>) : (<Send aria-hidden="true" className="h-5 w-5"/>)}
          <span>{isSending ? "Sending..." : "Send one email"}</span>
        </button>
      </div>

      {message ? (<p className="rounded-lg bg-[#DAF8EF] px-4 py-3 text-sm font-bold text-primary">
          {message}
        </p>) : null}
    </div>);
}
