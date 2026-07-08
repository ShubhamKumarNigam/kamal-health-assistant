import { NextResponse } from "next/server";
import { forgotPassword } from "@/lib/auth/sqliteStore";
export async function POST(request) {
    const result = await forgotPassword(await request.json());
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
