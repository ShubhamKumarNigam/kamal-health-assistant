import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendPatientReportEmail } from "@/lib/auth/resendEmail";
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken, listDiagnosisSessions, validateEmail } from "@/lib/auth/sqliteStore";
import { buildPatientReport } from "@/lib/patientReport";

export const runtime = "nodejs";

export async function POST(request) {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        return NextResponse.json({ ok: false, message: "Please sign in before emailing a report." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const recipientEmail = String(body.recipientEmail || body.doctorEmail || "").trim();
    const to = recipientEmail || user.email;
    if (!validateEmail(to)) {
        return NextResponse.json({ ok: false, message: "Enter a valid email address." }, { status: 400 });
    }

    const intake = await getLatestPatientIntake(user.id);
    const diagnosisSessions = await listDiagnosisSessions(user.id);
    if (!diagnosisSessions.length) {
        return NextResponse.json({ ok: false, message: "No completed diagnosis history is available for this report." }, { status: 400 });
    }
    const latestSession = diagnosisSessions[0] || null;
    const reportResult = await buildPatientReport({ user, intake, latestSession, diagnosisSessions });
    const result = await sendPatientReportEmail({
        to,
        recipientName: recipientEmail ? "Recipient" : user.name,
        report: reportResult.report,
        text: reportResult.text
    });
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
