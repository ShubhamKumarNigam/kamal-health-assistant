import { NextResponse } from "next/server";
import { GOOGLE_OAUTH_STATE_COOKIE, authErrorRedirect, getGoogleOAuthConfig, readGoogleEmailVerified } from "@/lib/auth/googleOAuth";
import { SESSION_COOKIE, createSessionCookieValue, loginWithGoogle } from "@/lib/auth/sqliteStore";
export const runtime = "nodejs";
function decodeStateCookie(value) {
    if (!value)
        return null;
    try {
        return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    }
    catch {
        return null;
    }
}
function isSecureRequest(request) {
    return request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
}
async function exchangeCodeForToken(code, config) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: config.redirectUri
        }),
        cache: "no-store"
    });
    const result = (await response.json());
    if (!response.ok || !result.id_token) {
        throw new Error(result.error_description || result.error || "Google could not complete sign-in.");
    }
    return result.id_token;
}
async function verifyGoogleIdToken(idToken) {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, { cache: "no-store" });
    const result = (await response.json());
    if (!response.ok) {
        throw new Error(result.error_description || "Google could not verify your account.");
    }
    return result;
}
export async function GET(request) {
    const origin = request.nextUrl.origin;
    const stateCookie = decodeStateCookie(request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value);
    const nextPath = stateCookie?.nextPath || "/session";
    const clearCookie = {
        maxAge: 0,
        path: "/"
    };
    try {
        const config = getGoogleOAuthConfig(origin);
        if (!config.ok) {
            return NextResponse.redirect(authErrorRedirect(origin, config.message, nextPath));
        }
        const code = request.nextUrl.searchParams.get("code");
        const state = request.nextUrl.searchParams.get("state");
        const oauthError = request.nextUrl.searchParams.get("error");
        if (oauthError) {
            return NextResponse.redirect(authErrorRedirect(origin, "Google sign-in was cancelled.", nextPath));
        }
        if (!code || !stateCookie || state !== stateCookie.nonce) {
            return NextResponse.redirect(authErrorRedirect(origin, "Google sign-in expired. Please try again.", nextPath));
        }
        const idToken = await exchangeCodeForToken(code, config);
        const tokenInfo = await verifyGoogleIdToken(idToken);
        const issuerIsValid = tokenInfo.iss === "accounts.google.com" || tokenInfo.iss === "https://accounts.google.com";
        const expiresAt = tokenInfo.exp ? Number(tokenInfo.exp) * 1000 : 0;
        if (!issuerIsValid || tokenInfo.aud !== config.clientId || expiresAt < Date.now()) {
            return NextResponse.redirect(authErrorRedirect(origin, "Google sign-in could not be trusted.", nextPath));
        }
        if (!tokenInfo.sub || !tokenInfo.email) {
            return NextResponse.redirect(authErrorRedirect(origin, "Google did not return an email account.", nextPath));
        }
        const result = await loginWithGoogle({
            googleSub: tokenInfo.sub,
            name: tokenInfo.name || tokenInfo.email,
            email: tokenInfo.email,
            emailVerified: readGoogleEmailVerified(tokenInfo.email_verified),
            avatarUrl: tokenInfo.picture || null
        });
        if (!result.ok || !result.sessionToken) {
            return NextResponse.redirect(authErrorRedirect(origin, result.ok ? "Google sign-in did not create a session." : result.message, nextPath));
        }
        const response = NextResponse.redirect(new URL(nextPath, origin));
        response.cookies.set(SESSION_COOKIE, createSessionCookieValue(result.sessionToken), {
            httpOnly: true,
            sameSite: "lax",
            secure: isSecureRequest(request),
            maxAge: 30 * 24 * 60 * 60,
            path: "/"
        });
        response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", clearCookie);
        return response;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Google sign-in failed. Please try again.";
        const response = NextResponse.redirect(authErrorRedirect(origin, message, nextPath));
        response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", clearCookie);
        return response;
    }
}
