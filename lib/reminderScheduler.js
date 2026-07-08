import { sendMedicationReminderEmail } from "@/lib/auth/resendEmail";
import {
    listDueMedicationReminders,
    listScheduledMedicationReminders,
    markMedicationReminderFailed,
    markMedicationReminderSent,
    rescheduleMedicationReminder
} from "@/lib/auth/sqliteStore";

const timers = globalThis.__kamalReminderTimers || new Map();
globalThis.__kamalReminderTimers = timers;

function clearReminderTimer(id) {
    const timer = timers.get(id);
    if (timer) {
        clearTimeout(timer);
        timers.delete(id);
    }
}

function parseWeekdays(value) {
    if (Array.isArray(value)) {
        return value;
    }
    try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}

function dateOnly(value, endOfDay = false) {
    if (!value) {
        return null;
    }
    const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function wholeDaysBetween(start, end) {
    const startDay = new Date(start);
    const endDay = new Date(end);
    startDay.setHours(0, 0, 0, 0);
    endDay.setHours(0, 0, 0, 0);
    return Math.floor((endDay.getTime() - startDay.getTime()) / 86400000);
}

function addCustomInterval(date, interval, unit) {
    const next = new Date(date);
    if (unit === "month") {
        next.setMonth(next.getMonth() + interval);
        return next;
    }
    next.setDate(next.getDate() + interval * (unit === "week" ? 7 : 1));
    return next;
}

function nextCustomRecurringDate(reminder) {
    const interval = Math.max(1, Number.parseInt(reminder.custom_interval, 10) || 1);
    const unit = reminder.custom_unit || "day";
    const start = dateOnly(reminder.schedule_start_date);
    const end = dateOnly(reminder.schedule_end_date, true);
    const current = new Date(reminder.scheduled_at);
    if (!start || !end || current.getTime() > end.getTime()) {
        return null;
    }
    if (unit === "week") {
        const weekdays = parseWeekdays(reminder.custom_weekdays_json);
        if (weekdays.length === 0) {
            return null;
        }
        const selected = new Set(weekdays);
        const candidate = new Date(current);
        for (let attempt = 0; attempt < 3700; attempt += 1) {
            candidate.setDate(candidate.getDate() + 1);
            if (candidate.getTime() > end.getTime()) {
                return null;
            }
            const weekIndex = Math.floor(Math.max(0, wholeDaysBetween(start, candidate)) / 7);
            if (weekIndex % interval === 0 && selected.has(candidate.getDay())) {
                return candidate;
            }
        }
        return null;
    }
    const next = addCustomInterval(current, interval, unit);
    return next.getTime() <= end.getTime() ? next : null;
}

function nextRecurringDate(reminder) {
    const repeatRule = reminder.repeat_rule || "none";
    if (repeatRule === "none") {
        return null;
    }
    if (repeatRule === "custom") {
        return nextCustomRecurringDate(reminder);
    }
    const next = new Date(reminder.scheduled_at);
    const now = Date.now();
    while (next.getTime() <= now) {
        if (repeatRule === "daily") {
            next.setDate(next.getDate() + 1);
        }
        else if (repeatRule === "weekly") {
            next.setDate(next.getDate() + 7);
        }
        else if (repeatRule === "monthly") {
            next.setMonth(next.getMonth() + 1);
        }
        else if (repeatRule === "yearly") {
            next.setFullYear(next.getFullYear() + 1);
        }
        else if (repeatRule === "weekdays") {
            do {
                next.setDate(next.getDate() + 1);
            } while (next.getDay() === 0 || next.getDay() === 6);
        }
        else {
            return null;
        }
    }
    return next;
}

async function sendDueReminder(reminder) {
    clearReminderTimer(reminder.id);
    const result = await sendMedicationReminderEmail({
        to: reminder.user_email,
        name: reminder.user_name,
        medicineName: reminder.medicine_name,
        scheduledAt: reminder.scheduled_at,
        details: reminder.details
    });
    if (result.ok) {
        const nextDate = nextRecurringDate(reminder);
        if (nextDate) {
            rescheduleMedicationReminder(reminder.id, nextDate);
            scheduleMedicationReminder({ ...reminder, scheduled_at: nextDate.toISOString() });
            return;
        }
        markMedicationReminderSent(reminder.id);
        return;
    }
    markMedicationReminderFailed(reminder.id, result.message);
}

export async function processDueMedicationReminders() {
    const due = listDueMedicationReminders();
    for (const reminder of due) {
        await sendDueReminder(reminder);
    }
}

export function scheduleMedicationReminder(reminder) {
    clearReminderTimer(reminder.id);
    const delay = new Date(reminder.scheduled_at).getTime() - Date.now();
    if (delay <= 0) {
        processDueMedicationReminders().catch((error) => {
            console.error("Medication reminder processing failed", error);
        });
        return;
    }
    const timer = setTimeout(() => {
        sendDueReminder(reminder).catch((error) => {
            markMedicationReminderFailed(reminder.id, error instanceof Error ? error.message : "Email failed");
            console.error("Medication reminder send failed", error);
        });
    }, delay);
    timers.set(reminder.id, timer);
}

export function refreshMedicationReminderSchedules() {
    for (const reminder of listScheduledMedicationReminders()) {
        if (!timers.has(reminder.id)) {
            scheduleMedicationReminder(reminder);
        }
    }
}

export function cancelMedicationReminderSchedule(id) {
    clearReminderTimer(id);
}
