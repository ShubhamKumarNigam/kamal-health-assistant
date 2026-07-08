# KAMAL Health Assistant — Project Summary

## Purpose
KAMAL is a Next.js web app for a multilingual health assistant workflow with:
- patient onboarding (age/gender/allergies/concern),
- guided diagnosis chat with AI,
- diagnosis history and report generation,
- medication reminders,
- report/analyser/transcription/translation tools,
- and a Gmail/Resend email pathway for summaries and reminders.

The frontend and APIs are in a single Next.js app directory with API routes implemented in app-router style.

## Technology Stack
- Framework: Next.js 15.1, React 19
- Styling: Tailwind CSS 3.4
- DB: Neon Postgres via `@neondatabase/serverless`
- Auth/session: cookie-based, custom Postgres-backed sessions
- AI services: Groq API (chat, transcription, image-aware prompts)
- Email: Resend
- Language: custom multilingual UI layer (`en`, `hi`, `bn`, `ar`) with backend text translation route
- Diagnostics/security style: explicit server-side validation, schema normalization, and conservative warning text in health responses

## Environment and Runtime
- Next runtime for API routes is `nodejs` for Groq/DB/email paths.
- Session cookies:
  - `kamal_session` for authentication
  - `kamal_diagnosis_session` for active diagnosis flow
- DB connection: `process.env.DATABASE_URL || process.env.POSTGRES_URL`
- Optional/required runtime env in `.env.example`:
  - `DATABASE_URL`
  - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
  - `GROQ_API_KEY`
  - `KAMAL_JWT_SECRET`
- Groq key resolution uses `.env.local` first, then process env.

## Directory and Route Structure
- `app/` page routes:
  - `/` landing
  - `/login`
  - `/session` and `/session/diagnosis`
  - `/onboarding/history`, `/onboarding/language`
  - `/reminders`
  - `/diet`
  - `/search`
  - `/image-upload`
  - `/reports/demo`
  - `/diagnosis/demo`
  - `/profile`
  - `/database`
  - `/emergency`
  - report/history flows are served by `/onboarding/history`, `/reports/demo`, and related API endpoints
- `components/` includes 23 reusable React components for auth flow, intake, diagnosis UI, reminders, report actions, language switching, and translation support.
- `lib/` contains auth, DB, AI, reminder, email, and localization helpers.

## API Surface (app/api)

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/verify-otp` (supports signup verification and password reset purposes)
- `POST /api/auth/resend-otp`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- Google OAuth:
  - `GET /api/auth/google`
  - `GET /api/auth/google/callback`

### Patient intake and sessions
- `GET/POST /api/patient-intake`
- `POST /api/diagnosis/session`
- `POST /api/diagnosis/chat`

### Data and reporting
- `GET /api/reminders` (also triggers due reminder processing)
- `POST /api/reminders`
- `PATCH /api/reminders/[id]` (`taken`/`cancel` handling)
- `POST /api/reports/mail` (mail latest diagnosis summary)
- `POST /api/history/mail` (mail assembled history summary)

### AI helper tooling
- `POST /api/analyser` (file upload + query summarizer/analyser)
- `POST /api/transcribe` (audio to text using Whisper model)
- `POST /api/translate` (bulk UI text translation)
- `GET /api/search` (in-app search + user lookup)
- `PUT /api/profile` (name/email/phone updates)
- `POST /api/profile` is not present; profile updates are through `GET/PUT /api/profile`

### Misc
- `POST /api/analyser`, `POST /api/transcribe`, and `POST /api/translate` return model name in successful responses for traceability.

## Core Domain Modules

### `lib/auth/sqliteStore.js`
This is the central persistence/access layer and exposes:
- User creation and lookup (email + password + optional Google identities)
- OTP lifecycle (signup verification and password reset):
  - 6-digit numeric code
  - expiry and attempt counters
  - cooldown gate on resend
- Auth sessions with revocation and expiry checks
- Patient intake persistence/validation
- Diagnosis session persistence (transcript + normalized diagnosis JSON + formatted summary)
- Medication reminders CRUD and status transitions
- Profile update helpers and name/email validation
- Debug/snapshot helper for DB introspection

### `lib/auth/diagnosisSessionJwt.js`
- Implements short-lived diagnosis-gated JWT-like token format with custom HMAC signing.
- Validates user+intake binding for diagnosis continuation.
- TTL is 2 hours with secure cookie options for origin-aware `secure` handling.

### `lib/reminderScheduler.js`
- In-process timer map (`globalThis.__kamalReminderTimers`)
- Schedules reminders with `setTimeout`
- Processes due reminders at API access time (`processDueMedicationReminders`) and per-listing access
- Supports recurring repeat rules: `none`, `daily`, `weekly`, `monthly`, `yearly`, `weekdays`
- Failure/sent states are persisted via DB updates in `sqliteStore`.

### `lib/auth/resendEmail.js`
- Sends:
  - OTP email
  - medication reminders
  - diagnosis history email
  - patient report email
- Includes HTML templates with safety/disclaimer sections.
- Returns `{ ok, status, message }` style outcomes to support graceful API error fallback.

### `lib/patientReport.js` and `lib/dietPlan.js`
- Build AI-generated JSON outputs with strict schemas and parsing normalization.
- Both include deterministic fallbacks for missing API keys or malformed responses.
- Use conservative medical guidance constraints and caution statements.

### `lib/historySummary.js`
- Builds compact history summary string from intake + multiple diagnosis sessions.

### `lib/languages.js`
- Supported language metadata for frontend and translation endpoint.

### `lib/googleOAuth.js`
- Validates/reads Google credentials
- Builds safe post-login redirection behavior
- Returns OAuth config + state helpers

## Database Schema Notes (current code-driven model)
Tables created/ensured at runtime:
- `users` with fields for email/password, phone, verification flags, Google fields (`google_sub`, `auth_provider`, `avatar_url`)
- `otp_codes` with purpose-scoped OTPs
- `sessions` with hashed token + expiry/revocation
- `patient_intakes` with vital user context and concern
- `medication_reminders` with status/channel/repeat rule/details
- `diagnosis_sessions` with transcript and diagnosis snapshots
- `login_info` Postgres view is created from user columns for read convenience

Migration strategy is schema-friendly: tables and indexes are created lazily on first database access.

## Behavior Characteristics / Important Notes
- Frontend pages and API contracts are tightly coupled by shared helpers; API returns `{ ok: false, message: ... }` and status codes in failures.
- AI calls are defensive:
  - parse JSON with fence stripping,
  - fallback objects when AI response is invalid or unavailable,
  - explicit model names in successful responses.
- Reminder email channel has schema values for both WhatsApp and Email, but outbound sending is currently implemented as email through Resend.
- Google login path supports account linking and creates users with verified status when available.

## Current State Snapshot
- The hosted demo uses Vercel plus Neon Postgres; local `kamal.db` files are ignored and should not be committed.
- Production database schema is created lazily when an authenticated flow first touches the store.
- `summary.md` can be kept as technical orientation for future hardening and test coverage.
