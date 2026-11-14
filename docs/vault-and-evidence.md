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

## Optional Google Drive automatic sync

Google sign-in does not enable Drive. The optional connection uses Google's popup authorization-code model with only `drive.file`. The authenticated, same-origin endpoint additionally requires `X-Requested-With: XmlHttpRequest` and an explicit consent flag. Shared demo accounts cannot connect. A new connection explicitly covers all existing and future ready vault records, including original files, summaries, notes and saved analyses.

Refresh credentials are encrypted with AES-256-GCM, per-account associated data, a random nonce, and an HKDF-derived key in a separate domain from the server-only GOOGLE_CLIENT_SECRET. Raw credentials are never returned to the browser or logged. Rotating the Google client secret requires reconnecting Drive. Disconnect deletes the retained credential, invalidates worker leases, and stops further requests; already-issued requests may finish. It does not revoke Google sign-in or remove Drive copies. Users can revoke the app grant in Google Account settings.

Successful upload finalization, metadata/notes edits, saved analyses and restores trigger a server `after` worker. The response does not wait for Google and a failed copy does not undo a vault save. Pending work is determined from exact Postgres document timestamps versus completed sync versions. Account leases serialize workers; a generation invalidates old workers after reconnection. A bounded worker processes up to three records. Open vault pages poll every 15 seconds and resume pending work automatically. There is no paid queue or scheduled retry service: a backlog or provider outage that outlives a worker resumes on the next vault visit/save. This is not an unattended retry SLA.

Managed originals and text sidecars go into `KAMAL Health / <logical folder>`. App properties recover existing copies on retries and reconnection. Both files move when the record's folder changes. KAMAL's saved data is authoritative: later updates overwrite its managed Drive copies; Drive edits do not flow back. Trashed and unfinished vault records are excluded, and KAMAL trash does not delete existing Drive copies. Nothing is made public, and doctor sharing remains controlled by the user in Drive.

Validation covers encryption/account binding/tampering, exact timestamp preservation, update and folder-move behavior, complete summary contents, partial failure retaining pending work, revoked grants, concurrent leases, disconnect, and corrupt original rejection. Live authorization must be approved separately because background access and automatic transmission differ from the earlier single-file copy consent.

No new paid service, billing account or upgrade is required or activated.

References: https://developers.google.com/identity/oauth2/web/guides/use-code-model and https://developers.google.com/workspace/drive/api/guides/api-specific-auth .

Drive navigation: the vault shows the managed root folder and up to 200 current-account synced record links (original, summary/notes and logical folder). Record pages filter to their own document. IDs are validated before generating Google Drive URLs. The status endpoint joins by authenticated account and connection generation; no Drive token is returned. Older synced records automatically refresh once to populate navigation IDs. The UI explicitly labels sync ON and disables connection from the shared demo.
