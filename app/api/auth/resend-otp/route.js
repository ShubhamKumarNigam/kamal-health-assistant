import { NextResponse } from "next/server";
import { resendOtp } from "@/lib/auth/sqliteStore";
export async function POST(request) {
    const result = await resendOtp(await request.json());
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
