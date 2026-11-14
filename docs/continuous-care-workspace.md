# Continuous care workspace

## Implemented in this release

- A new signed-in layout, readable typography, original lotus logo, initials avatars and account-derived dashboard. Authentication, account IDs and existing records retain their existing contracts.
- Optional patient details. Blank age, height and weight are null, and missing allergies are unknown rather than interpreted as absent. Existing numeric storage uses whole units.
- Conversation drafts persist per account/intake. Completed conversations are reused only with the user's saved-history option enabled. Up to three recent summaries are supplied as unconfirmed historical context, not current symptoms or instructions.
- Conversation AI explicitly uses the configured Groq provider instead of silently selecting the legacy OpenCode provider. At most five focused follow-up questions precede a summary. Provider errors preserve the draft; no substitute diagnosis is fabricated.
- PDF/image attachments extract report text in the browser. They are not diagnostic image interpretation; larger reports use the separate report analyser.
- Connected Health accepts manual measurements and reviewed CSV imports, validates units and timestamps, and scopes storage to the signed-in user. Duplicate source/type/time records are skipped. Invalid batches are rejected atomically.
- On-demand trend observations compare three complete consecutive UTC days with at least seven earlier recorded days from the same source. These are descriptive, unvalidated heuristics, not clinical alerts or background monitoring.
- Profile location is opt-in browser geolocation, displays device-reported accuracy, stays in component memory, and can be cleared. The external map link explicitly shares coordinates with OpenStreetMap when clicked.

## Pipeline and data boundaries

Authenticated request -> user-scoped intake/draft -> optional historical summaries -> deterministic urgency screening -> bounded provider request -> validated structured response -> saved draft or conversation summary.

Existing Neon/Postgres accounts remain in place. Schema changes are additive except allowing null optional intake fields. No account migration, identity replacement, OAuth scope expansion or billing changes are required. Existing Google sign-in remains independent of mobile verification; Twilio remains India trial only.

Medical conversation content is sent to the configured AI provider when submitted. This cloud workspace is not end-to-end encrypted or local-only. Do not represent the showcase's local encrypted demo vault as the production account storage architecture.

## Remaining gaps and external dependencies

| Capability | Current production scope / next dependency |
| --- | --- |
| Fitbit / Pixel | Manual CSV import now. Google Health API registration, restricted-scope review, separate OAuth consent, token storage and scheduled ingestion required for direct sync. Basic Google account login must not request health scopes. |
| Apple Health / Android Health Connect | Native app permissions and signed platform builds required; a browser cannot directly read either store. |
| CGM | Manual glucose readings/CSV now; manufacturer-specific developer access, consent and data contracts required. No dosing recommendations. |
| Temple | Product identified as temple.com. No verified public integration contract found on reviewed public pages. Requires vendor API/export documentation; no claim of a live connector. |
| Garmin / Oura | Separate approved developer credentials and consent required. |
| Proactivity | On-demand descriptive trend cards now; background ingestion, queues, notification permissions, delivery and clinical validation remain future work. |
| Mobile app | Existing Expo showcase is a prototype, not a deployed native health-data integration. |
| Memory | Latest intake and three recent summaries with opt-in; not a complete longitudinal clinical record or automatic extraction of every historical fact. |
| Privacy controls | Account-scoped server storage; full self-service export/deletion and granular consent ledger need further implementation. |
| Clinical safety | Automated screening and prompt constraints are not clinically validated and cannot detect every emergency. Language coverage of deterministic screening is limited. |
| AI capacity | Shared free-provider quotas still apply. No paid plan activated and no unlimited availability promise. |

## Delivery priorities

1. Verify the new conversation path and optional intake in the deployed environment, including draft recovery and authentication regression checks.
2. Obtain one wearable's approved integration contract; implement separate opt-in authorization, revocation, source timestamps and ingestion before labeling it connected.
3. Add durable scheduled ingestion and notification delivery with rate limits, user controls and monitoring.
4. Complete native health-store bridges and patient export/deletion controls; perform privacy, security and clinical review before broader health-data integrations.

## Validation

Local TypeScript check and 45 tests pass, including optional patient data, CSV validation/unit conversion and source-separated trend behavior. Existing unchanged authentication routes retain baseline comparison coverage. Rebuilt conversation and intake routes are intentionally excluded from byte-for-byte legacy tests. Deployment build and authenticated browser checks must be recorded separately; local unit tests do not prove provider access or production database migrations.

References: https://developers.google.com/health/about and https://www.temple.com/ (reviewed during implementation).
