import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DiagnosisSession } from "@/components/DiagnosisSession";
import { DIAGNOSIS_SESSION_COOKIE, verifyDiagnosisSessionJwt } from "@/lib/auth/diagnosisSessionJwt";
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken, getConversationDraft } from "@/lib/auth/sqliteStore";

export default async function DiagnosisPage() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        redirect("/login?next=/session");
    }
    const intake = await getLatestPatientIntake(user.id);
    if (!intake) {
        redirect("/session");
    }
    const hasDiagnosisSession = verifyDiagnosisSessionJwt(cookieStore.get(DIAGNOSIS_SESSION_COOKIE)?.value, {
        userId: user.id,
        intakeId: intake.id
    });
    if (!hasDiagnosisSession) {
        redirect("/session");
    }
    const draft = await getConversationDraft(user.id,intake.id);
    return (<AppShell description="Talk through your concern, keep the useful context, and prepare questions for your clinician." eyebrow="ASK KAMAL" title="A conversation that remembers">
      <DiagnosisSession intake={intake} user={user} draft={draft}/>
    </AppShell>);
}
