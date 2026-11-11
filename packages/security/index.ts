const encoder = new TextEncoder();
export interface Envelope {
  version: 1;
  salt: number[];
  iv: number[];
  ciphertext: number[];
}
async function derive(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 310000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encrypt(
  data: unknown,
  passphrase: string,
): Promise<Envelope> {
  if (passphrase.length < 10) throw new Error("Use at least 10 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(data)),
  );
  return {
    version: 1,
    salt: [...salt],
    iv: [...iv],
    ciphertext: [...new Uint8Array(ciphertext)],
  };
}
export async function decrypt<T>(
  envelope: Envelope,
  passphrase: string,
): Promise<T> {
  if (envelope.version !== 1) throw new Error("Unsupported vault version");
  const key = await derive(passphrase, new Uint8Array(envelope.salt));
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(envelope.iv) },
    key,
    new Uint8Array(envelope.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(raw)) as T;
}
