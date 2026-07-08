"use client";

import { AlertTriangle, BookOpenCheck, Loader2, Search, ShieldCheck, Stethoscope } from "lucide-react";
import { useState } from "react";
import { VoiceField } from "@/components/VoiceField";

const examples = [
    "What are common causes of fever?",
    "How can I prevent acidity after meals?",
    "When should a cough be checked by a doctor?"
];

function AnswerList({ title, items, icon: Icon, tone = "default" }) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) {
        return null;
    }
    const toneClass = tone === "danger"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-[#609665]/20 bg-[#F2FBF7] text-[#10231f]";
    return (<section className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon aria-hidden="true" className={tone === "danger" ? "h-5 w-5 text-emergency" : "h-5 w-5 text-[#324C4A]"}/>
        <h3 className="font-extrabold">{title}</h3>
      </div>
      <ul className="grid gap-2">
        {list.map((item) => (<li className="rounded-lg bg-white/80 px-3 py-2 font-semibold leading-6" key={item}>{item}</li>))}
      </ul>
    </section>);
}

export function HealthEducationSearch() {
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState(null);
    const [status, setStatus] = useState({ type: "idle", message: "" });
    const isLoading = status.type === "loading";

    async function askQuestion(event) {
        event.preventDefault();
        const trimmedQuestion = question.trim();
        if (!trimmedQuestion) {
            setStatus({ type: "error", message: "Type a health question first." });
            setAnswer(null);
            return;
        }
        setStatus({ type: "loading", message: "Searching..." });
        setAnswer(null);
        try {
            const response = await fetch("/api/health-education", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: trimmedQuestion })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.ok) {
                throw new Error(result.message || "Health education search failed.");
            }
            setAnswer(result.answer);
            setStatus({ type: "done", message: "" });
        }
        catch (error) {
            setStatus({ type: "error", message: error instanceof Error ? error.message : "Health education search failed." });
        }
    }

    function useExample(value) {
        setQuestion(value);
        setAnswer(null);
        setStatus({ type: "idle", message: "" });
    }

    return (<section className="rounded-lg border border-border bg-surface p-5 shadow-soft">
      <form className="grid gap-4" onSubmit={askQuestion}>
        <VoiceField
          label="Ask a health education question"
          name="health-question"
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about symptoms, prevention, tests, treatment basics, or when to see a doctor..."
          value={question}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {examples.map((item) => (<button className="rounded-full border border-[#609665]/25 bg-[#EAF7F2] px-3 py-2 text-sm font-bold text-[#10231f] transition hover:border-[#324C4A] hover:bg-[#DAF8EF]" key={item} onClick={() => useExample(item)} type="button">
              {item}
            </button>))}
          </div>
          <button className="touch-target inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70" disabled={isLoading} type="submit">
            {isLoading ? (<Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>) : (<Search aria-hidden="true" className="h-5 w-5"/>)}
            <span>{isLoading ? "Searching..." : "Ask"}</span>
          </button>
        </div>
      </form>

      {status.message ? (<p className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold ${status.type === "error" ? "bg-red-50 text-emergency" : "bg-[#DAF8EF] text-[#10231f]"}`}>
        {status.message}
      </p>) : null}

      {answer ? (<div className="mt-6 grid gap-4">
          <section className="rounded-lg border border-[#609665]/20 bg-white p-5 text-[#10231f]">
            <div className="mb-3 flex items-center gap-2 text-[#324C4A]">
              <BookOpenCheck aria-hidden="true" className="h-5 w-5"/>
              <h2 className="text-lg font-extrabold text-[#10231f]">Health education answer</h2>
            </div>
            <p className="whitespace-pre-wrap text-lg font-semibold leading-8 text-[#10231f]">{answer.summary}</p>
          </section>
          <AnswerList icon={ShieldCheck} items={answer.keyPoints} title="Key points"/>
          <AnswerList icon={BookOpenCheck} items={answer.selfCare} title="General self-care"/>
          <AnswerList icon={Stethoscope} items={answer.askDoctor} title="Ask a doctor"/>
          <AnswerList icon={AlertTriangle} items={answer.redFlags} title="Urgent warning signs" tone="danger"/>
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
            {answer.disclaimer}
          </p>
        </div>) : null}
    </section>);
}
