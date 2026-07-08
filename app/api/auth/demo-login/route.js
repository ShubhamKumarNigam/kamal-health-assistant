import { NextResponse } from "next/server";
import {
    SESSION_COOKIE,
    createSessionCookieValue,
    ensureConfiguredDemoUser,
    login
} from "@/lib/auth/sqliteStore";

export async function POST(request) {
    const demoResult = await ensureConfiguredDemoUser();
    if (!demoResult.ok) {
        return NextResponse.json(demoResult, { status: demoResult.status });
    }
    const result = await login({
        email: demoResult.email,
        password: process.env.KAMAL_DEMO_PASSWORD || ""
    });
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
