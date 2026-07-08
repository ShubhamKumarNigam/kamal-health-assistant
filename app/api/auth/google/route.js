import crypto from "crypto";
import { NextResponse } from "next/server";
import { GOOGLE_OAUTH_STATE_COOKIE, authErrorRedirect, getGoogleOAuthConfig, isSafeNextPath } from "@/lib/auth/googleOAuth";
import { SESSION_COOKIE, getUserBySessionToken } from "@/lib/auth/sqliteStore";
export const runtime = "nodejs";
function encodeStateCookie(state) {
    return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}
function isSecureRequest(request) {
    return request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
}
export async function GET(request) {
    const origin = request.nextUrl.origin;
    const nextPathParam = request.nextUrl.searchParams.get("next");
    const nextPath = isSafeNextPath(nextPathParam) ? nextPathParam : "/session";
    const shouldPromptForAccount = request.nextUrl.searchParams.get("prompt") === "select_account";
    const existingUser = await getUserBySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (existingUser) {
        return NextResponse.redirect(new URL(nextPath, origin));
    }
    const config = getGoogleOAuthConfig(origin);
    if (!config.ok) {
        return NextResponse.redirect(authErrorRedirect(origin, config.message, nextPath));
    }
    const state = {
        nonce: crypto.randomBytes(24).toString("base64url"),
        nextPath
    };
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.searchParams.set("client_id", config.clientId);
    authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", "openid email profile");
    authorizationUrl.searchParams.set("state", state.nonce);
    if (shouldPromptForAccount) {
        authorizationUrl.searchParams.set("prompt", "select_account");
    }
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, encodeStateCookie(state), {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureRequest(request),
        maxAge: 10 * 60,
        path: "/"
    });
    return response;
}
