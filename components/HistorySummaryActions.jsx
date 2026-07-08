"use client";

import { Download, Mail } from "lucide-react";
import { useState } from "react";

export function HistorySummaryActions({ fileName, summaryText }) {
    const [message, setMessage] = useState("");
    const [isMailing, setIsMailing] = useState(false);

    function downloadSummary() {
        const blob = new Blob([summaryText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setMessage("History summary downloaded.");
    }

    async function mailSummary() {
        setIsMailing(true);
        setMessage("");
        try {
            const response = await fetch("/api/history/mail", { method: "POST" });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.message || "Could not email history summary.");
            }
            setMessage("Latest diagnosis emailed.");
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not email latest diagnosis.");
        }
        finally {
            setIsMailing(false);
        }
    }

    return (<div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <button className="touch-target inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-base font-semibold text-text-primary transition hover:border-primary" onClick={downloadSummary} type="button">
          <Download aria-hidden="true" className="h-5 w-5"/>
          <span>Download</span>
        </button>
        <button className="touch-target inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70" disabled={isMailing} onClick={mailSummary} type="button">
          <Mail aria-hidden="true" className="h-5 w-5"/>
          <span>{isMailing ? "Mailing..." : "Mail me"}</span>
        </button>
      </div>
      {message ? (<p className="rounded-lg bg-[#DAF8EF] px-4 py-3 text-sm font-bold text-primary">
          {message}
        </p>) : null}
    </div>);
}
