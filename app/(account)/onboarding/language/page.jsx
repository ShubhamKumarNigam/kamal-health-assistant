import { AppShell } from "@/components/AppShell";
import { LanguageSelectionGrid } from "@/components/LanguageSelectionGrid";
import { WellnessVisual } from "@/components/WellnessVisual";
export default function LanguagePage() {
    return (<AppShell description="Choose the language for questions, guidance, reminders, and the patient report. You can switch later." eyebrow="Step 1" title="Choose your language">
      <div className="grid gap-6 lg:grid-cols-[1fr_.85fr]">
        <LanguageSelectionGrid />
        <WellnessVisual />
      </div>
    </AppShell>);
}
