import { encrypt, decrypt, type Envelope } from "../security";
import type { HealthStore } from "../health-core";
const KEY = "kamal.encrypted.v1";
export async function persist(store: HealthStore, password: string) {
  const envelope = await encrypt(store, password);
  localStorage.setItem(KEY, JSON.stringify(envelope));
}
export async function restore(password: string) {
  const raw = localStorage.getItem(KEY);
  if (!raw) throw new Error("No saved vault on this browser.");
  return decrypt<HealthStore>(JSON.parse(raw) as Envelope, password);
}
export function hasVault() {
  return !!localStorage.getItem(KEY);
}
export function deleteVault() {
  localStorage.removeItem(KEY);
}
