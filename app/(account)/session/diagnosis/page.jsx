import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DiagnosisSession } from "@/components/DiagnosisSession";
import { DIAGNOSIS_SESSION_COOKIE, verifyDiagnosisSessionJwt } from "@/lib/auth/diagnosisSessionJwt";
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken } from "@/lib/auth/sqliteStore";

export default async function DiagnosisPage() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        redirect("/login?next=/session");
    }
    const intake = await getLatestPatientIntake(user.id);
    if (!intake?.mainConcern) {
        redirect("/session");
    }
    const hasDiagnosisSession = verifyDiagnosisSessionJwt(cookieStore.get(DIAGNOSIS_SESSION_COOKIE)?.value, {
        userId: user.id,
        intakeId: intake.id
    });
    if (!hasDiagnosisSession) {
        redirect("/session");
    }
    return (<AppShell description="Answer one focused follow-up at a time. KAMAL saves the completed diagnosis to history." eyebrow="Doctor follow-up" title="Diagnosis session" variant="dark">
      <DiagnosisSession intake={intake} user={user}/>
    </AppShell>);
}
