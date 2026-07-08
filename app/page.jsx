import { cookies } from "next/headers";
import { LandingPage } from "@/components/LandingPage";
import { SESSION_COOKIE, getUserBySessionToken } from "@/lib/auth/sqliteStore";

export default async function Home() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    return <LandingPage isLoggedIn={Boolean(user)} />;
}
