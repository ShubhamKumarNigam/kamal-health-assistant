# KAMAL: Multilingual Patient-Facing Health Assistant for Accessible Care

KAMAL is a **Next.js** web application that provides a multilingual AI-powered health assistant workflow. It helps patients through onboarding, guided diagnosis, report generation, medication reminders, and more — all with multilingual support.

## Features

- **Patient Onboarding** — Age, gender, allergies, and health concern collection
- **AI-Powered Diagnosis Chat** — Guided conversation with Groq AI for symptom assessment
- **Diagnosis History & Reports** — View past sessions and generate detailed reports
- **Medication Reminders** — Schedule and manage reminders with email notifications
- **Multilingual Support** — UI and translation in English, Hindi, Bengali, Arabic
- **Audio Transcription** — Transcribe audio to text using Whisper via Groq
- **File Analysis** — Upload and analyze medical documents
- **Email Reports** — Send diagnosis summaries via Resend
- **Google OAuth** — Sign in with Google

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Framework      | Next.js 15.1, React 19              |
| Styling        | Tailwind CSS 3.4                    |
| Database       | Neon Postgres via `@neondatabase/serverless` |
| AI Services    | Groq API (chat, transcription, vision) |
| Email          | Resend                              |
| Auth           | Cookie-based sessions, Google OAuth |
| Icons          | Lucide React                        |

## Getting Started

### Prerequisites

- Node.js 24.x
- A Neon Postgres database, exposed as `DATABASE_URL`
- A Groq API key
- (Optional) Resend API key for email features

### Environment Variables

Create `.env.local`:

```env
GROQ_API_KEY=your_groq_api_key
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
KAMAL_JWT_SECRET=your_jwt_secret
DATABASE_URL=postgres://user:password@host/database?sslmode=require
KAMAL_DEMO_EMAIL=demo@kamal-health-assistant.local
KAMAL_DEMO_PASSWORD=your_demo_password
KAMAL_DEMO_NAME=Demo Patient
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
app/              — Next.js App Router pages and API routes
├── api/          — Backend API endpoints
├── diagnosis/    — Diagnosis chat UI
├── onboarding/   — Patient onboarding flow
├── reminders/    — Medication reminder UI
├── reports/      — Report viewing and generation
├── profile/      — User profile management
└── ...
components/       — Reusable React components
lib/              — Shared utilities (auth, DB, AI, email, i18n)
public/           — Static assets
scripts/          — Utility scripts
```

## Vercel Deployment

Recommended hosting for the reviewer demo is Vercel plus Neon Postgres.

Required production environment variables:

- `DATABASE_URL`
- `GROQ_API_KEY`
- `KAMAL_JWT_SECRET`
- `KAMAL_DEMO_EMAIL`
- `KAMAL_DEMO_PASSWORD`
- `KAMAL_DEMO_NAME`

Optional production environment variables:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

The app creates its Postgres schema lazily on first database access. The `/database` page shows a masked snapshot for reviewer verification.

## API Routes

| Route                          | Description                      |
| ------------------------------ | -------------------------------- |
| `POST /api/auth/*`             | Signup, login, OTP, password     |
| `GET /api/auth/google`         | Google OAuth login               |
| `POST /api/patient-intake`     | Save patient intake data         |
| `POST /api/diagnosis/chat`     | AI diagnosis chat endpoint       |
| `GET/POST /api/reminders`      | List/create reminders            |
| `POST /api/reports/mail`       | Email diagnosis report           |
| `POST /api/analyser`           | Upload & analyze documents       |
| `POST /api/transcribe`         | Audio transcription              |
| `POST /api/translate`          | Translate UI text                |

## License

[MIT](LICENSE)
