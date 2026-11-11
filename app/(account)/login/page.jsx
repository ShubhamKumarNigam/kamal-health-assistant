import { phoneAuthConfigured } from "@/lib/auth/phoneProvider";
import { AuthFlow } from "@/components/AuthFlow";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { initializeAuthDatabase, SESSION_COOKIE, getUserBySessionToken } from "@/lib/auth/sqliteStore";
function isSafeNextPath(path) {
    return path?.startsWith("/") && !path.startsWith("//") && !path.startsWith("/login");
}
export default async function LoginPage({ searchParams }) {
    const { authError, next, signedOut, mode } = await searchParams;
    await initializeAuthDatabase();
    const safeNextPath = isSafeNextPath(next) ? next : "/workspace";
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (user) {
        redirect(safeNextPath);
    }
    const demoEmail = process.env.KAMAL_DEMO_EMAIL?.trim() || "";
    return (
        <AuthFlow
            phoneEnabled={phoneAuthConfigured()}
            demoEmail={demoEmail}
            initialMode={mode === "signup" ? "signup" : "signin"}
            forceGooglePrompt={signedOut === "1"}
            initialError={authError}
            initialMessage={signedOut === "1" ? "You have been logged out. Sign in again with Google or email." : ""}
            nextPath={safeNextPath}
        />
    );
}
