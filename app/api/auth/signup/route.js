import { NextResponse } from "next/server";
import { signup } from "@/lib/auth/sqliteStore";
export async function POST(request) {
    const result = await signup(await request.json());
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
