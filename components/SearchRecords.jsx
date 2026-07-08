"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { VoiceField } from "@/components/VoiceField";

export function SearchRecords() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [status, setStatus] = useState({ type: "idle", message: "" });
    const isSearching = status.type === "searching";

    async function runSearch(searchQuery) {
        const trimmedQuery = searchQuery.trim();
        if (!trimmedQuery) {
            setResults([]);
            setStatus({ type: "idle", message: "" });
            return;
        }
        setStatus({ type: "searching", message: "Searching..." });
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
            setStatus({ type: "error", message: result.message || "Search failed." });
            return;
        }
        setResults(result.results || []);
        setStatus({
            type: "done",
            message: result.results?.length ? `${result.results.length} match found.` : "No matching records found."
        });
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            runSearch(query);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [query]);

    function searchRecords(event) {
        event.preventDefault();
        runSearch(query);
    }

    return (<section className="rounded-lg border border-border bg-surface p-5 shadow-soft">
      <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={searchRecords}>
        <VoiceField label="Search KAMAL" name="search" onChange={(event) => setQuery(event.target.value)} placeholder="Search Home, Session, reminders, reports, or patient names..." value={query}/>
        <div className="flex items-end">
          <button className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 md:w-auto" disabled={isSearching} type="submit">
            {isSearching ? (<Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>) : (<Search aria-hidden="true" className="h-5 w-5"/>)}
            <span>{isSearching ? "Searching..." : "Search"}</span>
          </button>
        </div>
      </form>

      {status.message ? (<p className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${status.type === "error" ? "bg-red-50 text-emergency" : "bg-[#DAF8EF] text-primary"}`}>
        {status.type === "error" ? (<AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0"/>) : null}
        <span>{status.message}</span>
      </p>) : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-bg text-primary">
            <tr>
              <th className="border-b border-border px-4 py-3 font-bold" scope="col">Name</th>
            </tr>
          </thead>
          <tbody>
            {results.length ? (results.map((result) => (<tr className="border-b border-border last:border-b-0" key={result.id}>
                  <td className="px-4 py-3 font-semibold text-text-primary">
                    {result.href ? (<Link className="inline-flex w-full items-center justify-between gap-3 hover:text-primary" href={result.href}>
                        <span>{result.name}</span>
                        <span className="text-xs font-bold uppercase tracking-normal text-text-secondary">{result.type}</span>
                      </Link>) : (<span className="inline-flex w-full items-center justify-between gap-3">
                        <span>{result.name}</span>
                        <span className="text-xs font-bold uppercase tracking-normal text-text-secondary">{result.type}</span>
                      </span>)}
                  </td>
                </tr>))) : (<tr>
                <td className="px-4 py-6 text-center text-text-secondary">
                  Search for a page, quick search, or patient name to show matches here.
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </section>);
}
