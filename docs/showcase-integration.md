# Showcase integration — 11 November 2026

The public homepage now uses the KAMAL continuity design, with a 16–18px primary reading scale and larger controls. `/demo` opens the synthetic patient experience. `/workspace` is a new account hub guarded by existing `kamal_session` authentication.

All existing API handlers, authentication/database modules, session cookies, Google callback paths, email/OTP flows and environment-variable names remain unchanged. Existing feature routes keep their URLs: `/session`, `/session/diagnosis`, `/onboarding/history`, `/reminders`, `/image-upload`, `/search`, `/profile`, `/reports/demo`, `/diet` and others. Route-group folders do not appear in URLs. Regression tests compare their page bodies and critical implementation files against the baseline commit.

Account and showcase have independent root layouts. Existing Tailwind styles and automatic cloud translation remain scoped to account pages; the synthetic demo does not inherit the translation provider. Navigating between root layouts reloads the document, avoiding style and language-state leakage. My account links are available on desktop and mobile.

Synthetic demo state never writes to the patient database. Its encrypted browser vault remains distinct from account storage. No blanket service worker is installed: authenticated pages and API responses must not be cached by the standalone demo's former worker.

Fonts, PDF worker and English OCR assets are generated from pinned npm dependencies during prebuild/predev. Vercel continues using the root Next.js app with existing environment variables. Expo source is under apps/mobile, excluded from the web build.

Run npm test, npm run typecheck, npm run lint and npm run build. Regression tests require the baseline Git commit; shallow CI checkouts should fetch history. Full authenticated local testing requires a staging database and provider credentials. No secrets are copied into source.

Remaining showcase limits: synthetic wearables, bounded conversation (not an LLM), partial supporting-copy translation, no native device certification, no live HealthKit/Health Connect, and no server-backed temporary QR sharing. Existing signed-in provider services remain available separately.
