import { AlertTriangle, ClipboardList, FileText, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ClinicalCard } from "@/components/ClinicalCard";
import { PatientReportActions } from "@/components/PatientReportActions";
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken, listDiagnosisSessions } from "@/lib/auth/sqliteStore";
import { buildPatientReport } from "@/lib/patientReport";

export const dynamic = "force-dynamic";

function safeFileName(value) {
    return String(value || "patient")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "patient";
}

function ReportList({ title, items, icon: Icon, emptyText, tone = "default" }) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    const toneClass = tone === "warning"
        ? "border-red-200 bg-red-50"
        : "border-[#609665]/20 bg-[#F2FBF7]";
    return (<section className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon aria-hidden="true" className={`h-5 w-5 ${tone === "warning" ? "text-emergency" : "text-primary"}`}/>
        <h3 className="text-base font-extrabold text-[#10231F]">{title}</h3>
      </div>
      {list.length ? (<ul className="grid gap-2">
          {list.map((item) => (<li className="rounded-lg bg-white px-3 py-2 text-sm font-semibold leading-6 text-[#10231F]" key={item}>{item}</li>))}
        </ul>) : (<p className="text-sm font-semibold leading-6 text-[#5B605D]">{emptyText}</p>)}
    </section>);
}

function ReportFact({ label, value }) {
    return (<div className="rounded-lg border border-[#324C4A]/15 bg-white p-4">
      <dt className="text-xs font-extrabold uppercase tracking-normal text-[#324C4A]">{label}</dt>
      <dd className="mt-2 whitespace-pre-wrap font-bold leading-6 text-[#10231F]">{value || "Not available"}</dd>
    </div>);
}

export default async function ReportPage() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        redirect("/login?next=/reports/demo");
    }

    const intake = await getLatestPatientIntake(user.id);
    const diagnosisSessions = await listDiagnosisSessions(user.id);
    const latestSession = diagnosisSessions[0] || null;
    const hasReportSource = diagnosisSessions.length > 0;
    const reportResult = hasReportSource
        ? await buildPatientReport({ user, intake, latestSession, diagnosisSessions })
        : null;
    const report = reportResult?.report || null;

    return (<AppShell description="A doctor-ready patient report built from the latest saved diagnosis and pre-text information." eyebrow="Clinical report" title="Patient report">
      {report ? (<div className="grid gap-6 lg:grid-cols-[1fr_.38fr]">
          <section className="kamal-report-document overflow-hidden rounded-lg border border-[#324C4A]/15 bg-white shadow-soft">
            <div className="border-b border-[#4FA36F]/25 bg-[#DDF6E8] p-6 text-[#10231F]">
              <p className="text-xs font-extrabold uppercase tracking-normal text-[#2F7D52]">KAMAL patient report</p>
              <h2 className="mt-2 text-3xl font-extrabold leading-tight">Doctor-ready handoff</h2>
              <p className="mt-3 max-w-2xl leading-7 text-[#2F5F49]">
                Built from all saved diagnosis history and patient pre-text.
              </p>
            </div>

            <div className="grid gap-5 p-5 md:p-6">
              <section className="grid gap-4 md:grid-cols-2">
                <ReportFact label="Patient name" value={report.patientName}/>
                <ReportFact label="Patient email" value={report.patientEmail}/>
              </section>

              <section className="rounded-lg border border-[#324C4A]/15 bg-[#F9FAFB] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList aria-hidden="true" className="h-5 w-5 text-primary"/>
                  <h3 className="text-base font-extrabold text-[#10231F]">Pre text</h3>
                </div>
                <p className="whitespace-pre-wrap leading-7 text-[#10231F]">{report.preText}</p>
              </section>

              <section className="rounded-lg border border-[#609665]/25 bg-[#DAF8EF]/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FileText aria-hidden="true" className="h-5 w-5 text-primary"/>
                  <h3 className="text-base font-extrabold text-[#10231F]">Summary</h3>
                </div>
                <p className="leading-7 text-[#10231F]">{report.summary}</p>
              </section>

              <ReportList emptyText="No doctor recommendations are available." icon={Stethoscope} items={report.doctorRecommendations} title="Doctor recommendations"/>
              <ReportList emptyText="No self-care guidance is available." icon={ShieldCheck} items={report.selfCare} title="Self-care guidance"/>
              <ReportList emptyText="No red flags are available." icon={AlertTriangle} items={report.redFlags} title="Red flags" tone="warning"/>

              <section className="rounded-lg border border-[#324C4A]/15 bg-[#F9FAFB] p-4">
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">{report.caution}</p>
              </section>
            </div>
          </section>

          <aside className="space-y-5">
            <ClinicalCard title="Report actions" tone="accent">
              <p className="mb-4 leading-7">
                Download this patient report or send one combined email to a single recipient.
              </p>
              <PatientReportActions fileName={`kamal-report-${safeFileName(report.patientName)}.txt`} reportText={reportResult.text}/>
            </ClinicalCard>

            {reportResult.warning ? (<ClinicalCard title="Generation note" tone="warning">
                <p>{reportResult.warning}</p>
              </ClinicalCard>) : null}

          </aside>
        </div>) : (<div className="grid gap-6 lg:grid-cols-[1fr_.38fr]">
          <ClinicalCard title="No report data yet">
            <div className="flex gap-4">
              <UserRound aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-primary"/>
              <p>
                No completed diagnosis history is saved yet. Complete a diagnosis session first, then this page will generate a doctor-ready report.
              </p>
            </div>
          </ClinicalCard>
          <ClinicalCard title="Next step" tone="accent">
            <p>Start a diagnosis session to create report data.</p>
          </ClinicalCard>
        </div>)}
    </AppShell>);
}
