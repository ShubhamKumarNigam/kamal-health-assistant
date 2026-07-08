import crypto from "crypto";
import { neon } from "@neondatabase/serverless";
import { OTP_COOLDOWN_SECONDS, OTP_EXPIRES_MINUTES } from "./config";
import { sendOtpEmail } from "./resendEmail";

export const SESSION_COOKIE = "kamal_session";
export const DATABASE_FILE = "Neon Postgres";

const DEMO_DIAGNOSIS_SOURCE_EMAIL = "ppiyush0005@gmail.com";
const DEMO_IMPORTED_DIAGNOSES = [];

function databaseUrl() {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) {
        throw new Error("DATABASE_URL is not configured. Connect Neon Postgres and pull Vercel env vars.");
    }
    return url;
}

function sqlClient() {
    if (!globalThis.__kamalPostgresSql) {
        globalThis.__kamalPostgresSql = neon(databaseUrl());
    }
    return globalThis.__kamalPostgresSql;
}

async function rawQuery(statement, params = []) {
    return sqlClient().query(statement, params);
}

function isConcurrentSchemaCreationError(error) {
    return error?.code === "23505" && error?.constraint === "pg_type_typname_nsp_index";
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSchemaStatement(statement) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            await rawQuery(statement);
            return;
        }
        catch (error) {
            if (!isConcurrentSchemaCreationError(error) || attempt === 2) {
                throw error;
            }
            await wait(200 * (attempt + 1));
        }
    }
}

export async function initializeAuthDatabase() {
    await ensureAuthSchema();
}

async function query(statement, params = []) {
    await ensureAuthSchema();
    return rawQuery(statement, params);
}

async function one(statement, params = []) {
    const rows = await query(statement, params);
    return rows[0] || null;
}

function quoteIdentifier(identifier) {
    return `"${String(identifier).replaceAll('"', '""')}"`;
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
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return String(value);
}

export async function getAuthDatabaseSnapshot(limit = 100) {
    const safeLimit = Math.max(1, Math.min(500, Number.parseInt(limit, 10) || 100));
    const objects = await query(`
      SELECT table_name AS name, 'table' AS type
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      UNION ALL
      SELECT table_name AS name, 'view' AS type
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY type, name
    `);
    const tables = [];
    for (const object of objects) {
        const identifier = quoteIdentifier(object.name);
        const columns = await query(`
          SELECT column_name AS name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position
        `, [object.name]);
        const columnNames = columns.map((column) => column.name);
        const rawRows = await query(`SELECT * FROM ${identifier} LIMIT ${safeLimit}`);
        const rows = rawRows.map((row) => Object.fromEntries(columnNames.map((columnName) => [
            columnName,
            displayCell(row[columnName], columnName)
        ])));
        const rowCount = object.type === "table"
            ? Number((await query(`SELECT COUNT(*)::int AS count FROM ${identifier}`))[0]?.count ?? 0)
            : null;
        tables.push({
            name: object.name,
            type: object.type,
            columns: columnNames,
            rows,
            rowCount
        });
    }
    return {
        path: "Neon Postgres via DATABASE_URL",
        tables
    };
}

async function ensureAuthSchema() {
    if (!globalThis.__kamalAuthSchemaPromise) {
        globalThis.__kamalAuthSchemaPromise = (async () => {
            const statements = [
                `CREATE TABLE IF NOT EXISTS users (
                  id text PRIMARY KEY,
                  name text NOT NULL,
                  email text UNIQUE NOT NULL,
                  password_hash text NOT NULL,
                  email_verified boolean NOT NULL DEFAULT false,
                  phone text,
                  phone_verified boolean NOT NULL DEFAULT false,
                  google_sub text,
                  auth_provider text NOT NULL DEFAULT 'email',
                  avatar_url text,
                  created_at timestamptz NOT NULL DEFAULT now(),
                  updated_at timestamptz NOT NULL DEFAULT now()
                )`,
                `CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx
                  ON users (google_sub)
                  WHERE google_sub IS NOT NULL`,
                `CREATE TABLE IF NOT EXISTS otp_codes (
                  id text PRIMARY KEY,
                  user_id text REFERENCES users(id) ON DELETE CASCADE,
                  email text NOT NULL,
                  code_hash text NOT NULL,
                  purpose text NOT NULL CHECK (purpose IN ('signup_verification', 'password_reset')),
                  expires_at timestamptz NOT NULL,
                  attempts integer NOT NULL DEFAULT 0,
                  consumed boolean NOT NULL DEFAULT false,
                  created_at timestamptz NOT NULL DEFAULT now(),
                  last_sent_at timestamptz NOT NULL DEFAULT now()
                )`,
                `CREATE INDEX IF NOT EXISTS otp_codes_email_purpose_idx
                  ON otp_codes (email, purpose, created_at DESC)`,
                `CREATE TABLE IF NOT EXISTS sessions (
                  id text PRIMARY KEY,
                  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  token_hash text NOT NULL,
                  created_at timestamptz NOT NULL DEFAULT now(),
                  expires_at timestamptz NOT NULL,
                  revoked boolean NOT NULL DEFAULT false
                )`,
                `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)`,
                `CREATE TABLE IF NOT EXISTS patient_intakes (
                  id text PRIMARY KEY,
                  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  age integer NOT NULL,
                  gender text NOT NULL,
                  height_cm integer NOT NULL,
                  weight_kg integer NOT NULL,
                  allergies text,
                  main_concern text NOT NULL DEFAULT '',
                  created_at timestamptz NOT NULL DEFAULT now(),
                  updated_at timestamptz NOT NULL DEFAULT now()
                )`,
                `CREATE INDEX IF NOT EXISTS patient_intakes_user_id_created_at_idx
                  ON patient_intakes (user_id, created_at DESC)`,
                `CREATE TABLE IF NOT EXISTS medication_reminders (
                  id text PRIMARY KEY,
                  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  medicine_name text NOT NULL,
                  scheduled_at timestamptz NOT NULL,
                  channel text NOT NULL CHECK (channel IN ('WhatsApp', 'Email')),
                  status text NOT NULL CHECK (status IN ('scheduled', 'sent', 'taken', 'failed')) DEFAULT 'scheduled',
                  repeat_rule text NOT NULL DEFAULT 'none',
                  schedule_start_date text,
                  schedule_end_date text,
                  custom_interval integer,
                  custom_unit text,
                  custom_weekdays_json text,
                  details text,
                  email_sent_at timestamptz,
                  email_error text,
                  created_at timestamptz NOT NULL DEFAULT now(),
                  updated_at timestamptz NOT NULL DEFAULT now()
                )`,
                `CREATE INDEX IF NOT EXISTS medication_reminders_user_scheduled_idx
                  ON medication_reminders (user_id, status, scheduled_at)`,
                `CREATE TABLE IF NOT EXISTS diagnosis_sessions (
                  id text PRIMARY KEY,
                  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  patient_name text NOT NULL,
                  patient_email text NOT NULL,
                  pre_consultation_text text NOT NULL,
                  transcript_json text NOT NULL,
                  diagnosis_json text NOT NULL,
                  formatted_summary text NOT NULL,
                  created_at timestamptz NOT NULL DEFAULT now()
                )`,
                `CREATE INDEX IF NOT EXISTS diagnosis_sessions_user_created_idx
                  ON diagnosis_sessions (user_id, created_at DESC)`,
                `CREATE OR REPLACE VIEW login_info AS
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
                  FROM users`
            ];
            for (const statement of statements) {
                await runSchemaStatement(statement);
            }
        })();
    }
    return globalThis.__kamalAuthSchemaPromise;
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function hashSecret(secret, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(secret, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

function verifySecret(secret, storedHash) {
    const [salt, hash] = String(storedHash || "").split(":");
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

function displayDate(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return String(value || "");
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
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function validatePassword(password) {
    return String(password || "").length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

async function findUserByEmail(email) {
    return one("SELECT * FROM users WHERE email = $1", [normalizeEmail(email)]);
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

async function ensureDemoImportedDiagnoses(demoEmail) {
    const demoUser = await one("SELECT id, name, email FROM users WHERE email = $1", [normalizeEmail(demoEmail)]);
    if (!demoUser) {
        return;
    }
    await query(`
      DELETE FROM diagnosis_sessions
      WHERE user_id = $1
        AND id IN ('demo-diagnosis-1-latest', 'demo-diagnosis-2', 'demo-diagnosis-3', 'demo-diagnosis-4')
    `, [demoUser.id]);
    if (!DEMO_IMPORTED_DIAGNOSES.length) {
        return;
    }
    const sourceUser = await one("SELECT id, name, email FROM users WHERE email = $1", [normalizeEmail(DEMO_DIAGNOSIS_SOURCE_EMAIL)]);
    if (!sourceUser || demoUser.id === sourceUser.id) {
        return;
    }
    for (const fixture of DEMO_IMPORTED_DIAGNOSES) {
        const source = await one(`
          SELECT *
          FROM (
            SELECT d.*,
                   ROW_NUMBER() OVER (ORDER BY d.created_at DESC) AS diagnosis_no
            FROM diagnosis_sessions d
            WHERE d.user_id = $1
          ) ranked
          WHERE diagnosis_no = $2
          LIMIT 1
        `, [sourceUser.id, fixture.sourceNumber]);
        if (!source) {
            continue;
        }
        await query(`
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
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            patient_name = EXCLUDED.patient_name,
            patient_email = EXCLUDED.patient_email,
            pre_consultation_text = EXCLUDED.pre_consultation_text,
            transcript_json = EXCLUDED.transcript_json,
            diagnosis_json = EXCLUDED.diagnosis_json,
            formatted_summary = EXCLUDED.formatted_summary,
            created_at = EXCLUDED.created_at
        `, [
            fixture.id,
            demoUser.id,
            demoUser.name || "Demo Patient",
            demoUser.email || demoEmail,
            source.pre_consultation_text,
            source.transcript_json,
            source.diagnosis_json,
            retargetImportedDiagnosisSummary(source.formatted_summary, sourceUser, demoUser),
            source.created_at
        ]);
    }
}

export async function ensureConfiguredDemoUser() {
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
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            await query(`
              UPDATE users
              SET name = $1,
                  password_hash = $2,
                  email_verified = true,
                  updated_at = now()
              WHERE email = $3
            `, [name, hashSecret(password), email]);
            await ensureDemoImportedDiagnoses(email);
            return { ok: true, email };
        }
        await query(`
          INSERT INTO users (
            id,
            name,
            email,
            password_hash,
            email_verified,
            phone,
            phone_verified,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, true, null, false, now(), now())
        `, [createId(), name, email, hashSecret(password)]);
        await ensureDemoImportedDiagnoses(email);
        return { ok: true, email };
    }
    catch (error) {
        console.error("Demo user setup failed", error);
        return { ok: false, status: 500, message: "We could not prepare the demo login." };
    }
}

async function findUserByGoogleSub(googleSub) {
    return one("SELECT * FROM users WHERE google_sub = $1", [googleSub]);
}

async function invalidateOtps(email, purpose) {
    await query(`
      UPDATE otp_codes
      SET consumed = true
      WHERE email = $1
        AND purpose = $2
        AND consumed = false
    `, [normalizeEmail(email), purpose]);
}

async function recentOtp(email, purpose) {
    return one(`
      SELECT *
      FROM otp_codes
      WHERE email = $1
        AND purpose = $2
      ORDER BY last_sent_at DESC
      LIMIT 1
    `, [normalizeEmail(email), purpose]);
}

async function generateOtp(email, purpose, userId) {
    await invalidateOtps(email, purpose);
    const id = createId();
    const code = createOtp();
    await query(`
      INSERT INTO otp_codes (
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
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, false, now(), now())
    `, [id, userId, normalizeEmail(email), hashSecret(code), purpose, toSqlDate(new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000))]);
    const emailResult = await sendOtpEmail({ to: email, code, purpose });
    if (!emailResult.ok) {
        await query("UPDATE otp_codes SET consumed = true WHERE id = $1", [id]);
        return emailResult;
    }
    return { ok: true };
}

async function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    await query(`
      INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked)
      VALUES ($1, $2, $3, now(), $4, false)
    `, [createId(), userId, hashSecret(token), toSqlDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))]);
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
        const googleUser = await findUserByGoogleSub(input.googleSub);
        if (googleUser) {
            const [updatedUser] = await query(`
              UPDATE users
              SET name = $1,
                  email = $2,
                  email_verified = true,
                  auth_provider = 'google',
                  avatar_url = $3,
                  updated_at = now()
              WHERE id = $4
              RETURNING *
            `, [name, email, avatarUrl, googleUser.id]);
            return {
                ok: true,
                message: "Signed in with Google.",
                user: publicUser(updatedUser),
                sessionToken: await createSession(updatedUser.id)
            };
        }
        const emailUser = await findUserByEmail(email);
        if (emailUser) {
            if (emailUser.google_sub && emailUser.google_sub !== input.googleSub) {
                return {
                    ok: false,
                    status: 409,
                    message: "That email is already linked to another Google account."
                };
            }
            const [updatedUser] = await query(`
              UPDATE users
              SET name = $1,
                  google_sub = $2,
                  email_verified = true,
                  auth_provider = 'google',
                  avatar_url = $3,
                  updated_at = now()
              WHERE id = $4
              RETURNING *
            `, [name, input.googleSub, avatarUrl, emailUser.id]);
            return {
                ok: true,
                message: "Signed in with Google.",
                user: publicUser(updatedUser),
                sessionToken: await createSession(updatedUser.id)
            };
        }
        const id = createId();
        const [user] = await query(`
          INSERT INTO users (
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
          ) VALUES ($1, $2, $3, $4, true, null, false, $5, 'google', $6, now(), now())
          RETURNING *
        `, [
            id,
            name,
            email,
            hashSecret(`google:${input.googleSub}:${crypto.randomBytes(16).toString("hex")}`),
            input.googleSub,
            avatarUrl
        ]);
        return {
            ok: true,
            message: "Signed in with Google.",
            user: publicUser(user),
            sessionToken: await createSession(user.id)
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
    const name = normalizeText(input.name);
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
        const existingUser = await findUserByEmail(email);
        if (existingUser?.email_verified) {
            return {
                ok: false,
                status: 409,
                message: "An account with this email already exists. Try signing in instead."
            };
        }
        let user;
        if (existingUser) {
            [user] = await query(`
              UPDATE users
              SET name = $1,
                  password_hash = $2,
                  updated_at = now()
              WHERE email = $3
              RETURNING *
            `, [name, hashSecret(input.password), email]);
        }
        else {
            [user] = await query(`
              INSERT INTO users (
                id,
                name,
                email,
                password_hash,
                email_verified,
                phone,
                phone_verified,
                created_at,
                updated_at
              ) VALUES ($1, $2, $3, $4, false, null, false, now(), now())
              RETURNING *
            `, [createId(), name, email, hashSecret(input.password)]);
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
        const user = await findUserByEmail(email);
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
            sessionToken: await createSession(user.id)
        };
    }
    catch (error) {
        console.error("Login failed", error);
        return { ok: false, status: 500, message: "We could not sign you in. Please try again." };
    }
}

export async function verifyOtp(input) {
    const email = normalizeEmail(input.email);
    const code = normalizeText(input.code);
    try {
        const otp = await recentOtp(email, input.purpose);
        if (!otp || otp.consumed || new Date(otp.expires_at).getTime() < Date.now() || otp.attempts >= 5) {
            return { ok: false, status: 400, message: "That code is no longer active. Please request a new one." };
        }
        if (!/^\d{6}$/.test(code) || !verifySecret(code, otp.code_hash)) {
            const attempts = otp.attempts + 1;
            await query(`
              UPDATE otp_codes
              SET attempts = $1,
                  consumed = CASE WHEN $2 >= 5 THEN true ELSE consumed END
              WHERE id = $3
            `, [attempts, attempts, otp.id]);
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
        await query("UPDATE otp_codes SET consumed = true WHERE id = $1", [otp.id]);
        let user = await one(`
          SELECT *
          FROM users
          WHERE id = $1 OR email = $2
          ORDER BY CASE WHEN id = $3 THEN 0 ELSE 1 END
          LIMIT 1
        `, [otp.user_id, email, otp.user_id]);
        if (!user) {
            return { ok: false, status: 400, message: "We could not find an account for this code." };
        }
        if (input.purpose === "signup_verification") {
            [user] = await query(`
              UPDATE users
              SET email_verified = true,
                  updated_at = now()
              WHERE id = $1
              RETURNING *
            `, [user.id]);
        }
        return {
            ok: true,
            message: "Code verified.",
            user: publicUser(user),
            sessionToken: await createSession(user.id)
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
        const user = await findUserByEmail(email);
        if (!user) {
            return { ok: false, status: 404, message: "We could not find an account for that email." };
        }
        const lastOtp = await recentOtp(email, input.purpose);
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
        const user = await findUserByEmail(email);
        if (user) {
            const otpResult = await generateOtp(email, "password_reset", user.id);
            if (!otpResult.ok) {
                return {
                    ok: false,
                    status: otpResult.status,
                    message: otpResult.message
                };
            }
        }
        return {
            ok: true,
            message: genericMessage
        };
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
        const [user] = await query(`
          UPDATE users
          SET password_hash = $1,
              email_verified = true,
              updated_at = now()
          WHERE email = $2
          RETURNING *
        `, [hashSecret(input.newPassword), normalizeEmail(input.email)]);
        if (!user) {
            return { ok: false, status: 400, message: "We could not update that account." };
        }
        await revokeUserSessions(user.id);
        return {
            ok: true,
            message: "Password updated.",
            user: publicUser(user),
            sessionToken: await createSession(user.id)
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
        const sessions = await query(`
          SELECT *
          FROM sessions
          WHERE revoked = false
            AND expires_at > $1
          ORDER BY created_at DESC
        `, [toSqlDate(new Date())]);
        for (const session of sessions) {
            if (verifySecret(token, session.token_hash)) {
                const user = await one("SELECT * FROM users WHERE id = $1", [session.user_id]);
                return user ? publicUser(user) : null;
            }
        }
    }
    catch (error) {
        console.error("Session lookup failed", error);
    }
    return null;
}

export async function updateUserProfile(userId, input) {
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
        const currentUser = await one("SELECT * FROM users WHERE id = $1", [userId]);
        if (!currentUser) {
            return { ok: false, status: 404, message: "User not found." };
        }
        const emailOwner = await findUserByEmail(email);
        if (emailOwner && emailOwner.id !== userId) {
            return { ok: false, status: 409, message: "That email is already used by another account." };
        }
        const [updatedUser] = await query(`
          UPDATE users
          SET name = $1,
              email = $2,
              phone = $3,
              email_verified = CASE WHEN email = $4 THEN email_verified ELSE false END,
              updated_at = now()
          WHERE id = $5
          RETURNING *
        `, [name, email, phone || null, email, userId]);
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

export async function searchUserNames(queryText) {
    const searchText = normalizeText(queryText);
    if (!searchText) {
        return [];
    }
    const likeQuery = `%${searchText.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const users = await query(`
      SELECT id, name
      FROM users
      WHERE name ILIKE $1 ESCAPE '\\'
      ORDER BY name ASC
      LIMIT 25
    `, [likeQuery]);
    return users.map((user) => ({
        id: user.id,
        name: user.name
    }));
}

export async function getLatestPatientIntake(userId) {
    if (!userId) {
        return null;
    }
    const intake = await one(`
      SELECT *
      FROM patient_intakes
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);
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
        createdAt: displayDate(intake.created_at),
        updatedAt: displayDate(intake.updated_at)
    };
}

export async function savePatientIntake(userId, input) {
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
    await query(`
      INSERT INTO patient_intakes (
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
    `, [createId(), userId, age, gender, heightCm, weightKg, allergies || null, mainConcern]);
    return {
        ok: true,
        message: "Patient information saved.",
        intake: await getLatestPatientIntake(userId)
    };
}

function publicMedicationReminder(reminder) {
    return {
        id: reminder.id,
        title: reminder.medicine_name,
        scheduledAt: displayDate(reminder.scheduled_at),
        channel: reminder.channel,
        status: reminder.status,
        repeatRule: reminder.repeat_rule || "none",
        scheduleStartDate: reminder.schedule_start_date || "",
        scheduleEndDate: reminder.schedule_end_date || "",
        customInterval: reminder.custom_interval || 1,
        customUnit: reminder.custom_unit || "",
        customWeekdays: safeJsonParse(reminder.custom_weekdays_json, []),
        details: reminder.details || "",
        emailSentAt: displayDate(reminder.email_sent_at),
        emailError: reminder.email_error
    };
}

export async function createMedicationReminder(userId, input) {
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
    const [reminder] = await query(`
      INSERT INTO medication_reminders (
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
      ) VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9, $10, $11, $12, now(), now())
      RETURNING *
    `, [
        createId(),
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
    ]);
    return {
        ok: true,
        message: "Medication reminder set.",
        reminder: publicMedicationReminder(reminder)
    };
}

export async function getMedicationReminderById(id) {
    const reminder = await one("SELECT * FROM medication_reminders WHERE id = $1", [id]);
    return reminder ? publicMedicationReminder(reminder) : null;
}

export async function listActiveMedicationReminders(userId) {
    if (!userId) {
        return [];
    }
    const reminders = await query(`
      SELECT *
      FROM medication_reminders
      WHERE user_id = $1
        AND status = 'scheduled'
        AND scheduled_at > $2
      ORDER BY scheduled_at ASC
    `, [userId, toSqlDate(new Date())]);
    return reminders.map(publicMedicationReminder);
}

export async function listDueMedicationReminders() {
    return query(`
      SELECT medication_reminders.*, users.name AS user_name, users.email AS user_email
      FROM medication_reminders
      JOIN users ON users.id = medication_reminders.user_id
      WHERE medication_reminders.status = 'scheduled'
        AND medication_reminders.scheduled_at <= $1
      ORDER BY medication_reminders.scheduled_at ASC
    `, [toSqlDate(new Date())]);
}

export async function listScheduledMedicationReminders() {
    return query(`
      SELECT medication_reminders.*, users.name AS user_name, users.email AS user_email
      FROM medication_reminders
      JOIN users ON users.id = medication_reminders.user_id
      WHERE medication_reminders.status = 'scheduled'
        AND medication_reminders.scheduled_at > $1
      ORDER BY medication_reminders.scheduled_at ASC
    `, [toSqlDate(new Date())]);
}

export async function markMedicationReminderTaken(userId, reminderId) {
    const updated = await query(`
      UPDATE medication_reminders
      SET status = 'taken',
          updated_at = now()
      WHERE id = $1
        AND user_id = $2
        AND status = 'scheduled'
      RETURNING id
    `, [reminderId, userId]);
    return updated.length > 0
        ? { ok: true, message: "Medication marked as taken." }
        : { ok: false, status: 404, message: "Active medication reminder was not found." };
}

export async function cancelMedicationReminder(userId, reminderId) {
    const deleted = await query(`
      DELETE FROM medication_reminders
      WHERE id = $1
        AND user_id = $2
        AND status = 'scheduled'
      RETURNING id
    `, [reminderId, userId]);
    return deleted.length > 0
        ? { ok: true, message: "Reminder cancelled." }
        : { ok: false, status: 404, message: "Active reminder was not found." };
}

export async function markMedicationReminderSent(reminderId) {
    await query(`
      UPDATE medication_reminders
      SET status = 'sent',
          email_sent_at = now(),
          email_error = NULL,
          updated_at = now()
      WHERE id = $1
    `, [reminderId]);
}

export async function rescheduleMedicationReminder(reminderId, scheduledAt) {
    await query(`
      UPDATE medication_reminders
      SET status = 'scheduled',
          scheduled_at = $1,
          email_sent_at = NULL,
          email_error = NULL,
          updated_at = now()
      WHERE id = $2
    `, [toSqlDate(scheduledAt), reminderId]);
}

export async function markMedicationReminderFailed(reminderId, message) {
    await query(`
      UPDATE medication_reminders
      SET status = 'failed',
          email_error = $1,
          updated_at = now()
      WHERE id = $2
    `, [String(message || "Email failed").slice(0, 500), reminderId]);
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
        createdAt: displayDate(session.created_at)
    };
}

export async function saveDiagnosisSession(user, intake, transcript, diagnosis) {
    if (!user?.id) {
        return { ok: false, status: 401, message: "Please sign in before saving a diagnosis." };
    }
    if (!intake) {
        return { ok: false, status: 400, message: "Save your concern before diagnosis can continue." };
    }
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
    const [session] = await query(`
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
        createId(),
        user.id,
        user.name,
        user.email || "",
        preConsultationText,
        JSON.stringify(transcript),
        JSON.stringify(diagnosis),
        formattedSummary,
        toLocalSqlDateTime()
    ]);
    return {
        ok: true,
        message: "Diagnosis saved to history.",
        diagnosisSession: publicDiagnosisSession(session)
    };
}

export async function getDiagnosisSessionById(userId, id) {
    const session = await one(`
      SELECT *
      FROM diagnosis_sessions
      WHERE user_id = $1
        AND id = $2
    `, [userId, id]);
    return session ? publicDiagnosisSession(session) : null;
}

export async function listDiagnosisSessions(userId, limit = 20) {
    if (!userId) {
        return [];
    }
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20));
    const sessions = await query(`
      SELECT *
      FROM diagnosis_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `, [userId]);
    return sessions.map(publicDiagnosisSession);
}

export async function revokeSession(token) {
    if (!token) {
        return;
    }
    try {
        const sessions = await query(`
          SELECT id, token_hash
          FROM sessions
          WHERE revoked = false
            AND expires_at > $1
        `, [toSqlDate(new Date())]);
        for (const session of sessions) {
            if (verifySecret(token, session.token_hash)) {
                await query("UPDATE sessions SET revoked = true WHERE id = $1", [session.id]);
                return;
            }
        }
    }
    catch (error) {
        console.error("Session revoke failed", error);
    }
}

async function revokeUserSessions(userId) {
    await query("UPDATE sessions SET revoked = true WHERE user_id = $1", [userId]);
}
