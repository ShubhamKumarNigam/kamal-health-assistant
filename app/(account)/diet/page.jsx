import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Apple, AlertTriangle, Droplets, Salad, Soup, Utensils } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { AppShell } from "@/components/AppShell";
import { ClinicalCard } from "@/components/ClinicalCard";
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken, listDiagnosisSessions } from "@/lib/auth/sqliteStore";
import { buildDietPlan } from "@/lib/dietPlan";
import { buildPatientReport } from "@/lib/patientReport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mealIcons = {
    Breakfast: Apple,
    Lunch: Utensils,
    Evening: Soup,
    Hydration: Droplets
};

export default async function DietPage() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        redirect("/login?next=/diet");
    }

    const intake = await getLatestPatientIntake(user.id);
    const diagnosisSessions = await listDiagnosisSessions(user.id);
    const latestSession = diagnosisSessions[0] || null;
    const reportResult = latestSession
        ? await buildPatientReport({ user, intake, latestSession, diagnosisSessions })
        : null;
    const dietResult = await buildDietPlan({
        user,
        intake,
        latestSession,
        report: reportResult
    });
    const plan = dietResult.plan;

    return (<AppShell description="Personal diet guidance is created only after a completed diagnosis report is available." eyebrow="Care tools" title="Diet planner">
      {plan ? (<div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="grid gap-4 sm:grid-cols-2">
            {plan.meals.map((item) => {
            const Icon = mealIcons[item.title] || Salad;
            return (<article className="rounded-lg border border-border bg-surface p-5 shadow-soft" key={item.title}>
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#DAF8EF] text-primary">
                  <Icon aria-hidden="true" className="h-6 w-6"/>
                </span>
                <h2 className="mt-5 text-xl font-extrabold">{item.title}</h2>
                <p className="mt-2 leading-7 text-text-secondary">{item.detail}</p>
              </article>);
        })}
          </section>
          <div className="space-y-6">
            <ClinicalCard title="Personal diet summary" tone="accent">
              <p>{plan.summary}</p>
              <p className="mt-4 text-sm font-semibold text-text-secondary">
                Generated from the latest completed diagnosis and patient report.
              </p>
            </ClinicalCard>
            <ClinicalCard title="Avoid or limit" tone="warning">
              <ul className="grid gap-2">
                {plan.avoid.map((item) => (<li key={item}>{item}</li>))}
              </ul>
            </ClinicalCard>
            <ClinicalCard title="Diet caution">
              <div className="flex gap-3">
                <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-warning"/>
                <p>{plan.caution}</p>
              </div>
              {dietResult.warning ? (<p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  {dietResult.warning}
                </p>) : null}
            </ClinicalCard>
          </div>
        </div>) : (<ClinicalCard title="Diet plan not ready yet" tone="accent">
          <p>
            Complete a diagnosis session and generate a patient report first. KAMAL keeps diet lower priority and creates it from saved report context so it stays consistent.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ActionButton href="/session" icon={Salad} label="Start diagnosis session"/>
            <ActionButton href="/reports/demo" icon={Utensils} label="Open patient report" variant="soft"/>
          </div>
        </ClinicalCard>)}
    </AppShell>);
}
