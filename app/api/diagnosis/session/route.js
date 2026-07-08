import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DIAGNOSIS_SESSION_COOKIE, createDiagnosisSessionJwt, diagnosisSessionCookieOptions } from "@/lib/auth/diagnosisSessionJwt";
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken } from "@/lib/auth/sqliteStore";

export const runtime = "nodejs";

export async function POST(request) {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        return NextResponse.json({ ok: false, message: "Please sign in before starting diagnosis." }, { status: 401 });
    }
    const intake = getLatestPatientIntake(user.id);
    if (!intake?.mainConcern) {
        return NextResponse.json({ ok: false, message: "Save your concern before starting diagnosis." }, { status: 400 });
    }
    const token = createDiagnosisSessionJwt({ userId: user.id, intakeId: intake.id });
    const response = NextResponse.json({ ok: true, redirectTo: "/session/diagnosis" });
    response.cookies.set(DIAGNOSIS_SESSION_COOKIE, token, diagnosisSessionCookieOptions(request));
    return response;
}
