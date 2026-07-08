import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendHistorySummaryEmail } from "@/lib/auth/resendEmail";
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken, listDiagnosisSessions } from "@/lib/auth/sqliteStore";
import { buildHistorySummary } from "@/lib/historySummary";

export const runtime = "nodejs";

export async function POST() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        return NextResponse.json({ ok: false, message: "Please sign in before emailing history." }, { status: 401 });
    }
    const intake = getLatestPatientIntake(user.id);
    const diagnosisSessions = listDiagnosisSessions(user.id);
    const latestDiagnosisSessions = diagnosisSessions.slice(0, 1);
    const summary = buildHistorySummary({
        patientName: user.name,
        patientEmail: user.email,
        intake,
        diagnosisSessions: latestDiagnosisSessions
    });
    const result = await sendHistorySummaryEmail({
        to: user.email,
        name: user.name,
        summary,
        latestSession: latestDiagnosisSessions[0] || null
    });
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
