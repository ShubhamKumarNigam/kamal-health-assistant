# Vault, preferred language and evidence

## Account language

`users.preferred_language` is authoritative, defaults to `en`, and supports the existing English, Hindi, Bengali and Arabic options. Account preference updates are authenticated, same-origin and allowlisted. The conversation server reads the saved account value instead of trusting a request-level language override. Profile and conversation controls use the same endpoint. Page language refreshes on navigation to avoid borrowing another account's browser preference.

## Private Health Vault

Originals are stored in account-scoped Neon records, in 512 KiB chunks, to stay within Vercel request/response limits. The first release is bounded to 10 MiB per file and 50 MiB per account, including trash and unfinished uploads. Reserving bytes is an atomic conditional account update. SHA-256 and file signatures are checked before an upload becomes visible. Every original download part requires ownership and ready status, and the browser verifies the reassembled hash. No public file URL is created.

The UI supports queued uploads reviewed individually, editable categories/folders, summaries, dates, institutions, countries, tags, notes, search, original download and recoverable trash. New related files can use the same folder. These are logical account folders, not filesystem paths. Metadata edits do not overwrite original bytes. A complete, section-by-section analysis can be saved on the document; previous analyser results created before this release are not automatically imported.

AI organisation uses only the first 6,000 extracted characters and explicitly labels that coverage; the user reviews before saving. A complete analysis uses the existing paced section analyser, can be cancelled, and preserves the original if it fails. Extraction and AI output are unverified. Missing source facts are not filled with invented dates or diagnoses. OCR currently uses the existing English recogniser; non-English scans may need manual notes or a text-based original.

Limitations: no permanent-purge UI, automatic cleanup of unfinished uploads, large-scale object storage, document version history, universal OCR, or guarantee of automatic clinical classification. The 50 MiB cap intentionally prevents unbounded use of the existing database. Trash is recoverable and still counts against storage. The first list view is limited to 200 records.

## Citations

Ask KAMAL receives up to three previous conversation summaries only when history use is enabled, plus up to three vault documents explicitly selected for the request. Each supplied source has a server-generated ID and owner-only route. Source panels accept only IDs that were supplied, never arbitrary model-generated URLs. Linked internal sources show what the user reported or uploaded; they do not establish medical truth. Saved AI analyses remain labelled unverified.

A small allowlist currently retrieves NHS excerpts for bloating, headaches, blood tests and type 2 diabetes. Fetches have a timeout, no redirects, daily cache and no patient data in the request URL. Only successfully retrieved excerpts can be cited. This is not general web search or comprehensive clinical evidence coverage. Unsupported topics or failed retrieval show no linked external source. Citation presence does not prove that the model's reasoning is clinically correct. UI distinguishes a follow-up question with no citation from a sourced medical statement.

## Optional Google Drive

The browser uses Google's OAuth token model with `drive.file`, separately from sign-in. Access tokens stay only in component memory and expire; no refresh token is retained. Google Drive API and the app's JavaScript origin must be enabled/configured in the existing Google Cloud project. The user's explicit consent is required by Google.

Copy/update sends the selected original plus a text sidecar containing metadata, notes and saved analysis to a KAMAL Health / logical-folder location in the chosen Drive. App properties identify managed folders and per-record files so retries update the same copies. This is on-demand one-way copying, not background synchronization, Google Picker import, or automatic access to existing Drive folders. Partial failure can leave one copied file; retry updates it. Disconnect revokes the browser token, but preserves copies. Users control any further sharing directly in Drive. No doctor access or public sharing is granted by KAMAL.

No new paid service, billing account or upgrade is required or activated by this code.

References: Google Drive `drive.file` scope guidance, https://developers.google.com/workspace/drive/api/guides/api-specific-auth ; Google Identity token model, https://developers.google.com/identity/oauth2/web/guides/use-token-model .
