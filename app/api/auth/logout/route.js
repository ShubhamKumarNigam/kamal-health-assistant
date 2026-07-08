import { NextResponse } from "next/server";
import { DIAGNOSIS_SESSION_COOKIE } from "@/lib/auth/diagnosisSessionJwt";
import { SESSION_COOKIE, revokeSession } from "@/lib/auth/sqliteStore";
export async function POST(request) {
    const token = request.headers
        .get("cookie")
        ?.split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
        ?.split("=")[1];
    await revokeSession(token);
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE);
    response.cookies.delete(DIAGNOSIS_SESSION_COOKIE);
    return response;
}
