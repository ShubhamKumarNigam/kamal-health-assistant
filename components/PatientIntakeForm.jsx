"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, ChevronDown, ClipboardList, Loader2, Minus, Plus, Save, Stethoscope, UserRound } from "lucide-react";

const genderOptions = [
    { value: "", label: "Select" },
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
    { value: "non_binary", label: "Non-binary" },
    { value: "prefer_not_to_say", label: "Prefer not to say" }
];

function NumberField({ label, name, value, min, max, unit, placeholder, onChange, onStep }) {
    return (<label className="block">
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-text-primary">
        <span>{label}</span>
        <span className="text-xs font-semibold text-text-secondary">{unit}</span>
      </span>
      <span className="flex min-h-12 overflow-hidden rounded-lg border border-border bg-transparent focus-within:border-primary">
        <input className="kamal-number-input min-w-0 flex-1 bg-[#edf8ef] px-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none" inputMode="numeric" max={max} min={min} name={name} onChange={onChange} placeholder={placeholder} required type="number" value={value}/>
        <button aria-label={`Decrease ${label.toLowerCase()}`} className="touch-target grid w-12 place-items-center border-l border-border bg-[#DAF8EF] text-[#10231f] hover:bg-white" onClick={() => onStep(name, -1, min, max)} type="button">
          <Minus aria-hidden="true" className="h-4 w-4"/>
        </button>
        <button aria-label={`Increase ${label.toLowerCase()}`} className="touch-target grid w-12 place-items-center border-l border-border bg-[#DAF8EF] text-[#10231f] hover:bg-white" onClick={() => onStep(name, 1, min, max)} type="button">
          <Plus aria-hidden="true" className="h-4 w-4"/>
        </button>
      </span>
    </label>);
}

function TextInput({ label, name, value, placeholder, onChange, required = false }) {
    const className = "min-h-12 w-full rounded-lg border border-border bg-[#edf8ef] px-4 py-3 text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none";
    return (<label className="block">
      <span className="mb-2 block text-sm font-bold text-text-primary">{label}</span>
      <input className={className} name={name} onChange={onChange} placeholder={placeholder} required={required} type="text" value={value}/>
    </label>);
}

function TextArea({ label, name, value, placeholder, onChange, required = false }) {
    const className = "min-h-28 w-full rounded-lg border border-border bg-[#edf8ef] px-4 py-3 text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none";
    return (<label className="block">
      <span className="mb-2 block text-sm font-bold text-text-primary">{label}</span>
      <textarea className={className} name={name} onChange={onChange} placeholder={placeholder} required={required} rows={4} value={value}/>
    </label>);
}

export function PatientIntakeForm({
    existingIntake = null,
    startBlank = false,
    hideSubmitText = false,
    startDiagnosisOnSubmit = false,
    title = "Patient information",
    description = "Save these details first so KAMAL can ask safer, more relevant follow-up questions.",
    submitLabel = existingIntake ? "Update patient information" : "Save patient information",
    successMessage = "Patient information saved."
}) {
    const router = useRouter();
    const [form, setForm] = useState({
        age: startBlank ? "" : existingIntake?.age ?? 30,
        gender: startBlank ? "" : existingIntake?.gender ?? "",
        heightCm: startBlank ? "" : existingIntake?.heightCm ?? 170,
        weightKg: startBlank ? "" : existingIntake?.weightKg ?? 70,
        allergies: startBlank ? "" : existingIntake?.allergies ?? "",
        mainConcern: startBlank ? "" : existingIntake?.mainConcern ?? ""
    });
    const [status, setStatus] = useState({ type: "idle", message: "" });
    const isSaving = status.type === "saving";

    function updateField(event) {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    }

    function stepField(name, delta, min, max) {
        setForm((current) => {
            const nextValue = Number(current[name]) + delta;
            return { ...current, [name]: Math.min(max, Math.max(min, nextValue)) };
        });
    }

    async function submitForm(event) {
        event.preventDefault();
        setStatus({ type: "saving", message: startDiagnosisOnSubmit ? "Starting diagnosis..." : "Saving patient information..." });
        const response = await fetch("/api/patient-intake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form)
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
            setStatus({ type: "error", message: result.message || "Patient information could not be saved." });
            return;
        }
        if (startDiagnosisOnSubmit) {
            const sessionResponse = await fetch("/api/diagnosis/session", { method: "POST" });
            const sessionResult = await sessionResponse.json();
            if (!sessionResponse.ok || !sessionResult.ok) {
                setStatus({ type: "error", message: sessionResult.message || "Could not start diagnosis." });
                return;
            }
            router.push(sessionResult.redirectTo || "/session/diagnosis");
            router.refresh();
            return;
        }
        setStatus({ type: "success", message: successMessage });
        router.refresh();
    }

    return (<section className="rounded-lg border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xl font-bold text-text-primary">
            <ClipboardList aria-hidden="true" className="h-6 w-6 text-primary"/>
            <h2>{title}</h2>
          </div>
          <p className="mt-2 leading-7 text-text-secondary">
            {description}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm font-bold text-primary">
          <UserRound aria-hidden="true" className="h-4 w-4"/>
          Patient context
        </span>
      </div>

      <form className="mt-5 grid gap-5" onSubmit={submitForm}>
        <div className="grid gap-5 md:grid-cols-2">
          <NumberField label="Age" max={130} min={0} name="age" onChange={updateField} onStep={stepField} placeholder="e.g. 39" unit="years" value={form.age}/>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-text-primary">Gender</span>
            <span className="relative block">
              <select className="min-h-12 w-full appearance-none rounded-lg border border-border bg-[#edf8ef] px-4 py-3 pr-12 text-text-primary focus:border-primary focus:outline-none" name="gender" onChange={updateField} required value={form.gender}>
                {genderOptions.map((option) => (<option key={option.value} value={option.value}>
                    {option.label}
                  </option>))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#10231f]"/>
            </span>
          </label>
          <NumberField label="Height" max={260} min={40} name="heightCm" onChange={updateField} onStep={stepField} placeholder="e.g. 168" unit="cm" value={form.heightCm}/>
          <NumberField label="Weight" max={500} min={1} name="weightKg" onChange={updateField} onStep={stepField} placeholder="e.g. 70" unit="kg" value={form.weightKg}/>
        </div>
        <TextInput label="Allergies" name="allergies" onChange={updateField} placeholder="e.g. Penicillin, peanuts, none" value={form.allergies}/>
        <TextArea label="Your concern" name="mainConcern" onChange={updateField} placeholder="Describe the main symptom, concern, or reason for today's diagnosis session." required value={form.mainConcern}/>

        {status.message ? (<p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${status.type === "error" ? "bg-red-50 text-emergency" : "bg-teal-50 text-primary"}`}>
            {status.type === "error" ? (<AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0"/>) : null}
            <span>{status.message}</span>
          </p>) : null}

        <button aria-label={submitLabel} className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70" disabled={isSaving} type="submit">
          {isSaving ? (<Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>) : startDiagnosisOnSubmit ? (<Stethoscope aria-hidden="true" className="h-5 w-5"/>) : (<Save aria-hidden="true" className="h-5 w-5"/>)}
          {hideSubmitText ? null : (<span>{submitLabel}</span>)}
        </button>
      </form>
    </section>);
}
