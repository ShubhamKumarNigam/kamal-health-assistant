import crypto from "crypto";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { OTP_COOLDOWN_SECONDS, OTP_EXPIRES_MINUTES } from "@/lib/auth/config";
import { sendOtpEmail } from "@/lib/auth/resendEmail";
export const SESSION_COOKIE = "kamal_session";
export const DATABASE_FILE = "kamal.db";
const DEMO_DIAGNOSIS_SOURCE_EMAIL = "ppiyush0005@gmail.com";
const DEMO_IMPORTED_DIAGNOSES = [];

function databasePath() {
    return path.resolve(process.cwd(), process.env.KAMAL_DB_PATH || DATABASE_FILE);
}
function db() {
    if (!globalThis.__kamalSqliteDb) {
        globalThis.__kamalSqliteDb = new DatabaseSync(databasePath());
        globalThis.__kamalSqliteDb.exec("PRAGMA foreign_keys = ON");
        ensureAuthSchema(globalThis.__kamalSqliteDb);
    }
    return globalThis.__kamalSqliteDb;
}
export function initializeAuthDatabase() {
    db();
}
function quoteIdentifier(identifier) {
    return `"${identifier.replaceAll('"', '""')}"`;
}
function displayCell(value, columnName) {
    const normalizedColumn = columnName.toLowerCase();
    if (normalizedColumn.includes("hash") ||
        normalizedColumn.includes("token") ||
        normalizedColumn.includes("code")) {
        return value == null ? "NULL" : "[hidden]";
    }
    if (value === null || value === undefined) {
        return "NULL";
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return String(value);
}
export function getAuthDatabaseSnapshot(limit = 100) {
    const database = db();
    const objects = database
        .prepare(`SELECT name, type
       FROM sqlite_master
       WHERE type IN ('table', 'view')
         AND name NOT LIKE 'sqlite_%'
       ORDER BY type, name`)
        .all();
    const tables = objects.map((object) => {
        const identifier = quoteIdentifier(object.name);
        const columns = database
            .prepare(`PRAGMA table_info(${identifier})`)
            .all();
        const columnNames = columns.map((column) => column.name);
        const rawRows = database.prepare(`SELECT * FROM ${identifier} LIMIT ?`).all(limit);
        const rows = rawRows.map((row) => Object.fromEntries(columnNames.map((columnName) => [columnName, displayCell(row[columnName], columnName)])));
        const rowCount = object.type === "table"
            ? (database.prepare(`SELECT COUNT(*) AS count FROM ${identifier}`).get().count ?? null)
            : null;
        return {
            name: object.name,
            type: object.type,
            columns: columnNames,
            rows,
            rowCount
        };
    });
    return {
        path: databasePath(),
        tables
    };
}
function ensureAuthSchema(database) {
    database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      email_verified integer NOT NULL DEFAULT 0,
      phone text,
      phone_verified integer NOT NULL DEFAULT 0,
      created_at text NOT NULL DEFAULT (datetime('now')),
      updated_at text NOT NULL DEFAULT (datetime('now'))
    );
  `);
    addColumnIfMissing(database, "users", "google_sub", "text");
    addColumnIfMissing(database, "users", "auth_provider", "text NOT NULL DEFAULT 'email'");
    addColumnIfMissing(database, "users", "avatar_url", "text");
    database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx
      ON users (google_sub)
      WHERE google_sub IS NOT NULL;

    CREATE TABLE IF NOT EXISTS otp_codes (
      id text PRIMARY KEY,
      user_id text REFERENCES users(id) ON DELETE CASCADE,
      email text NOT NULL,
      code_hash text NOT NULL,
      purpose text NOT NULL CHECK (purpose IN ('signup_verification', 'password_reset')),
      expires_at text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      consumed integer NOT NULL DEFAULT 0,
      created_at text NOT NULL DEFAULT (datetime('now')),
      last_sent_at text NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS otp_codes_email_purpose_idx
      ON otp_codes (email, purpose, created_at DESC);

    CREATE TABLE IF NOT EXISTS sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL,
      created_at text NOT NULL DEFAULT (datetime('now')),
      expires_at text NOT NULL,
      revoked integer NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

    CREATE TABLE IF NOT EXISTS patient_intakes (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      age integer NOT NULL,
      gender text NOT NULL,
      height_cm integer NOT NULL,
      weight_kg integer NOT NULL,
      allergies text,
      main_concern text NOT NULL DEFAULT '',
      created_at text NOT NULL DEFAULT (datetime('now')),
      updated_at text NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS patient_intakes_user_id_created_at_idx
      ON patient_intakes (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS medication_reminders (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      medicine_name text NOT NULL,
      scheduled_at text NOT NULL,
      channel text NOT NULL CHECK (channel IN ('WhatsApp', 'Email')),
      status text NOT NULL CHECK (status IN ('scheduled', 'sent', 'taken', 'failed')) DEFAULT 'scheduled',
      repeat_rule text NOT NULL DEFAULT 'none',
      schedule_start_date text,
      schedule_end_date text,
      custom_interval integer,
      custom_unit text,
      custom_weekdays_json text,
      details text,
      email_sent_at text,
      email_error text,
      created_at text NOT NULL DEFAULT (datetime('now')),
      updated_at text NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS medication_reminders_user_scheduled_idx
      ON medication_reminders (user_id, status, scheduled_at);

    CREATE TABLE IF NOT EXISTS diagnosis_sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_name text NOT NULL,
      patient_email text NOT NULL,
      pre_consultation_text text NOT NULL,
      transcript_json text NOT NULL,
      diagnosis_json text NOT NULL,
      formatted_summary text NOT NULL,
      created_at text NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS diagnosis_sessions_user_created_idx
      ON diagnosis_sessions (user_id, created_at DESC);

    DROP VIEW IF EXISTS login_info;

    CREATE VIEW login_info AS
      SELECT
        id,
        name,
        email,
        email_verified,
        auth_provider,
        google_sub,
        avatar_url,
        phone,
        phone_verified,
        created_at,
        updated_at
      FROM users;
  `);
    addColumnIfMissing(database, "medication_reminders", "repeat_rule", "text NOT NULL DEFAULT 'none'");
    addColumnIfMissing(database, "medication_reminders", "schedule_start_date", "text");
    addColumnIfMissing(database, "medication_reminders", "schedule_end_date", "text");
    addColumnIfMissing(database, "medication_reminders", "custom_interval", "integer");
    addColumnIfMissing(database, "medication_reminders", "custom_unit", "text");
    addColumnIfMissing(database, "medication_reminders", "custom_weekdays_json", "text");
    addColumnIfMissing(database, "medication_reminders", "details", "text");
}
function addColumnIfMissing(database, tableName, columnName, definition) {
    const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!columns.some((column) => column.name === columnName)) {
        database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function hashSecret(secret, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(secret, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}
function verifySecret(secret, storedHash) {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) {
        return false;
    }
    const candidate = crypto.scryptSync(secret, salt, 64);
    const stored = Buffer.from(hash, "hex");
    return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}
function createId() {
    return crypto.randomUUID();
}
function normalizeText(value) {
    return String(value ?? "").trim();
}
function toInt(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}
function createOtp() {
    return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}
function toSqlDate(date) {
    return date.toISOString();
}
function toLocalSqlDateTime(date = new Date()) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 19).replace("T", " ");
}
function safeJsonParse(value, fallback) {
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: Boolean(user.email_verified),
        phone: user.phone || "",
        authProvider: user.auth_provider,
        avatarUrl: user.avatar_url
    };
}
export function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
export function validatePassword(password) {
    return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}
function findUserByEmail(email) {
    return db()
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(normalizeEmail(email));
}
function replaceLiteral(value, from, to) {
    if (!from) {
        return String(value || "");
    }
    return String(value || "").split(from).join(to || "");
}
function retargetImportedDiagnosisSummary(summary, sourceUser, demoUser) {
    let text = String(summary || "");
    text = replaceLiteral(text, sourceUser.name, demoUser.name);
    text = replaceLiteral(text, sourceUser.email, demoUser.email);
    return text;
}
function ensureDemoImportedDiagnoses(database, demoEmail) {
    const demoUser = database
        .prepare("SELECT id, name, email FROM users WHERE email = ?")
        .get(normalizeEmail(demoEmail));
    const sourceUser = database
        .prepare("SELECT id, name, email FROM users WHERE email = ?")
        .get(normalizeEmail(DEMO_DIAGNOSIS_SOURCE_EMAIL));
    if (!demoUser) {
        return;
    }
    database
        .prepare("DELETE FROM diagnosis_sessions WHERE user_id = ? AND id IN ('demo-diagnosis-1-latest', 'demo-diagnosis-2', 'demo-diagnosis-3', 'demo-diagnosis-4')")
        .run(demoUser.id);
    if (!DEMO_IMPORTED_DIAGNOSES.length) {
        return;
    }
    if (!sourceUser || demoUser.id === sourceUser.id) {
        return;
    }
    const sourceSession = database.prepare(`
      SELECT *
      FROM (
        SELECT d.*,
               ROW_NUMBER() OVER (ORDER BY d.created_at DESC) AS diagnosis_no
        FROM diagnosis_sessions d
        WHERE d.user_id = ?
      ) ranked
      WHERE diagnosis_no = ?
      LIMIT 1
    `);
    const upsertDemoDiagnosis = database.prepare(`
      INSERT INTO diagnosis_sessions (
        id,
        user_id,
        patient_name,
        patient_email,
        pre_consultation_text,
        transcript_json,
        diagnosis_json,
        formatted_summary,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        patient_name = excluded.patient_name,
        patient_email = excluded.patient_email,
        pre_consultation_text = excluded.pre_consultation_text,
        transcript_json = excluded.transcript_json,
        diagnosis_json = excluded.diagnosis_json,
        formatted_summary = excluded.formatted_summary,
        created_at = excluded.created_at
    `);
    for (const fixture of DEMO_IMPORTED_DIAGNOSES) {
        const source = sourceSession.get(sourceUser.id, fixture.sourceNumber);
        if (!source) {
            continue;
        }
        upsertDemoDiagnosis.run(
            fixture.id,
            demoUser.id,
            demoUser.name || "Demo Patient",
            demoUser.email || demoEmail,
            source.pre_consultation_text,
            source.transcript_json,
            source.diagnosis_json,
            retargetImportedDiagnosisSummary(source.formatted_summary, sourceUser, demoUser),
            source.created_at
        );
    }
}
export function ensureConfiguredDemoUser() {
    const email = normalizeEmail(process.env.KAMAL_DEMO_EMAIL || "");
    const password = String(process.env.KAMAL_DEMO_PASSWORD || "");
    const name = normalizeText(process.env.KAMAL_DEMO_NAME || "Demo Patient") || "Demo Patient";
    if (!email || !password) {
        return { ok: false, status: 404, message: "Demo login is not configured." };
    }
    if (!validateEmail(email) || !validatePassword(password)) {
        return { ok: false, status: 500, message: "Demo login credentials are invalid." };
    }
    try {
        const database = db();
        const existingUser = findUserByEmail(email);
        if (existingUser) {
            database
                .prepare(`UPDATE users
           SET name = ?,
               password_hash = ?,
               email_verified = 1,
               updated_at = datetime('now')
           WHERE email = ?`)
                .run(name, hashSecret(password), email);
            ensureDemoImportedDiagnoses(database, email);
            return { ok: true, email };
        }
        database
            .prepare(`INSERT INTO users (
            id,
            name,
            email,
            password_hash,
            email_verified,
            phone,
            phone_verified,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, 1, null, 0, datetime('now'), datetime('now'))`)
            .run(createId(), name, email, hashSecret(password));
        ensureDemoImportedDiagnoses(database, email);
        return { ok: true, email };
    }
    catch (error) {
        console.error("Demo user setup failed", error);
        return { ok: false, status: 500, message: "We could not prepare the demo login." };
    }
}
function findUserByGoogleSub(googleSub) {
    return db().prepare("SELECT * FROM users WHERE google_sub = ?").get(googleSub);
}
function invalidateOtps(email, purpose) {
    db()
        .prepare("UPDATE otp_codes SET consumed = 1 WHERE email = ? AND purpose = ? AND consumed = 0")
        .run(normalizeEmail(email), purpose);
}
function recentOtp(email, purpose) {
    return db()
        .prepare(`SELECT *
       FROM otp_codes
       WHERE email = ? AND purpose = ?
       ORDER BY last_sent_at DESC
       LIMIT 1`)
        .get(normalizeEmail(email), purpose);
}
async function generateOtp(email, purpose, userId) {
    invalidateOtps(email, purpose);
    const id = createId();
    const code = createOtp();
    db()
        .prepare(`INSERT INTO otp_codes (
        id,
        user_id,
        email,
        code_hash,
        purpose,
        expires_at,
        attempts,
        consumed,
        created_at,
        last_sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, datetime('now'), datetime('now'))`)
        .run(id, userId, normalizeEmail(email), hashSecret(code), purpose, toSqlDate(new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000)));
    const emailResult = await sendOtpEmail({ to: email, code, purpose });
    if (!emailResult.ok) {
        db().prepare("UPDATE otp_codes SET consumed = 1 WHERE id = ?").run(id);
        return emailResult;
    }
    return { ok: true };
}
export function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    db()
        .prepare(`INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked)
       VALUES (?, ?, ?, datetime('now'), ?, 0)`)
        .run(createId(), userId, hashSecret(token), toSqlDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
    return token;
}
export async function loginWithGoogle(input) {
    const email = normalizeEmail(input.email);
    const name = input.name.trim() || email.split("@")[0] || "KAMAL user";
    const avatarUrl = input.avatarUrl?.trim() || null;
    if (!input.googleSub.trim()) {
        return { ok: false, status: 400, message: "Google did not return a valid account id." };
    }
    if (!validateEmail(email)) {
        return { ok: false, status: 400, message: "Google did not return a valid email address." };
    }
    if (!input.emailVerified) {
        return { ok: false, status: 403, message: "Please use a verified Google email address." };
    }
    try {
        const googleUser = findUserByGoogleSub(input.googleSub);
        if (googleUser) {
            db()
                .prepare(`UPDATE users
           SET name = ?, email = ?, email_verified = 1, auth_provider = 'google', avatar_url = ?, updated_at = datetime('now')
           WHERE id = ?`)
                .run(name, email, avatarUrl, googleUser.id);
            const updatedUser = findUserByGoogleSub(input.googleSub);
            return {
                ok: true,
                message: "Signed in with Google.",
                user: publicUser(updatedUser),
                sessionToken: createSession(updatedUser.id)
            };
        }
        const emailUser = findUserByEmail(email);
        if (emailUser) {
            if (emailUser.google_sub && emailUser.google_sub !== input.googleSub) {
                return {
                    ok: false,
                    status: 409,
                    message: "That email is already linked to another Google account."
                };
            }
            db()
                .prepare(`UPDATE users
           SET name = ?, google_sub = ?, email_verified = 1, auth_provider = 'google', avatar_url = ?, updated_at = datetime('now')
           WHERE id = ?`)
                .run(name, input.googleSub, avatarUrl, emailUser.id);
            const updatedUser = findUserByEmail(email);
            return {
                ok: true,
                message: "Signed in with Google.",
                user: publicUser(updatedUser),
                sessionToken: createSession(updatedUser.id)
            };
        }
        const id = createId();
        db()
            .prepare(`INSERT INTO users (
          id,
          name,
          email,
          password_hash,
          email_verified,
          phone,
          phone_verified,
          google_sub,
          auth_provider,
          avatar_url,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 1, null, 0, ?, 'google', ?, datetime('now'), datetime('now'))`)
            .run(id, name, email, hashSecret(`google:${input.googleSub}:${crypto.randomBytes(16).toString("hex")}`), input.googleSub, avatarUrl);
        const user = findUserByGoogleSub(input.googleSub);
        return {
            ok: true,
            message: "Signed in with Google.",
            user: publicUser(user),
            sessionToken: createSession(user.id)
        };
    }
    catch (error) {
        console.error("Google login failed", error);
        return { ok: false, status: 500, message: "We could not sign you in with Google. Please try again." };
    }
}
export function createSessionCookieValue(token) {
    return token;
}
export async function signup(input) {
    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    if (!name) {
        return { ok: false, status: 400, message: "Please enter your name." };
    }
    if (!validateEmail(email)) {
        return { ok: false, status: 400, message: "Please enter a valid email address." };
    }
    if (!validatePassword(input.password)) {
        return {
            ok: false,
            status: 400,
            message: "Password must be at least 8 characters and include one letter and one number."
        };
    }
    if (input.password !== input.confirmPassword) {
        return { ok: false, status: 400, message: "Passwords do not match." };
    }
    try {
        const existingUser = findUserByEmail(email);
        if (existingUser?.email_verified) {
            return {
                ok: false,
                status: 409,
                message: "An account with this email already exists. Try signing in instead."
            };
        }
        let user;
        if (existingUser) {
            db()
                .prepare(`UPDATE users
           SET name = ?, password_hash = ?, updated_at = datetime('now')
           WHERE email = ?`)
                .run(name, hashSecret(input.password), email);
            user = findUserByEmail(email);
        }
        else {
            const id = createId();
            db()
                .prepare(`INSERT INTO users (
            id,
            name,
            email,
            password_hash,
            email_verified,
            phone,
            phone_verified,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, 0, null, 0, datetime('now'), datetime('now'))`)
                .run(id, name, email, hashSecret(input.password));
            user = findUserByEmail(email);
        }
        const otpResult = await generateOtp(email, "signup_verification", user.id);
        if (!otpResult.ok) {
            return otpResult;
        }
        return {
            ok: true,
            message: "We sent a 6-digit code to your email.",
            user: publicUser(user)
        };
    }
    catch (error) {
        console.error("Signup failed", error);
        return { ok: false, status: 500, message: "We could not create the account. Please try again." };
    }
}
export async function login(input) {
    const email = normalizeEmail(input.email);
    const genericError = { ok: false, status: 401, message: "Email or password is incorrect." };
    if (!validateEmail(email)) {
        return genericError;
    }
    try {
        const user = findUserByEmail(email);
        if (!user || !verifySecret(input.password, user.password_hash)) {
            return genericError;
        }
        if (!user.email_verified) {
            const otpResult = await generateOtp(email, "signup_verification", user.id);
            if (!otpResult.ok) {
                return otpResult;
            }
            return {
                ok: true,
                message: "Please verify your email to continue.",
                user: publicUser(user)
            };
        }
        return {
            ok: true,
            message: "Signed in.",
            user: publicUser(user),
            sessionToken: createSession(user.id)
        };
    }
    catch (error) {
        console.error("Login failed", error);
        return { ok: false, status: 500, message: "We could not sign you in. Please try again." };
    }
}
export async function verifyOtp(input) {
    const email = normalizeEmail(input.email);
    const code = input.code.trim();
    try {
        const otp = recentOtp(email, input.purpose);
        if (!otp || otp.consumed || new Date(otp.expires_at).getTime() < Date.now() || otp.attempts >= 5) {
            return { ok: false, status: 400, message: "That code is no longer active. Please request a new one." };
        }
        if (!/^\d{6}$/.test(code) || !verifySecret(code, otp.code_hash)) {
            const attempts = otp.attempts + 1;
            db()
                .prepare(`UPDATE otp_codes
           SET attempts = ?, consumed = CASE WHEN ? >= 5 THEN 1 ELSE consumed END
           WHERE id = ?`)
                .run(attempts, attempts, otp.id);
            if (attempts >= 5) {
                return {
                    ok: false,
                    status: 400,
                    message: "That code no longer works. Please request a new one."
                };
            }
            return {
                ok: false,
                status: 400,
                message: "That code did not match. Please try again."
            };
        }
        db().prepare("UPDATE otp_codes SET consumed = 1 WHERE id = ?").run(otp.id);
        const user = db()
            .prepare("SELECT * FROM users WHERE id = ? OR email = ? ORDER BY id = ? DESC LIMIT 1")
            .get(otp.user_id, email, otp.user_id);
        if (!user) {
            return { ok: false, status: 400, message: "We could not find an account for this code." };
        }
        let activeUser = user;
        if (input.purpose === "signup_verification") {
            db()
                .prepare("UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?")
                .run(user.id);
            activeUser = findUserByEmail(user.email);
        }
        return {
            ok: true,
            message: "Code verified.",
            user: publicUser(activeUser),
            sessionToken: createSession(activeUser.id)
        };
    }
    catch (error) {
        console.error("OTP verification failed", error);
        return { ok: false, status: 500, message: "We could not verify that code. Please try again." };
    }
}
export async function resendOtp(input) {
    const email = normalizeEmail(input.email);
    if (!validateEmail(email)) {
        return { ok: false, status: 400, message: "Please enter a valid email address." };
    }
    try {
        const user = findUserByEmail(email);
        if (!user) {
            return { ok: false, status: 404, message: "We could not find an account for that email." };
        }
        const lastOtp = recentOtp(email, input.purpose);
        if (lastOtp) {
            const elapsedMs = Date.now() - new Date(lastOtp.last_sent_at).getTime();
            if (elapsedMs < OTP_COOLDOWN_SECONDS * 1000) {
                const waitSeconds = Math.ceil((OTP_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
                return {
                    ok: false,
                    status: 429,
                    message: `Please wait ${waitSeconds} seconds before requesting another code.`
                };
            }
        }
        const otpResult = await generateOtp(email, input.purpose, user.id);
        if (!otpResult.ok) {
            return otpResult;
        }
        return {
            ok: true,
            message: "We sent a new code to your email."
        };
    }
    catch (error) {
        console.error("Resend OTP failed", error);
        return { ok: false, status: 500, message: "We could not send a new code. Please try again." };
    }
}
export async function forgotPassword(input) {
    const email = normalizeEmail(input.email);
    const genericMessage = "If that email is registered, we sent a code.";
    if (!validateEmail(email)) {
        return { ok: true, message: genericMessage };
    }
    try {
        const user = findUserByEmail(email);
        if (user) {
            const otpResult = await generateOtp(email, "password_reset", user.id);
            if (!otpResult.ok) {
                return {
                    ok: false,
                    status: otpResult.status,
                    message: otpResult.message
                };
            }
            return {
                ok: true,
                message: genericMessage
            };
        }
        return { ok: true, message: genericMessage };
    }
    catch (error) {
        console.error("Forgot password failed", error);
        return { ok: true, message: genericMessage };
    }
}
export async function resetPassword(input) {
    if (!validatePassword(input.newPassword)) {
        return {
            ok: false,
            status: 400,
            message: "Password must be at least 8 characters and include one letter and one number."
        };
    }
    if (input.newPassword !== input.confirmPassword) {
        return { ok: false, status: 400, message: "Passwords do not match." };
    }
    const verification = await verifyOtp({
        email: input.email,
        code: input.code,
        purpose: "password_reset"
    });
    if (!verification.ok || !verification.user) {
        return verification;
    }
    try {
        db()
            .prepare(`UPDATE users
         SET password_hash = ?, email_verified = 1, updated_at = datetime('now')
         WHERE email = ?`)
            .run(hashSecret(input.newPassword), normalizeEmail(input.email));
        const user = findUserByEmail(input.email);
        if (!user) {
            return { ok: false, status: 400, message: "We could not update that account." };
        }
        revokeUserSessions(user.id);
        return {
            ok: true,
            message: "Password updated.",
            user: publicUser(user),
            sessionToken: createSession(user.id)
        };
    }
    catch (error) {
        console.error("Reset password failed", error);
        return { ok: false, status: 500, message: "We could not update the password. Please try again." };
    }
}
export async function getUserBySessionToken(token) {
    if (!token) {
        return null;
    }
    try {
        const sessions = db()
            .prepare(`SELECT *
         FROM sessions
         WHERE revoked = 0 AND expires_at > ?
         ORDER BY created_at DESC`)
            .all(toSqlDate(new Date()));
        for (const session of sessions) {
            if (verifySecret(token, session.token_hash)) {
                const user = db().prepare("SELECT * FROM users WHERE id = ?").get(session.user_id);
                return user ? publicUser(user) : null;
            }
        }
    }
    catch (error) {
        console.error("Session lookup failed", error);
    }
    return null;
}

export function updateUserProfile(userId, input) {
    const name = normalizeText(input.name);
    const email = normalizeEmail(String(input.email || ""));
    const phone = normalizeText(input.phone).slice(0, 40);
    if (!userId) {
        return { ok: false, status: 401, message: "Please sign in first." };
    }
    if (!name) {
        return { ok: false, status: 400, message: "Please enter your name." };
    }
    if (!validateEmail(email)) {
        return { ok: false, status: 400, message: "Please enter a valid email address." };
    }
    try {
        const currentUser = db().prepare("SELECT * FROM users WHERE id = ?").get(userId);
        if (!currentUser) {
            return { ok: false, status: 404, message: "User not found." };
        }
        const emailOwner = findUserByEmail(email);
        if (emailOwner && emailOwner.id !== userId) {
            return { ok: false, status: 409, message: "That email is already used by another account." };
        }
        db()
            .prepare(`UPDATE users
         SET name = ?,
             email = ?,
             phone = ?,
             email_verified = CASE WHEN email = ? THEN email_verified ELSE 0 END,
             updated_at = datetime('now')
         WHERE id = ?`)
            .run(name, email, phone || null, email, userId);
        const updatedUser = db().prepare("SELECT * FROM users WHERE id = ?").get(userId);
        return {
            ok: true,
            message: "Profile saved.",
            user: publicUser(updatedUser)
        };
    }
    catch (error) {
        console.error("Profile update failed", error);
        return { ok: false, status: 500, message: "We could not save your profile. Please try again." };
    }
}

export function searchUserNames(query) {
    const searchText = normalizeText(query);
    if (!searchText) {
        return [];
    }
    const likeQuery = `%${searchText.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    return db()
        .prepare(`SELECT id, name
       FROM users
       WHERE name LIKE ? ESCAPE '\\'
       ORDER BY name COLLATE NOCASE ASC
       LIMIT 25`)
        .all(likeQuery)
        .map((user) => ({
            id: user.id,
            name: user.name
        }));
}

export function getLatestPatientIntake(userId) {
    if (!userId) {
        return null;
    }
    const intake = db()
        .prepare(`SELECT *
       FROM patient_intakes
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`)
        .get(userId);
    if (!intake) {
        return null;
    }
    return {
        id: intake.id,
        userId: intake.user_id,
        age: intake.age,
        gender: intake.gender,
        heightCm: intake.height_cm,
        weightKg: intake.weight_kg,
        allergies: intake.allergies || "",
        mainConcern: intake.main_concern,
        createdAt: intake.created_at,
        updatedAt: intake.updated_at
    };
}
export function savePatientIntake(userId, input) {
    const age = toInt(input.age);
    const heightCm = toInt(input.heightCm);
    const weightKg = toInt(input.weightKg);
    const gender = normalizeText(input.gender);
    const allergies = normalizeText(input.allergies);
    const mainConcern = normalizeText(input.mainConcern);
    const allowedGenders = new Set(["female", "male", "non_binary", "prefer_not_to_say"]);
    if (!userId) {
        return { ok: false, status: 401, message: "Please sign in before starting a consultation." };
    }
    if (age === null || age < 0 || age > 130) {
        return { ok: false, status: 400, message: "Enter an age between 0 and 130 years." };
    }
    if (!allowedGenders.has(gender)) {
        return { ok: false, status: 400, message: "Select a gender option." };
    }
    if (heightCm === null || heightCm < 40 || heightCm > 260) {
        return { ok: false, status: 400, message: "Enter height between 40 and 260 cm." };
    }
    if (weightKg === null || weightKg < 1 || weightKg > 500) {
        return { ok: false, status: 400, message: "Enter weight between 1 and 500 kg." };
    }
    if (!mainConcern) {
        return { ok: false, status: 400, message: "Describe the main concern before the diagnosis session can continue." };
    }
    const id = createId();
    db()
        .prepare(`INSERT INTO patient_intakes (
        id,
        user_id,
        age,
        gender,
        height_cm,
        weight_kg,
        allergies,
        main_concern,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
        .run(id, userId, age, gender, heightCm, weightKg, allergies || null, mainConcern);
    return {
        ok: true,
        message: "Patient information saved.",
        intake: getLatestPatientIntake(userId)
    };
}

function publicMedicationReminder(reminder) {
    return {
        id: reminder.id,
        title: reminder.medicine_name,
        scheduledAt: reminder.scheduled_at,
        channel: reminder.channel,
        status: reminder.status,
        repeatRule: reminder.repeat_rule || "none",
        scheduleStartDate: reminder.schedule_start_date || "",
        scheduleEndDate: reminder.schedule_end_date || "",
        customInterval: reminder.custom_interval || 1,
        customUnit: reminder.custom_unit || "",
        customWeekdays: safeJsonParse(reminder.custom_weekdays_json, []),
        details: reminder.details || "",
        emailSentAt: reminder.email_sent_at,
        emailError: reminder.email_error
    };
}

export function createMedicationReminder(userId, input) {
    const medicineName = normalizeText(input.medicineName);
    const channel = normalizeText(input.channel);
    const repeatRule = normalizeText(input.repeatRule || "none");
    const details = normalizeText(input.details).slice(0, 1000);
    const scheduledAt = new Date(input.scheduledAt);
    const scheduleStartDate = normalizeText(input.scheduleStartDate);
    const scheduleEndDate = normalizeText(input.scheduleEndDate);
    const customInterval = Math.max(1, Math.min(365, Number.parseInt(input.customInterval, 10) || 1));
    const customUnit = normalizeText(input.customUnit || "day");
    const customWeekdays = Array.isArray(input.customWeekdays)
        ? input.customWeekdays.map((item) => Number.parseInt(item, 10)).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
        : [];
    const allowedChannels = new Set(["Email", "WhatsApp"]);
    const allowedRepeatRules = new Set(["none", "daily", "weekly", "monthly", "yearly", "weekdays", "custom"]);
    const allowedCustomUnits = new Set(["day", "week", "month"]);
    if (!userId) {
        return { ok: false, status: 401, message: "Please sign in before setting medication reminders." };
    }
    if (!medicineName) {
        return { ok: false, status: 400, message: "Enter the medicine name." };
    }
    if (!allowedChannels.has(channel)) {
        return { ok: false, status: 400, message: "Choose Email or WhatsApp as the reminder channel." };
    }
    if (!allowedRepeatRules.has(repeatRule)) {
        return { ok: false, status: 400, message: "Choose a valid repeat option." };
    }
    if (repeatRule === "custom") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(scheduleEndDate)) {
            return { ok: false, status: 400, message: "Choose a custom start and end date." };
        }
        if (scheduleEndDate < scheduleStartDate) {
            return { ok: false, status: 400, message: "Custom end date must be after the start date." };
        }
        if (!allowedCustomUnits.has(customUnit)) {
            return { ok: false, status: 400, message: "Choose a valid custom repeat unit." };
        }
        if (customUnit === "week" && customWeekdays.length === 0) {
            return { ok: false, status: 400, message: "Choose at least one weekday for a weekly custom reminder." };
        }
    }
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        return { ok: false, status: 400, message: "Choose a future reminder time." };
    }
    const id = createId();
    db()
        .prepare(`INSERT INTO medication_reminders (
        id,
        user_id,
        medicine_name,
        scheduled_at,
        channel,
        status,
        repeat_rule,
        schedule_start_date,
        schedule_end_date,
        custom_interval,
        custom_unit,
        custom_weekdays_json,
        details,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
        .run(
            id,
            userId,
            medicineName,
            toSqlDate(scheduledAt),
            channel,
            repeatRule,
            repeatRule === "custom" ? scheduleStartDate : null,
            repeatRule === "custom" ? scheduleEndDate : null,
            repeatRule === "custom" ? customInterval : null,
            repeatRule === "custom" ? customUnit : null,
            repeatRule === "custom" ? JSON.stringify([...new Set(customWeekdays)].sort((a, b) => a - b)) : null,
            details || null
        );
    return {
        ok: true,
        message: "Medication reminder set.",
        reminder: getMedicationReminderById(id)
    };
}

export function getMedicationReminderById(id) {
    const reminder = db().prepare("SELECT * FROM medication_reminders WHERE id = ?").get(id);
    return reminder ? publicMedicationReminder(reminder) : null;
}

export function listActiveMedicationReminders(userId) {
    if (!userId) {
        return [];
    }
    return db()
        .prepare(`SELECT *
       FROM medication_reminders
       WHERE user_id = ?
         AND status = 'scheduled'
         AND scheduled_at > ?
       ORDER BY scheduled_at ASC`)
        .all(userId, toSqlDate(new Date()))
        .map(publicMedicationReminder);
}

export function listDueMedicationReminders() {
    return db()
        .prepare(`SELECT medication_reminders.*, users.name AS user_name, users.email AS user_email
       FROM medication_reminders
       JOIN users ON users.id = medication_reminders.user_id
       WHERE medication_reminders.status = 'scheduled'
         AND medication_reminders.scheduled_at <= ?
       ORDER BY medication_reminders.scheduled_at ASC`)
        .all(toSqlDate(new Date()));
}

export function listScheduledMedicationReminders() {
    return db()
        .prepare(`SELECT medication_reminders.*, users.name AS user_name, users.email AS user_email
       FROM medication_reminders
       JOIN users ON users.id = medication_reminders.user_id
       WHERE medication_reminders.status = 'scheduled'
         AND medication_reminders.scheduled_at > ?
       ORDER BY medication_reminders.scheduled_at ASC`)
        .all(toSqlDate(new Date()));
}

export function markMedicationReminderTaken(userId, reminderId) {
    const result = db()
        .prepare(`UPDATE medication_reminders
       SET status = 'taken', updated_at = datetime('now')
       WHERE id = ? AND user_id = ? AND status = 'scheduled'`)
        .run(reminderId, userId);
    return result.changes > 0
        ? { ok: true, message: "Medication marked as taken." }
        : { ok: false, status: 404, message: "Active medication reminder was not found." };
}

export function cancelMedicationReminder(userId, reminderId) {
    const result = db()
        .prepare(`DELETE FROM medication_reminders
       WHERE id = ? AND user_id = ? AND status = 'scheduled'`)
        .run(reminderId, userId);
    return result.changes > 0
        ? { ok: true, message: "Reminder cancelled." }
        : { ok: false, status: 404, message: "Active reminder was not found." };
}

export function markMedicationReminderSent(reminderId) {
    db()
        .prepare(`UPDATE medication_reminders
       SET status = 'sent', email_sent_at = datetime('now'), email_error = NULL, updated_at = datetime('now')
       WHERE id = ?`)
        .run(reminderId);
}

export function rescheduleMedicationReminder(reminderId, scheduledAt) {
    db()
        .prepare(`UPDATE medication_reminders
       SET status = 'scheduled', scheduled_at = ?, email_sent_at = NULL, email_error = NULL, updated_at = datetime('now')
       WHERE id = ?`)
        .run(toSqlDate(scheduledAt), reminderId);
}

export function markMedicationReminderFailed(reminderId, message) {
    db()
        .prepare(`UPDATE medication_reminders
       SET status = 'failed', email_error = ?, updated_at = datetime('now')
       WHERE id = ?`)
        .run(String(message || "Email failed").slice(0, 500), reminderId);
}

export function formatDiagnosisSummary({ patientName, patientEmail, intake, transcript, diagnosis }) {
    const preConsultationText = [
        `Age: ${intake.age} years`,
        `Gender: ${intake.gender}`,
        `Height: ${intake.heightCm} cm`,
        `Weight: ${intake.weightKg} kg`,
        `Allergies: ${intake.allergies || "None reported"}`,
        `Main concern: ${intake.mainConcern || "Not stated"}`
    ].join("\n");
    const transcriptText = transcript
        .map((turn) => `${turn.role === "assistant" ? "Doctor AI" : "Patient"}: ${turn.content}`)
        .join("\n\n");
    const likelyConditions = Array.isArray(diagnosis.likelyConditions)
        ? diagnosis.likelyConditions.join(", ")
        : "Not specified";
    const primaryDisease = diagnosis.primaryDisease || (Array.isArray(diagnosis.likelyConditions) ? diagnosis.likelyConditions[0] : "") || "Not specified";
    const recommendedNextSteps = Array.isArray(diagnosis.recommendedNextSteps)
        ? diagnosis.recommendedNextSteps.join("\n- ")
        : diagnosis.recommendedNextStep || "Consult a qualified clinician.";
    const redFlags = Array.isArray(diagnosis.redFlags)
        ? diagnosis.redFlags.join("\n- ")
        : "Seek urgent care for severe, worsening, or emergency symptoms.";
    const selfCare = Array.isArray(diagnosis.selfCare)
        ? diagnosis.selfCare.join("\n- ")
        : "Follow safe supportive care and clinician advice.";
    return [
        `Patient Name\n${patientName}`,
        `Patient Email\n${patientEmail || "Not available"}`,
        `Pre Text\n${preConsultationText}`,
        `Whole Diagnosis\nFinal disease or condition: ${primaryDisease}\nLikely conditions: ${likelyConditions}\nConfidence: ${diagnosis.confidenceLevel || "Not specified"}\nReasoning: ${diagnosis.reasoning || "Not specified"}\nRecommended next steps:\n- ${recommendedNextSteps}\nRed flags:\n- ${redFlags}\nSelf-care guidance:\n- ${selfCare}\nCaution: ${diagnosis.caution || diagnosis.doctorConfirmationNote || "This is AI-assisted guidance, not a final medical diagnosis. A qualified doctor should confirm it."}`,
        `Conversation Transcript\n${transcriptText}`
    ].join("\n\n---\n\n");
}

function publicDiagnosisSession(session) {
    return {
        id: session.id,
        userId: session.user_id,
        patientName: session.patient_name,
        patientEmail: session.patient_email,
        preConsultationText: session.pre_consultation_text,
        transcript: safeJsonParse(session.transcript_json, []),
        diagnosis: safeJsonParse(session.diagnosis_json, {}),
        formattedSummary: session.formatted_summary,
        createdAt: session.created_at
    };
}

export function saveDiagnosisSession(user, intake, transcript, diagnosis) {
    if (!user?.id) {
        return { ok: false, status: 401, message: "Please sign in before saving a diagnosis." };
    }
    if (!intake) {
        return { ok: false, status: 400, message: "Save your concern before diagnosis can continue." };
    }
    const id = createId();
    const preConsultationText = [
        `Age: ${intake.age} years`,
        `Gender: ${intake.gender}`,
        `Height: ${intake.heightCm} cm`,
        `Weight: ${intake.weightKg} kg`,
        `Allergies: ${intake.allergies || "None reported"}`,
        `Main concern: ${intake.mainConcern || "Not stated"}`
    ].join("\n");
    const formattedSummary = formatDiagnosisSummary({
        patientName: user.name,
        patientEmail: user.email,
        intake,
        transcript,
        diagnosis
    });
    db()
        .prepare(`INSERT INTO diagnosis_sessions (
        id,
        user_id,
        patient_name,
        patient_email,
        pre_consultation_text,
        transcript_json,
        diagnosis_json,
        formatted_summary,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, user.id, user.name, user.email || "", preConsultationText, JSON.stringify(transcript), JSON.stringify(diagnosis), formattedSummary, toLocalSqlDateTime());
    return {
        ok: true,
        message: "Diagnosis saved to history.",
        diagnosisSession: getDiagnosisSessionById(user.id, id)
    };
}

export function getDiagnosisSessionById(userId, id) {
    const session = db()
        .prepare("SELECT * FROM diagnosis_sessions WHERE user_id = ? AND id = ?")
        .get(userId, id);
    return session ? publicDiagnosisSession(session) : null;
}

export function listDiagnosisSessions(userId, limit = 20) {
    if (!userId) {
        return [];
    }
    return db()
        .prepare(`SELECT *
       FROM diagnosis_sessions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`)
        .all(userId, limit)
        .map(publicDiagnosisSession);
}
export async function revokeSession(token) {
    if (!token) {
        return;
    }
    try {
        const sessions = db()
            .prepare("SELECT id, token_hash FROM sessions WHERE revoked = 0 AND expires_at > ?")
            .all(toSqlDate(new Date()));
        for (const session of sessions) {
            if (verifySecret(token, session.token_hash)) {
                db().prepare("UPDATE sessions SET revoked = 1 WHERE id = ?").run(session.id);
                return;
            }
        }
    }
    catch (error) {
        console.error("Session revoke failed", error);
    }
}
function revokeUserSessions(userId) {
    db().prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ?").run(userId);
}
