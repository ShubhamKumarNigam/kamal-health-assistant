import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import type { HealthStore } from "../../packages/health-core";
const KEY = "kamal-vault-key";
let db: SQLite.SQLiteDatabase | null = null;
export async function openVault() {
  const database = await SQLite.openDatabaseAsync("kamal-v1.db");
  const cipher = await database.getFirstAsync<Record<string, string>>(
    "PRAGMA cipher_version",
  );
  if (!cipher || !Object.values(cipher).some(Boolean)) {
    await database.closeAsync();
    throw new Error(
      "Encrypted storage requires a native SQLCipher development build. Expo Go is not supported.",
    );
  }
  let key = await SecureStore.getItemAsync(KEY);
  if (!key) {
    key = Array.from(await Crypto.getRandomBytesAsync(32), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    await SecureStore.setItemAsync(KEY, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (!/^[0-9a-f]{64}$/.test(key)) {
    await database.closeAsync();
    throw new Error("Invalid local encryption key");
  }
  await database.execAsync(
    `PRAGMA key = "x'${key}'"; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS vault (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);`,
  );
  db = database;
  const row = await db.getFirstAsync<{ payload: string }>(
    "SELECT payload FROM vault WHERE id = 1",
  );
  return row ? (JSON.parse(row.payload) as HealthStore) : null;
}
export async function saveVault(data: HealthStore) {
  if (!db) throw new Error("Vault is locked");
  await db.runAsync(
    "INSERT INTO vault(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
    JSON.stringify(data),
  );
}
export async function closeVault() {
  const current = db;
  db = null;
  if (current) await current.closeAsync();
}
export async function eraseVault() {
  await closeVault();
  await SQLite.deleteDatabaseAsync("kamal-v1.db");
  await SecureStore.deleteItemAsync(KEY);
}
