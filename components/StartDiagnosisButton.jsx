"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Stethoscope } from "lucide-react";

export function StartDiagnosisButton() {
    const router = useRouter();
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");
    const isStarting = status === "starting";

    async function startSession() {
        setStatus("starting");
        setError("");
        try {
            const response = await fetch("/api/diagnosis/session", { method: "POST" });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.message || "Could not start diagnosis.");
            }
            router.push(result.redirectTo || "/session/diagnosis");
            router.refresh();
        }
        catch (caughtError) {
            setStatus("idle");
            setError(caughtError instanceof Error ? caughtError.message : "Could not start diagnosis.");
        }
    }

    return (<div className="grid gap-3">
      <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#ADF8EF] px-5 py-3 text-base font-extrabold text-[#10231f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70" disabled={isStarting} onClick={startSession} type="button">
        {isStarting ? (<Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>) : (<Stethoscope aria-hidden="true" className="h-5 w-5"/>)}
        Start diagnosis
      </button>
      {error ? (<p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-emergency">{error}</p>) : null}
    </div>);
}
