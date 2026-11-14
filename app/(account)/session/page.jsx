import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PatientIntakeForm } from "@/components/PatientIntakeForm";
import { StartDiagnosisButton } from '@/components/StartDiagnosisButton';
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken } from "@/lib/auth/sqliteStore";
export default async function SessionPage() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        redirect("/login?next=/session");
    }
    const intake = await getLatestPatientIntake(user.id);
    return (<AppShell description="Start with a message. Your background details are optional, and you stay in control of what KAMAL remembers." eyebrow="ASK KAMAL" title="What’s on your mind?">
      <div className="grid gap-6">
        {intake && <div className="rounded-2xl border border-border bg-white p-5"><p className="mb-3">Return to your latest conversation with its saved context.</p><StartDiagnosisButton /></div>}
        <PatientIntakeForm existingIntake={intake} startDiagnosisOnSubmit submitLabel="Start a new conversation" />
      </div>
    </AppShell>);
}
