import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PatientIntakeForm } from "@/components/PatientIntakeForm";
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken } from "@/lib/auth/sqliteStore";
export default async function SessionPage() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        redirect("/login?next=/session");
    }
    const intake = await getLatestPatientIntake(user.id);
    return (<AppShell description="Review the saved patient context before starting the doctor-style diagnosis flow." eyebrow="Diagnosis session" title="Start with your concern" variant="dark">
      <div className="grid gap-6">
        <PatientIntakeForm existingIntake={intake} startBlank startDiagnosisOnSubmit submitLabel="Start diagnosis" successMessage="Concern saved. You can start diagnosis now." />
      </div>
    </AppShell>);
}
