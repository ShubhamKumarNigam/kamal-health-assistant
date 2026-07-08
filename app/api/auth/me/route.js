import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, getUserBySessionToken } from "@/lib/auth/sqliteStore";
export async function GET() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    return NextResponse.json({ ok: Boolean(user), user });
}
