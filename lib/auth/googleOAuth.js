export const GOOGLE_OAUTH_STATE_COOKIE = "kamal_google_oauth_state";
export function getGoogleOAuthConfig(origin) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${origin}/api/auth/google/callback`;
    if (!clientId && !clientSecret) {
        return {
            ok: false,
            message: "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local."
        };
    }
    if (!clientId) {
        return {
            ok: false,
            message: "Google sign-in is missing GOOGLE_CLIENT_ID in .env.local."
        };
    }
    if (!clientSecret) {
        return {
            ok: false,
            message: "Google sign-in is missing GOOGLE_CLIENT_SECRET in .env.local."
        };
    }
    return {
        ok: true,
        clientId,
        clientSecret,
        redirectUri
    };
}
export function isSafeNextPath(path) {
    return Boolean(path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/login"));
}
export function authErrorRedirect(origin, message, nextPath = "/session") {
    const url = new URL("/login", origin);
    url.searchParams.set("next", isSafeNextPath(nextPath) ? nextPath : "/session");
    url.searchParams.set("authError", message);
    return url;
}
export function readGoogleEmailVerified(value) {
    return value === true || value === "true";
}
