import { Bell, FileText, HeartPulse } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { AppShell } from "@/components/AppShell";
import { ClinicalCard } from "@/components/ClinicalCard";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { diagnosisResult } from "@/lib/mockData";
export default function DiagnosisPage() {
    return (<AppShell description="The result uses KAMAL's calm text-first styling with clear reasoning, next steps, confidence, and a doctor-confirmation note." eyebrow="Assessment" title="Demo diagnosis result" variant="dark">
      <div className="grid gap-6 lg:grid-cols-[1fr_.42fr]">
        <section className="space-y-4">
          <ClinicalCard title="Likely condition" variant="dark">
            <ol className="space-y-3">
              {diagnosisResult.likelyConditions.map((condition, index) => (<li className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-3" key={condition}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#ADF8EF] text-sm font-extrabold text-primary">{index + 1}</span>
                  <span className="font-extrabold text-white">{condition}</span>
                </li>))}
            </ol>
          </ClinicalCard>
          <ClinicalCard title="Clinical reasoning" variant="dark">
            <p>{diagnosisResult.reasoning}</p>
          </ClinicalCard>
          <ClinicalCard title="Recommended next step" tone="accent" variant="dark">
            <p>{diagnosisResult.recommendedNextStep}</p>
          </ClinicalCard>
          <ClinicalCard title="Important note" variant="dark">
            <p>{diagnosisResult.disclaimerText}</p>
          </ClinicalCard>
        </section>

        <aside className="space-y-4">
          <ClinicalCard title="Confidence" variant="dark">
            <ConfidenceMeter level={diagnosisResult.confidenceLevel} variant="dark"/>
          </ClinicalCard>
          <ClinicalCard title="After diagnosis" variant="dark">
            <div className="space-y-3">
              <ActionButton href="/reminders" icon={Bell} label="Set reminders" variant="soft"/>
              <ActionButton href="/reports/demo" icon={FileText} label="Open report" variant="light"/>
              <ActionButton href="/session" icon={HeartPulse} label="Continue session" variant="light"/>
            </div>
          </ClinicalCard>
        </aside>
      </div>
    </AppShell>);
}
