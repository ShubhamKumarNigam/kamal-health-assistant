export type Language = "en" | "ar" | "ur";
export type Verification = "unverified" | "verified";
export type Category =
  | "Laboratory Reports"
  | "Consultations"
  | "Prescriptions"
  | "Medications"
  | "Imaging"
  | "Diagnoses / Conditions"
  | "Allergies"
  | "Insurance"
  | "Vaccinations"
  | "Hospital Visits"
  | "Procedures"
  | "Wearable Reports"
  | "Other Documents";
export interface ExtractedField {
  label: string;
  value: string;
  source: string;
  confidence: number;
  verification: Verification;
}
export interface HealthDocument {
  id: string;
  title: string;
  date: string;
  category: Category;
  institution: string;
  country: string;
  summary: string;
  tags: string[];
  fields: ExtractedField[];
  text?: string;
  fileData?: string;
  mime?: string;
}
export interface Observation {
  id: string;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
  source: string;
  sourceDevice: string;
  confidence: number;
  referenceRange?: [number, number];
  personalBaseline?: number;
}
export interface Metric {
  id: string;
  label: string;
  value: string;
  unit: string;
  baseline: string;
  values: number[];
  month: number[];
  source: string;
  updated: string;
  note: string;
}
export interface Reminder {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  complete: boolean;
}
export interface FamilyHistory {
  id: string;
  relationship: string;
  condition: string;
  consent: boolean;
}
export interface Patient {
  id: string;
  name: string;
  age: number;
  location: string;
  synthetic: boolean;
}
export interface Condition {
  id: string;
  name: string;
  source: string;
  verification: Verification;
}
export interface Medication {
  id: string;
  name: string;
  instructions: string;
  source: string;
}
export interface Allergy {
  id: string;
  substance: string;
  reaction: string;
  source: string;
}
export interface Consent {
  id: string;
  purpose: string;
  granted: boolean;
  timestamp: string;
}
export interface ShareGrant {
  id: string;
  expiresAt: string;
  status: "simulated" | "revoked";
}
export interface Encounter {
  id: string;
  date: string;
  reason: string;
  source: string;
}
export type Appointment = Reminder;
export interface DiagnosticReport {
  id: string;
  documentId: string;
  fields: ExtractedField[];
}
export interface MedicationRequest extends Medication {
  date: string;
}
export interface Immunization {
  id: string;
  name: string;
  date: string;
  source: string;
}
export interface Procedure extends Immunization {
  reason: string;
}
export interface CarePlan {
  id: string;
  reminders: Reminder[];
}
export type WearableObservation = Observation;
export interface AIInsight {
  id: string;
  title: string;
  level: "Information" | "Attention" | "Urgent";
  reason: string;
  source: string;
  period: string;
  action: string;
  uncertainty: string;
}
export interface Message {
  role: "user" | "assistant";
  text: string;
}
export interface ConversationState {
  chiefConcern: string;
  duration: string;
  severity: string;
  relevantSymptoms: string[];
  redFlags: string[];
  relevantHistory: string[];
  medications: string[];
  allergies: string[];
  missingCriticalInformation: string[];
  questionCount: number;
  confidence: number;
  stage: "start" | "followup" | "summary" | "urgent";
}
export interface Conversation {
  messages: Message[];
  state: ConversationState;
}
export interface HealthStore {
  documents: HealthDocument[];
  reminders: Reminder[];
  family: FamilyHistory[];
  messages: Message[];
  contextConsent: boolean;
  conversation: ConversationState;
}
export function timeline(docs: HealthDocument[]) {
  return [...docs].sort((a, b) => b.date.localeCompare(a.date));
}
export function convert(value: number, from: string, to: string): number {
  if (from === to) return value;
  if (from === "mg/dL" && to === "mmol/L") return value / 18.0182;
  if (from === "lb" && to === "kg") return value * 0.45359237;
  throw new Error("Unsupported unit conversion");
}
export function baselineInsight(
  values: number[],
  baseline: number,
  threshold = 5,
): boolean {
  return (
    values.length >= 3 &&
    values.slice(-3).every((v) => v > baseline + threshold)
  );
}
export function emptyConversation(): ConversationState {
  return {
    chiefConcern: "",
    duration: "",
    severity: "",
    relevantSymptoms: [],
    redFlags: [],
    relevantHistory: [],
    medications: [],
    allergies: [],
    missingCriticalInformation: [],
    questionCount: 0,
    confidence: 0,
    stage: "start",
  };
}
export function reschedule(reminder: Reminder, days: number): Reminder {
  const d = new Date(reminder.date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return { ...reminder, date: d.toISOString().slice(0, 10), complete: false };
}
