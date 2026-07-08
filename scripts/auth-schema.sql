PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  email_verified integer NOT NULL DEFAULT 0,
  phone text,
  phone_verified integer NOT NULL DEFAULT 0,
  google_sub text,
  auth_provider text NOT NULL DEFAULT 'email',
  avatar_url text,
  created_at text NOT NULL DEFAULT (datetime('now')),
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

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
  email_sent_at text,
  email_error text,
  created_at text NOT NULL DEFAULT (datetime('now')),
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS medication_reminders_user_scheduled_idx
  ON medication_reminders (user_id, status, scheduled_at);

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
