import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, getLatestPatientIntake, getUserBySessionToken, savePatientIntake } from "@/lib/auth/sqliteStore";

export const runtime = "nodejs";

export async function GET() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
    }
    return NextResponse.json({ ok: true, intake: await getLatestPatientIntake(user.id) });
}

export async function POST(request) {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
    }
    const result = await savePatientIntake(user.id, await request.json());
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
