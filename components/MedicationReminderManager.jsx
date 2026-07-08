"use client";

import { CalendarClock, CheckCircle2, Clock3, Mail, MessageCircle, Pill, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const channels = ["Email", "WhatsApp"];
const repeatOptions = [
    { value: "none", label: "Does not repeat" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Annually" },
    { value: "weekdays", label: "Every weekday" },
    { value: "custom", label: "Custom date range" }
];
const customUnits = [
    { value: "day", label: "day" },
    { value: "week", label: "week" },
    { value: "month", label: "month" }
];
const weekdayOptions = [
    { value: 1, short: "M", label: "Monday" },
    { value: 2, short: "T", label: "Tuesday" },
    { value: 3, short: "W", label: "Wednesday" },
    { value: 4, short: "T", label: "Thursday" },
    { value: 5, short: "F", label: "Friday" },
    { value: 6, short: "S", label: "Saturday" },
    { value: 0, short: "S", label: "Sunday" }
];

function toDateTimeLocalValue(date) {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
}

function toDateInputValue(date) {
    return toDateTimeLocalValue(date).slice(0, 10);
}

function toTimeInputValue(date) {
    return toDateTimeLocalValue(date).slice(11, 16);
}

function combineDateAndTime(dateValue, timeValue) {
    if (!dateValue || !timeValue) {
        return null;
    }
    const date = new Date(`${dateValue}T${timeValue}`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dayDifference(startDate, candidateDate) {
    const start = new Date(startDate);
    const candidate = new Date(candidateDate);
    start.setHours(0, 0, 0, 0);
    candidate.setHours(0, 0, 0, 0);
    return Math.floor((candidate.getTime() - start.getTime()) / 86400000);
}

function addCustomStep(date, interval, unit) {
    const next = new Date(date);
    if (unit === "month") {
        next.setMonth(next.getMonth() + interval);
        return next;
    }
    next.setDate(next.getDate() + interval * (unit === "week" ? 7 : 1));
    return next;
}

function firstCustomOccurrence({ startDate, endDate, time, interval, unit, weekdays }) {
    const start = combineDateAndTime(startDate, time);
    const end = combineDateAndTime(endDate, "23:59");
    const every = Math.max(1, Number.parseInt(interval, 10) || 1);
    if (!start || !end || end.getTime() < start.getTime()) {
        return null;
    }
    if (unit === "week") {
        const selected = new Set(weekdays);
        if (selected.size === 0) {
            return null;
        }
        const candidate = new Date(start);
        for (let attempt = 0; attempt < 3700; attempt += 1) {
            if (candidate.getTime() > end.getTime()) {
                return null;
            }
            const weekIndex = Math.floor(Math.max(0, dayDifference(start, candidate)) / 7);
            if (candidate.getTime() > Date.now() && weekIndex % every === 0 && selected.has(candidate.getDay())) {
                return candidate;
            }
            candidate.setDate(candidate.getDate() + 1);
        }
        return null;
    }
    let candidate = new Date(start);
    while (candidate.getTime() <= Date.now()) {
        candidate = addCustomStep(candidate, every, unit);
        if (candidate.getTime() > end.getTime()) {
            return null;
        }
    }
    return candidate.getTime() <= end.getTime() ? candidate : null;
}

function formatSchedule(value) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}

function formatDateOnly(value) {
    if (!value) {
        return "Not set";
    }
    return new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date(`${value}T00:00:00`));
}

function customRepeatLabel(reminder) {
    if (reminder.repeatRule !== "custom") {
        return repeatOptions.find((item) => item.value === reminder.repeatRule)?.label || "Does not repeat";
    }
    const unit = reminder.customUnit || "day";
    const interval = Number(reminder.customInterval || 1);
    const plural = interval > 1 ? `${unit}s` : unit;
    const days = Array.isArray(reminder.customWeekdays) && reminder.customWeekdays.length
        ? ` on ${weekdayOptions.filter((day) => reminder.customWeekdays.includes(day.value)).map((day) => day.short).join(", ")}`
        : "";
    return `Every ${interval} ${plural}${days}`;
}

export function MedicationReminderManager() {
    const [medicineName, setMedicineName] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [channel, setChannel] = useState(channels[0]);
    const [repeatRule, setRepeatRule] = useState("none");
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");
    const [customTime, setCustomTime] = useState("");
    const [customInterval, setCustomInterval] = useState(1);
    const [customUnit, setCustomUnit] = useState("day");
    const [customWeekdays, setCustomWeekdays] = useState([]);
    const [details, setDetails] = useState("");
    const [reminders, setReminders] = useState([]);
    const [message, setMessage] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const minDateTime = useMemo(() => toDateTimeLocalValue(new Date()), []);

    async function loadReminders({ silent = false } = {}) {
        if (!silent) {
            setIsLoading(true);
        }
        try {
            const response = await fetch("/api/reminders", { cache: "no-store" });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.message || "Could not load reminders.");
            }
            setReminders(result.reminders);
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not load reminders.");
        }
        finally {
            if (!silent) {
                setIsLoading(false);
            }
        }
    }

    useEffect(() => {
        const defaultDate = new Date(Date.now() + 30 * 60 * 1000);
        setScheduledAt(toDateTimeLocalValue(defaultDate));
        setCustomStartDate(toDateInputValue(defaultDate));
        setCustomEndDate(toDateInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
        setCustomTime(toTimeInputValue(defaultDate));
        setCustomWeekdays([defaultDate.getDay()]);
        loadReminders();
        const timer = window.setInterval(() => {
            loadReminders({ silent: true });
        }, 30000);
        return () => window.clearInterval(timer);
    }, []);

    async function addReminder(event) {
        event.preventDefault();
        const name = medicineName.trim();
        const nextTime = repeatRule === "custom"
            ? firstCustomOccurrence({
                startDate: customStartDate,
                endDate: customEndDate,
                time: customTime,
                interval: customInterval,
                unit: customUnit,
                weekdays: customWeekdays
            })
            : new Date(scheduledAt);
        if (!name) {
            setMessage("Enter a reminder title before setting a reminder.");
            return;
        }
        if (!nextTime || Number.isNaN(nextTime.getTime()) || nextTime.getTime() <= Date.now()) {
            setMessage(repeatRule === "custom" ? "Choose a custom date range with at least one future reminder time." : "Choose a future reminder time.");
            return;
        }
        setIsSaving(true);
        try {
            const response = await fetch("/api/reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    medicineName: name,
                    scheduledAt: nextTime.toISOString(),
                    channel,
                    repeatRule,
                    scheduleStartDate: customStartDate,
                    scheduleEndDate: customEndDate,
                    customInterval,
                    customUnit,
                    customWeekdays,
                    details
                })
            });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.message || "Could not set reminder.");
            }
            setReminders((current) => [...current, result.reminder].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));
            setMedicineName("");
            const defaultDate = new Date(Date.now() + 30 * 60 * 1000);
            setScheduledAt(toDateTimeLocalValue(defaultDate));
            setCustomStartDate(toDateInputValue(defaultDate));
            setCustomEndDate(toDateInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
            setCustomTime(toTimeInputValue(defaultDate));
            setCustomInterval(1);
            setCustomUnit("day");
            setCustomWeekdays([defaultDate.getDay()]);
            setRepeatRule("none");
            setDetails("");
            setMessage(`${name} reminder set. KAMAL will email your account at the reminder time.`);
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not set reminder.");
        }
        finally {
            setIsSaving(false);
        }
    }

    async function markReminderTaken(id) {
        try {
            const response = await fetch(`/api/reminders/${id}`, { method: "PATCH" });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.message || "Could not mark reminder as taken.");
            }
            setReminders((current) => current.filter((item) => item.id !== id));
            setMessage(result.message || "Medication marked as taken.");
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not mark reminder as taken.");
        }
    }

    function toggleCustomWeekday(day) {
        setCustomWeekdays((current) => current.includes(day)
            ? current.filter((item) => item !== day)
            : [...current, day].sort((a, b) => a - b));
    }

    return (<>
      <section className="rounded-lg border border-border bg-surface p-5 shadow-soft">
        <form className="grid gap-5" onSubmit={addReminder}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-primary">
                <Pill aria-hidden="true" className="h-5 w-5"/>
                <p className="text-sm font-bold uppercase tracking-normal">
                  Medication reminder
                </p>
              </div>
              <h2 className="mt-2 text-2xl font-extrabold text-text-primary">
                Set a medicine reminder
              </h2>
              <p className="mt-2 leading-7 text-text-secondary">
                Add a medicine name, choose a future time, and pick the preferred channel. KAMAL sends an email reminder to your signed-in account when the time arrives.
              </p>
            </div>
            <button className="touch-target inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70" disabled={isSaving} type="submit">
              <Plus aria-hidden="true" className="h-5 w-5"/>
              <span>{isSaving ? "Setting reminder..." : "Set medication reminder"}</span>
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_.7fr]">
            <label>
              <span className="mb-2 block font-semibold text-text-primary">Reminder title</span>
              <input className="min-h-12 w-full rounded-lg border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none" onChange={(event) => setMedicineName(event.target.value)} placeholder="Medicine, appointment, or check-up" type="text" value={medicineName}/>
            </label>
            {repeatRule === "custom" ? (<div>
                <span className="mb-2 block font-semibold text-text-primary">Reminder time</span>
                <div className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-[#edf8ef] px-4 py-3 font-semibold text-[#324C4A]">
                  <CalendarClock aria-hidden="true" className="h-5 w-5 shrink-0"/>
                  Use custom schedule below
                </div>
              </div>) : (<label>
                <span className="mb-2 block font-semibold text-text-primary">Reminder time</span>
                <span className="kamal-light-control flex min-h-12 items-center gap-3 rounded-lg border border-border bg-[#edf8ef] px-4 py-2 focus-within:border-primary">
                  <CalendarClock aria-hidden="true" className="h-5 w-5 shrink-0 text-[#324C4A]"/>
                  <input className="kamal-light-control-input w-full bg-transparent py-1 font-semibold text-[#10231f] outline-none" min={minDateTime} onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt}/>
                </span>
              </label>)}
            <label>
              <span className="mb-2 block font-semibold text-text-primary">Reminder channel</span>
              <select className="min-h-12 w-full rounded-lg border border-border bg-[#edf8ef] px-4 py-3 font-semibold text-text-primary focus:border-primary focus:outline-none" onChange={(event) => setChannel(event.target.value)} value={channel}>
                {channels.map((item) => (<option key={item} value={item}>{item}</option>))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[.65fr_1fr]">
            <label>
              <span className="mb-2 block font-semibold text-text-primary">Repeat</span>
              <select className="min-h-12 w-full rounded-lg border border-border bg-[#edf8ef] px-4 py-3 font-semibold text-text-primary focus:border-primary focus:outline-none" onChange={(event) => setRepeatRule(event.target.value)} value={repeatRule}>
                {repeatOptions.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}
              </select>
            </label>
            <label>
              <span className="mb-2 block font-semibold text-text-primary">Details</span>
              <textarea className="min-h-24 w-full rounded-lg border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none" onChange={(event) => setDetails(event.target.value)} placeholder="Dose, location, doctor name, fasting instruction, or other notes" rows={3} value={details}/>
            </label>
          </div>

          {repeatRule === "custom" ? (<section className="rounded-lg border border-[#609665]/25 bg-[#F2FBF7] p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-normal text-primary">Custom schedule</p>
                  <h3 className="mt-1 text-xl font-extrabold text-text-primary">Repeat between selected dates</h3>
                </div>
                <p className="text-sm font-semibold text-text-secondary">
                  First reminder: {(() => {
                    const next = firstCustomOccurrence({
                        startDate: customStartDate,
                        endDate: customEndDate,
                        time: customTime,
                        interval: customInterval,
                        unit: customUnit,
                        weekdays: customWeekdays
                    });
                    return next ? formatSchedule(next) : "Choose a future slot";
                })()}
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label>
                  <span className="mb-2 block font-semibold text-text-primary">Start date</span>
                  <input className="min-h-12 w-full rounded-lg border border-border bg-white px-4 py-3 font-semibold text-text-primary focus:border-primary focus:outline-none" min={minDateTime.slice(0, 10)} onChange={(event) => setCustomStartDate(event.target.value)} type="date" value={customStartDate}/>
                </label>
                <label>
                  <span className="mb-2 block font-semibold text-text-primary">End date</span>
                  <input className="min-h-12 w-full rounded-lg border border-border bg-white px-4 py-3 font-semibold text-text-primary focus:border-primary focus:outline-none" min={customStartDate || minDateTime.slice(0, 10)} onChange={(event) => setCustomEndDate(event.target.value)} type="date" value={customEndDate}/>
                </label>
                <label>
                  <span className="mb-2 block font-semibold text-text-primary">Reminder time</span>
                  <input className="min-h-12 w-full rounded-lg border border-border bg-white px-4 py-3 font-semibold text-text-primary focus:border-primary focus:outline-none" onChange={(event) => setCustomTime(event.target.value)} type="time" value={customTime}/>
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[.45fr_.55fr_1fr]">
                <label>
                  <span className="mb-2 block font-semibold text-text-primary">Every</span>
                  <input className="min-h-12 w-full rounded-lg border border-border bg-white px-4 py-3 font-semibold text-text-primary focus:border-primary focus:outline-none" min="1" onChange={(event) => setCustomInterval(event.target.value)} type="number" value={customInterval}/>
                </label>
                <label>
                  <span className="mb-2 block font-semibold text-text-primary">Unit</span>
                  <select className="min-h-12 w-full rounded-lg border border-border bg-white px-4 py-3 font-semibold text-text-primary focus:border-primary focus:outline-none" onChange={(event) => setCustomUnit(event.target.value)} value={customUnit}>
                    {customUnits.map((unit) => (<option key={unit.value} value={unit.value}>{unit.label}</option>))}
                  </select>
                </label>
                <div>
                  <span className="mb-2 block font-semibold text-text-primary">Repeat days</span>
                  <div className="flex flex-wrap gap-2">
                    {weekdayOptions.map((day) => {
                        const isSelected = customWeekdays.includes(day.value);
                        return (<button aria-pressed={isSelected} className={`h-11 min-w-11 rounded-full border px-3 text-sm font-extrabold transition ${isSelected ? "border-primary bg-primary text-white" : "border-border bg-white text-text-primary hover:border-primary"}`} key={day.label} onClick={() => toggleCustomWeekday(day.value)} title={day.label} type="button">
                          {day.short}
                        </button>);
                    })}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-text-secondary">
                    Days are used for weekly custom schedules.
                  </p>
                </div>
              </div>
            </section>) : null}

          {message ? (<p className="rounded-lg bg-[#DAF8EF] px-4 py-3 text-sm font-bold text-[#10231f]">
              {message}
            </p>) : null}
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (<div className="rounded-lg border border-dashed border-border bg-surface p-6 text-text-secondary md:col-span-2 xl:col-span-3">
            Loading medication reminders...
          </div>) : reminders.length === 0 ? (<div className="rounded-lg border border-dashed border-border bg-surface p-6 text-text-secondary md:col-span-2 xl:col-span-3">
            No active medication reminders. Set a future time to add one here.
          </div>) : reminders.map((reminder) => {
            const ChannelIcon = reminder.channel === "Email" ? Mail : MessageCircle;
            const repeatLabel = customRepeatLabel(reminder);
            return (<article className="rounded-lg border border-border bg-surface p-5 shadow-soft" key={reminder.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-normal text-primary">
                    Reminder
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-text-primary">{reminder.title}</h2>
                </div>
                <Clock3 aria-hidden="true" className="h-6 w-6 shrink-0 text-primary"/>
              </div>
              <dl className="mt-4 grid gap-2 text-text-secondary">
                <div className="flex justify-between gap-4">
                  <dt>Time</dt>
                  <dd className="text-right font-semibold text-text-primary">{formatSchedule(reminder.scheduledAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Channel</dt>
                  <dd className="inline-flex items-center gap-2 font-semibold text-text-primary">
                    <ChannelIcon aria-hidden="true" className="h-4 w-4"/>
                    {reminder.channel}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Status</dt>
                  <dd className="font-semibold text-text-primary">{reminder.status}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Repeat</dt>
                  <dd className="text-right font-semibold text-text-primary">{repeatLabel}</dd>
                </div>
                {reminder.repeatRule === "custom" ? (<div className="flex justify-between gap-4">
                    <dt>Date range</dt>
                    <dd className="text-right font-semibold text-text-primary">
                      {formatDateOnly(reminder.scheduleStartDate)} - {formatDateOnly(reminder.scheduleEndDate)}
                    </dd>
                  </div>) : null}
              </dl>
              {reminder.details ? (<div className="mt-4 rounded-lg bg-[#DAF8EF] px-3 py-2 text-sm font-semibold leading-6 text-[#10231f]">
                  {reminder.details}
                </div>) : null}
              <div className="mt-5">
                <button className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#609665]/30 bg-[#DAF8EF] px-5 py-3 text-base font-semibold text-[#214D37] transition hover:border-primary" onClick={() => markReminderTaken(reminder.id)} type="button">
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5"/>
                  <span>Taken</span>
                </button>
              </div>
            </article>);
        })}
      </section>
    </>);
}
