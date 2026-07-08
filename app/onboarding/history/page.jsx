import { ChevronDown, ChevronUp, ShieldAlert, UserRound } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ClinicalCard } from "@/components/ClinicalCard";
import { HistorySummaryActions } from "@/components/HistorySummaryActions";
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken, listDiagnosisSessions } from "@/lib/auth/sqliteStore";
import { buildHistorySummary } from "@/lib/historySummary";

const genderLabels = {
    female: "Female",
    male: "Male",
    non_binary: "Non-binary",
    prefer_not_to_say: "Prefer not to say"
};

export default async function HistoryPage() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        redirect("/login?next=/onboarding/history");
    }
    const patientName = user.name || "Patient";
    const patientEmail = user.email || "";
    const intake = await getLatestPatientIntake(user.id);
    const diagnosisSessions = await listDiagnosisSessions(user.id);
    const summary = buildHistorySummary({ patientName, patientEmail, intake, diagnosisSessions });

    return (<AppShell description="A concise patient history template with patient details and diagnosis context." eyebrow="History" title="Patient history summary">
      <div className="grid gap-6 lg:grid-cols-[1fr_.38fr]">
        <section className="space-y-5">
          <ClinicalCard title="Patient">
            <div className="flex items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#DAF8EF] text-primary">
                <UserRound aria-hidden="true" className="h-7 w-7"/>
              </span>
              <div>
                <p className="text-sm font-bold uppercase tracking-normal text-primary">Patient name</p>
                <h2 className="mt-1 text-3xl font-extrabold text-text-primary">{patientName}</h2>
                {patientEmail ? (<p className="mt-2 break-words font-semibold text-text-secondary">{patientEmail}</p>) : null}
              </div>
            </div>
          </ClinicalCard>

          <ClinicalCard title="Completed diagnoses">
            {diagnosisSessions.length ? (<div className="grid gap-4">
                {diagnosisSessions.map((session, index) => (<DiagnosisHistoryCard index={index} intake={intake} key={session.id} session={session}/>))}
              </div>) : (<p className="leading-7 text-text-secondary">
                No completed diagnosis sessions saved yet.
              </p>)}
          </ClinicalCard>
        </section>

        <aside className="space-y-5">
          <ClinicalCard title="History actions" tone="accent">
            <p className="mb-4 leading-7">
              Download a patient copy or mail the latest diagnosis to yourself after the session.
            </p>
            <HistorySummaryActions fileName={`kamal-history-${patientName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "patient"}.txt`} summaryText={summary.text}/>
          </ClinicalCard>
          <ClinicalCard title="Disclaimer" tone="warning">
            <div className="flex gap-3">
              <ShieldAlert aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-emergency"/>
              <p className="leading-7">
                This history summary is AI-assisted and is not a final medical diagnosis. A qualified doctor should review the details before treatment decisions are made.
              </p>
            </div>
          </ClinicalCard>
        </aside>
      </div>
    </AppShell>);
}

function HistoryFact({ label, value }) {
    return (<div className="rounded-lg border border-border bg-surface p-4">
      <dt className="text-xs font-extrabold uppercase tracking-normal text-primary">{label}</dt>
      <dd className="mt-2 font-bold leading-6 text-text-primary">{value}</dd>
    </div>);
}

function DiagnosisHistoryCard({ session, intake, index = 0 }) {
    const diagnosis = session.diagnosis || {};
    const { uniqueNextSteps, uniqueRedFlags, uniqueSelfCare } = clinicalSectionsForSession(session);
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    const shortSummary = diagnosisPreview(session, intake);
    const contextFacts = patientContextFacts(session, intake);
    const diagnosisNumber = diagnosisDisplayNumber(session, index);
    return (<details className="group rounded-lg border border-border bg-bg p-4">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-xl font-extrabold leading-tight text-text-primary md:text-2xl">Diagnosis {diagnosisNumber}</p>
            <div className="mt-2 flex max-w-3xl items-start gap-3">
              <span className="mt-0.5 inline-grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#DAF8EF] text-primary transition group-open:bg-primary group-open:text-white" aria-hidden="true">
                <ChevronDown className="h-4 w-4 group-open:hidden"/>
                <ChevronUp className="hidden h-4 w-4 group-open:block"/>
              </span>
              <p className="line-clamp-2 text-base font-semibold leading-7 text-text-secondary">{shortSummary}</p>
            </div>
          </div>
          <time className="text-sm font-bold text-text-secondary">{formatHistoryDate(session.createdAt)}</time>
        </div>
      </summary>

      <div className="mt-4 grid gap-4 border-t border-border pt-4">
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-extrabold uppercase tracking-normal text-primary">Patient context</p>
          {contextFacts.length ? (<dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contextFacts.map((fact) => (<HistoryFact key={fact.label} label={fact.label} value={fact.value}/>))}
            </dl>) : (<p className="mt-2 leading-7 text-text-secondary">No saved patient context is available yet.</p>)}
        </section>

        <VisibleListSection
          emptyText="No doctor recommendations were saved for this diagnosis."
          items={uniqueNextSteps}
          itemClassName="bg-[#DAF8EF] text-[#10231F]"
          title="Doctor recommendations"
        />
        <VisibleListSection
          emptyText="No self-care guidance was saved for this diagnosis."
          items={uniqueSelfCare}
          itemClassName="bg-[#F3F4F6] text-[#10231F]"
          title="Self-care guidance"
        />
        <VisibleListSection
          emptyText="No urgent red flags were saved for this diagnosis."
          items={uniqueRedFlags}
          itemClassName="bg-red-50 text-[#B91C1C]"
          title="Red flags"
          titleClassName="text-[#B91C1C]"
        />

        {transcript.length ? (<section className="kamal-history-panel rounded-lg border border-[#324C4A]/15 bg-white p-4 text-[#10231F]">
            <p className="text-xs font-extrabold uppercase tracking-normal text-[#324C4A]">Conversation transcript</p>
            <div className="mt-3 grid gap-2">
              {transcript.map((turn, turnIndex) => (<div className="rounded-lg bg-[#F3F4F6] px-3 py-2" key={`${turn.role}-${turnIndex}`}>
                  <p className="text-xs font-extrabold uppercase tracking-normal text-[#324C4A]">{turn.role === "assistant" ? "Doctor AI" : "Patient"}</p>
                  <p className="mt-1 whitespace-pre-wrap font-semibold leading-6 text-[#10231F]">{turn.content}</p>
                </div>))}
            </div>
          </section>) : null}
      </div>
    </details>);
}

function diagnosisDisplayNumber(session, index) {
    const number = Number.parseInt(session?.diagnosis?.displayNumber, 10);
    return Number.isInteger(number) && number > 0 ? number : index + 1;
}

function patientContextFacts(session, intake) {
    const savedFacts = String(session?.preConsultationText || "")
        .split(/\n+/)
        .map((line) => line.match(/^([^:]+):\s*(.*)$/))
        .filter(Boolean)
        .map((match) => ({
            label: contextLabel(match[1]),
            value: match[2]?.trim() || "Not stated"
        }))
        .filter((fact) => fact.label && fact.value);
    if (savedFacts.length) {
        return savedFacts;
    }
    if (!intake) {
        return [];
    }
    return [
        { label: "Age", value: `${intake.age} years` },
        { label: "Gender", value: genderLabels[intake.gender] || intake.gender },
        { label: "Height", value: `${intake.heightCm} cm` },
        { label: "Weight", value: `${intake.weightKg} kg` },
        { label: "Allergies", value: intake.allergies || "None reported" },
        { label: "Main concern", value: intake.mainConcern || "Not stated" }
    ];
}

function contextLabel(label) {
    const normalized = String(label || "").trim().toLowerCase();
    return ({
        age: "Age",
        gender: "Gender",
        height: "Height",
        "height cm": "Height",
        height_cm: "Height",
        weight: "Weight",
        "weight kg": "Weight",
        weight_kg: "Weight",
        allergies: "Allergies",
        "main concern": "Main concern",
        main_concern: "Main concern"
    })[normalized] || label.trim();
}

function diagnosisPreview(session, intake) {
    const diagnosis = session.diagnosis || {};
    const primary = String(diagnosis.primaryDisease || diagnosisList(diagnosis.likelyConditions)[0] || "").trim();
    const reasoning = String(diagnosis.reasoning || "").trim();
    const concern = String(intake?.mainConcern || session.preConsultationText || "").trim();
    const text = primary
        ? `${primary}${reasoning ? `: ${reasoning}` : ""}`
        : concern || "Summary will appear when diagnosis details are available.";
    return compactText(text, 170);
}

function compactText(value, maxLength) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength - 1).trim()}...`;
}

function formatHistoryDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!match) {
        return value || "";
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

function clinicalSectionsForSession(session) {
    const diagnosis = session.diagnosis || {};
    const nextSteps = diagnosisList(diagnosis.recommendedNextSteps)
        .concat(diagnosisList(diagnosis.recommendedNextStep))
        .concat(diagnosisList(diagnosis.nextSteps))
        .concat(extractSummaryList(session.formattedSummary, "Recommended next steps:"));
    const uniqueNextSteps = [...new Set(nextSteps.filter(Boolean))];
    const redFlags = diagnosisList(diagnosis.redFlags)
        .concat(extractSummaryList(session.formattedSummary, "Red flags:"));
    const selfCare = diagnosisList(diagnosis.selfCare)
        .concat(extractSummaryList(session.formattedSummary, "Self-care guidance:"));
    const uniqueRedFlags = [...new Set(redFlags.filter(Boolean))];
    const uniqueSelfCare = [...new Set(selfCare.filter(Boolean))];
    return { uniqueNextSteps, uniqueRedFlags, uniqueSelfCare };
}

function VisibleListSection({ title, items, emptyText, itemClassName, titleClassName = "text-[#324C4A]" }) {
    return (<section className="kamal-history-panel rounded-lg border border-[#324C4A]/15 bg-white p-4 text-[#10231F] shadow-[0_10px_25px_rgba(50,76,74,0.06)]">
      <p className={`text-xs font-extrabold uppercase tracking-normal ${titleClassName}`}>{title}</p>
      {items.length ? (<ul className="mt-3 grid gap-2">
          {items.map((item) => (<li className={`rounded-lg px-3 py-2 font-semibold leading-6 ${itemClassName}`} key={item}>{item}</li>))}
        </ul>) : (<p className="mt-2 font-semibold leading-6 text-[#5B605D]">{emptyText}</p>)}
    </section>);
}

function diagnosisList(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
        return value
            .split(/\n|;/)
            .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
            .filter(Boolean);
    }
    return [];
}

function extractSummaryList(summary, heading) {
    if (!summary || !summary.includes(heading)) {
        return [];
    }
    const afterHeading = summary.slice(summary.indexOf(heading) + heading.length);
    const nextSection = afterHeading.search(/\n(?:Recommended next steps:|Red flags:|Self-care guidance:|Caution:|Conversation Transcript)/);
    const section = nextSection >= 0 ? afterHeading.slice(0, nextSection) : afterHeading;
    return section
        .split("\n")
        .map((line) => line.replace(/^[-*\s]+/, "").trim())
        .filter(Boolean);
}
