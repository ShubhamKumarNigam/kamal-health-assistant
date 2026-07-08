import { AlertTriangle, BookOpenCheck, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ClinicalCard } from "@/components/ClinicalCard";
import { HealthEducationSearch } from "@/components/HealthEducationSearch";

export default function SearchPage() {
    return (<AppShell description="Ask patient-friendly health education questions about symptoms, prevention, tests, treatments, and when to seek care." eyebrow="Health education" title="Medical question search">
      <div className="grid gap-6 lg:grid-cols-[1fr_.38fr]">
        <HealthEducationSearch />

        <aside className="space-y-5">
          <ClinicalCard title="How to use it" tone="accent">
            <div className="flex gap-3">
              <BookOpenCheck aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary"/>
              <p className="leading-7">
                Ask one clear medical education question. KAMAL uses the configured AI provider to explain the topic in simple language with safe next steps.
              </p>
            </div>
          </ClinicalCard>

          <ClinicalCard title="Safety note" tone="warning">
            <div className="flex gap-3">
              <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-emergency"/>
              <p className="leading-7">
                This is not a diagnosis. For chest pain, severe breathing difficulty, fainting, confusion, severe allergic reaction, stroke signs, or rapidly worsening symptoms, seek emergency care immediately.
              </p>
            </div>
          </ClinicalCard>

          <ClinicalCard title="Best for">
            <div className="flex gap-3">
              <ShieldCheck aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary"/>
              <p className="leading-7">
                General health learning, prevention questions, treatment basics, test explanations, and preparing questions before a doctor visit.
              </p>
            </div>
          </ClinicalCard>
        </aside>
      </div>
    </AppShell>);
}
