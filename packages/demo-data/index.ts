import {
  emptyConversation,
  type HealthStore,
  type Metric,
  type AIInsight,
} from "../health-core";
export const DEMO_DATE = "2026-11-11";
export const patient = {
  id: "aisha-demo",
  name: "Aisha Rahman",
  age: 38,
  location: "Dubai, UAE",
  synthetic: true,
};
const field = (label: string, value: string, source: string) => ({
  label,
  value,
  source,
  confidence: 1,
  verification: "verified" as const,
});
export const seed: HealthStore = {
  contextConsent: false,
  conversation: emptyConversation(),
  messages: [],
  family: [
    {
      id: "f1",
      relationship: "Mother",
      condition: "Type 2 diabetes — patient reported",
      consent: false,
    },
  ],
  reminders: [
    {
      id: "r1",
      title: "Vitamin D · prescribed supplement",
      date: DEMO_DATE,
      time: "09:00",
      type: "Medication",
      complete: false,
    },
    {
      id: "r2",
      title: "Prepare questions for your GP",
      date: DEMO_DATE,
      time: "18:00",
      type: "Follow-up",
      complete: false,
    },
    {
      id: "r3",
      title: "GP follow-up · discuss fatigue",
      date: "2026-11-18",
      time: "10:30",
      type: "Appointment",
      complete: false,
    },
  ],
  documents: [
    {
      id: "lab-oct",
      title: "Your autumn blood panel",
      date: "2026-10-12",
      category: "Laboratory Reports",
      institution: "Demo Marina Clinic",
      country: "United Arab Emirates",
      summary:
        "This synthetic report records Vitamin D at 18 ng/mL, below the report’s stated range. Discuss the result and any follow-up with your clinician.",
      tags: ["Vitamin D", "Blood test"],
      fields: [
        field("Vitamin D", "18 ng/mL", "lab-oct, line 3"),
        field("Report reference range", "20–50 ng/mL", "lab-oct, line 4"),
        field("Haemoglobin", "12.8 g/dL", "lab-oct, line 5"),
      ],
      text: "SYNTHETIC DEMONSTRATION REPORT\nDate: 2026-10-12\nVitamin D: 18 ng/mL\nReference range: 20–50 ng/mL\nHaemoglobin: 12.8 g/dL",
    },
    {
      id: "gp-sep",
      title: "A conversation about fatigue",
      date: "2026-09-01",
      category: "Consultations",
      institution: "Demo Marina Clinic",
      country: "United Arab Emirates",
      summary:
        "Aisha reported persistent tiredness. The fictional clinician requested a blood panel and a follow-up review.",
      tags: ["Fatigue", "Follow-up"],
      fields: [field("Reason for visit", "Persistent fatigue", "gp-sep")],
      text: "SYNTHETIC consultation. Patient reports fatigue. Blood panel requested. Follow-up to review results.",
    },
    {
      id: "rx-aug",
      title: "Vitamin D prescription",
      date: "2026-08-15",
      category: "Prescriptions",
      institution: "Demo City Practice",
      country: "United Kingdom",
      summary:
        "A synthetic supplement prescription. Follow the original clinician’s instructions; this demo does not recommend doses.",
      tags: ["Medication"],
      fields: [
        field(
          "Medication",
          "Vitamin D supplement — see original prescription",
          "rx-aug",
        ),
      ],
      text: "SYNTHETIC prescription. Vitamin D supplement. Instructions: as prescribed by the treating clinician.",
    },
    {
      id: "insurance",
      title: "Health cover, together in one place",
      date: "2026-06-10",
      category: "Insurance",
      institution: "Demo Assurance",
      country: "United Arab Emirates",
      summary:
        "Fictional policy document for demonstrating record organisation. No real policy or coverage.",
      tags: ["Insurance"],
      fields: [],
      text: "SYNTHETIC INSURANCE DOCUMENT — not evidence of coverage.",
    },
    {
      id: "lab-mar",
      title: "Spring wellness blood test",
      date: "2026-03-18",
      category: "Laboratory Reports",
      institution: "Demo Family Lab",
      country: "India",
      summary:
        "Earlier synthetic Vitamin D result: 16 ng/mL. Both reports remain linked to their original sources.",
      tags: ["Vitamin D"],
      fields: [field("Vitamin D", "16 ng/mL", "lab-mar")],
      text: "SYNTHETIC blood test. Date: 2026-03-18. Vitamin D: 16 ng/mL.",
    },
    {
      id: "vax",
      title: "Vaccination record",
      date: "2025-11-02",
      category: "Vaccinations",
      institution: "Demo City Practice",
      country: "United Kingdom",
      summary: "Synthetic seasonal vaccination record.",
      tags: ["Prevention"],
      fields: [],
      text: "SYNTHETIC vaccination record. Seasonal vaccination documented.",
    },
  ],
};
function month(base: number, swing: number) {
  return Array.from(
    { length: 30 },
    (_, i) => Math.round((base + Math.sin(i * 1.8) * swing) * 10) / 10,
  );
}
export const metrics: Metric[] = [
  {
    id: "heart",
    label: "Heart rate",
    value: "72",
    unit: "bpm",
    baseline: "Personal baseline 68–76",
    values: [73, 71, 74, 70, 72, 75, 72],
    month: month(72, 4),
    source: "Demo wearable",
    updated: "11 Nov · 08:42",
    note: "Around your usual range",
  },
  {
    id: "sleep",
    label: "Sleep",
    value: "6h 42",
    unit: "min",
    baseline: "Personal baseline 7h 30m",
    values: [7.8, 7.3, 7.1, 6.9, 6.4, 6.8, 6.7],
    month: month(7.4, 0.8),
    source: "Demo wearable",
    updated: "11 Nov · 07:00",
    note: "A little less rest this week",
  },
  {
    id: "steps",
    label: "Daily steps",
    value: "6,240",
    unit: "steps",
    baseline: "Personal average 5,800",
    values: [4200, 6500, 5900, 7200, 5600, 6800, 6240],
    month: month(5800, 1600),
    source: "Demo wearable",
    updated: "11 Nov · 08:42",
    note: "Finding your daily rhythm",
  },
  {
    id: "bp",
    label: "Blood pressure",
    value: "118/76",
    unit: "mmHg",
    baseline: "Personal baseline 116/75",
    values: [116, 119, 115, 117, 120, 117, 118],
    month: month(117, 3),
    source: "Demo manual reading",
    updated: "11 Nov · 08:15",
    note: "Close to your recent baseline",
  },
  {
    id: "resting",
    label: "Resting heart rate",
    value: "68",
    unit: "bpm",
    baseline: "30-day personal baseline 61",
    values: [60, 62, 61, 63, 67, 68, 68],
    month: [...month(61, 1).slice(0, 27), 67, 68, 68],
    source: "Demo wearable",
    updated: "11 Nov · 07:00",
    note: "Above baseline for 3 days",
  },
  {
    id: "weight",
    label: "Weight",
    value: "64.2",
    unit: "kg",
    baseline: "Personal baseline 64.5",
    values: [64.6, 64.4, 64.5, 64.3, 64.4, 64.2, 64.2],
    month: month(64.5, 0.3),
    source: "Demo manual reading",
    updated: "10 Nov · 08:00",
    note: "Your recent pattern",
  },
  {
    id: "oxygen",
    label: "Oxygen saturation",
    value: "98",
    unit: "%",
    baseline: "Personal baseline 97–99",
    values: [98, 98, 97, 99, 98, 98, 98],
    month: month(98, 0.5),
    source: "Demo wearable",
    updated: "11 Nov · 08:42",
    note: "Near your usual readings",
  },
  {
    id: "adherence",
    label: "Care plan completion",
    value: "86",
    unit: "%",
    baseline: "Demo 7-day completion",
    values: [71, 86, 86, 100, 71, 100, 86],
    month: month(86, 10),
    source: "Synthetic care history",
    updated: "11 Nov · 09:00",
    note: "6 of 7 planned check-ins",
  },
];
export const insights: AIInsight[] = [
  {
    id: "i1",
    title: "Your resting heart rate is a little higher",
    level: "Attention",
    reason:
      "The last 3 readings (67, 68, 68 bpm) are more than 5 bpm above your 30-day baseline of 61 bpm.",
    source: "Demo wearable · resting heart rate",
    period: "9–11 November 2026",
    action:
      "Check how you feel and consider discussing a persistent change with your healthcare professional.",
    uncertainty:
      "Synthetic trend; wearable measurements can be affected by fit, activity and other factors. This is not a diagnosis.",
  },
  {
    id: "i2",
    title: "A little context for your next appointment",
    level: "Information",
    reason:
      "Your October Vitamin D report is the newest stored result. Your GP follow-up is on 18 November.",
    source: "Blood panel · 12 October / care plan",
    period: "12 October–18 November 2026",
    action: "Bring the original report and your questions to your follow-up.",
    uncertainty:
      "Based only on records stored here; other results may be missing.",
  },
];
export function freshDemo(): HealthStore {
  return structuredClone(seed);
}
export function getInsights(store: HealthStore): AIInsight[] {
  const result = structuredClone(insights);
  const newest = [...store.documents]
    .filter((d) => d.category === "Laboratory Reports")
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const next = store.reminders
    .filter((r) => !r.complete && r.type === "Appointment")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (newest) {
    result[1].reason = `Your newest stored laboratory report is “${newest.title}”, dated ${newest.date}.${next ? ` Your next recorded appointment is ${next.date}.` : ""}`;
    result[1].source = `${newest.title} · ${newest.date} [${newest.id}]`;
    result[1].period = next ? `${newest.date}–${next.date}` : newest.date;
  }
  return result;
}
