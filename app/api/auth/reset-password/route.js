import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionCookieValue, resetPassword } from "@/lib/auth/sqliteStore";
export async function POST(request) {
    const result = await resetPassword(await request.json());
    const body = result.ok
        ? { ...result, sessionToken: undefined, authenticated: Boolean(result.sessionToken) }
        : result;
    const response = NextResponse.json(body, { status: result.ok ? 200 : result.status });
    if (result.ok && result.sessionToken) {
        const isSecureRequest = request.headers.get("x-forwarded-proto") === "https" ||
            new URL(request.url).protocol === "https:";
        response.cookies.set(SESSION_COOKIE, createSessionCookieValue(result.sessionToken), {
            httpOnly: true,
            sameSite: "lax",
            secure: isSecureRequest,
            maxAge: 30 * 24 * 60 * 60,
            path: "/"
        });
    }
    return response;
}
