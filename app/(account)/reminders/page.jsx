import { AppShell } from "@/components/AppShell";
import { MedicationReminderManager } from "@/components/MedicationReminderManager";

export default function RemindersPage() {
    return (<AppShell description="Medication and consultation reminders favor Email or WhatsApp so patients do not need to habitually open the app." eyebrow="Follow-up" title="Reminders">
      <MedicationReminderManager />
    </AppShell>);
}
