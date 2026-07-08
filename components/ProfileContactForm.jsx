"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Save } from "lucide-react";

export function ProfileContactForm({ initialName, initialPhone, initialEmail }) {
    const router = useRouter();
    const [form, setForm] = useState({
        name: initialName || "",
        phone: initialPhone || "",
        email: initialEmail || ""
    });
    const [status, setStatus] = useState({ type: "idle", message: "" });
    const isSaving = status.type === "saving";

    function updateField(event) {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    }

    async function saveProfile(event) {
        event.preventDefault();
        setStatus({ type: "saving", message: "Saving profile..." });
        const response = await fetch("/api/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
            setStatus({ type: "error", message: result.message || "Profile could not be saved." });
            return;
        }
        setForm({
            name: result.user?.name || form.name,
            phone: result.user?.phone || "",
            email: result.user?.email || form.email
        });
        setStatus({ type: "success", message: "Profile saved." });
        router.refresh();
    }

    return (<form className="mt-7 grid gap-3" onSubmit={saveProfile}>
      <label className="block">
        <span className="mb-2 block text-xs font-extrabold uppercase tracking-normal text-[#ADF8EF]">Name</span>
        <input className="min-h-12 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 font-extrabold text-white placeholder:text-[#DAF8EF] focus:border-[#ADF8EF] focus:outline-none" name="name" onChange={updateField} placeholder="Patient name" required type="text" value={form.name}/>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-extrabold uppercase tracking-normal text-[#ADF8EF]">Phone number</span>
          <input className="min-h-12 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 font-extrabold text-white placeholder:text-[#DAF8EF] focus:border-[#ADF8EF] focus:outline-none" name="phone" onChange={updateField} placeholder="+91 98765 43210" type="tel" value={form.phone}/>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-extrabold uppercase tracking-normal text-[#ADF8EF]">Email</span>
          <input className="min-h-12 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 font-extrabold text-white placeholder:text-[#DAF8EF] focus:border-[#ADF8EF] focus:outline-none" name="email" onChange={updateField} placeholder="patient@example.com" required type="email" value={form.email}/>
        </label>
      </div>

      {status.message ? (<p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${status.type === "error" ? "bg-red-50 text-emergency" : "bg-white/12 text-[#DAF8EF]"}`}>
        {status.type === "error" ? (<AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0"/>) : null}
        <span>{status.message}</span>
      </p>) : null}

      <button className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#DAF8EF] px-5 py-3 font-extrabold text-[#324C4A] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto" disabled={isSaving} type="submit">
        {isSaving ? (<Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>) : (<Save aria-hidden="true" className="h-5 w-5"/>)}
        <span>{isSaving ? "Saving..." : "Save profile"}</span>
      </button>
    </form>);
}
