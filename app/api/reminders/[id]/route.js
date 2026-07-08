import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, getUserBySessionToken, markMedicationReminderTaken } from "@/lib/auth/sqliteStore";
import { cancelMedicationReminderSchedule, processDueMedicationReminders } from "@/lib/reminderScheduler";

export const runtime = "nodejs";

export async function PATCH(_request, { params }) {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
    }
    await processDueMedicationReminders();
    const { id } = await params;
    const result = markMedicationReminderTaken(user.id, id);
    if (result.ok) {
        cancelMedicationReminderSchedule(id);
    }
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
