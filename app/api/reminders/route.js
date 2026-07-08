import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createMedicationReminder, listActiveMedicationReminders, SESSION_COOKIE, getUserBySessionToken } from "@/lib/auth/sqliteStore";
import { processDueMedicationReminders, refreshMedicationReminderSchedules, scheduleMedicationReminder } from "@/lib/reminderScheduler";

export const runtime = "nodejs";

async function currentUser() {
    const cookieStore = await cookies();
    return getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function GET() {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
    }
    await processDueMedicationReminders();
    await refreshMedicationReminderSchedules();
    return NextResponse.json({ ok: true, reminders: await listActiveMedicationReminders(user.id) });
}

export async function POST(request) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
    }
    await processDueMedicationReminders();
    const result = await createMedicationReminder(user.id, await request.json());
    if (result.ok) {
        const scheduled = {
            id: result.reminder.id,
            medicine_name: result.reminder.title,
            scheduled_at: result.reminder.scheduledAt,
            channel: result.reminder.channel,
            repeat_rule: result.reminder.repeatRule,
            schedule_start_date: result.reminder.scheduleStartDate,
            schedule_end_date: result.reminder.scheduleEndDate,
            custom_interval: result.reminder.customInterval,
            custom_unit: result.reminder.customUnit,
            custom_weekdays_json: JSON.stringify(result.reminder.customWeekdays || []),
            details: result.reminder.details,
            user_name: user.name,
            user_email: user.email
        };
        scheduleMedicationReminder(scheduled);
    }
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
