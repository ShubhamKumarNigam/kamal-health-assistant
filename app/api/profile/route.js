import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, getUserBySessionToken, updateUserProfile } from "@/lib/auth/sqliteStore";

export const runtime = "nodejs";

export async function PUT(request) {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
    }
    const result = await updateUserProfile(user.id, await request.json().catch(() => ({})));
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
