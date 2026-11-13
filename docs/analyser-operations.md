# Report analyser

The report analyser decodes PDFs locally with PDF.js and uses locally hosted English Tesseract OCR assets for scanned pages and report images. It sends extracted text, file metadata and the user's query to the configured provider. No report is stored by this route. OCR results must be checked against the original. It does not interpret radiology images.

Limits: 8 MB source file, 30 PDF pages, 80,000 extracted characters and 10,000 query characters. An unreadable page or oversized extracted text stops submission rather than silently truncating it. The API requires an existing authenticated session. Provider requests time out after 45 seconds; incomplete model output is rejected.

For an owner-managed Groq account, set production `GROQ_API_KEY` securely and `KAMAL_ANALYSER_PROVIDER=groq`. The analyser default is `openai/gpt-oss-120b`; optionally set `KAMAL_ANALYSER_MODEL`. Other tools continue to use their existing `KAMAL_AI_PROVIDER` configuration. Raw medical-image attachments in session are rejected with a clear limitation when this text-only analyser configuration is selected.

The previous analyser returned HTTP 400 from the provider with a generic message. It also used a regex against PDF bytes, which cannot decode ordinary compressed/scanned PDFs, and a retired Groq Scout fallback. The exact legacy OpenCode rejection was not logged. New diagnostics log only provider, model, status and a categorical error code, never report text, credentials or raw provider messages.

On 13 November 2026, production diagnostics confirmed that the owner's long report was rejected by Groq with HTTP 413. This is a request allowance failure, not temporary model congestion. HTTP 413 must never enter rate-limit retry handling, even when the provider mentions tokens per minute. The UI now tells users to split the report or increase the provider allowance. Full-report production validation remains pending an adequate provider allowance or a replacement provider.

Validation: unit tests for text limits and sanitized provider errors; browser tests of a compressed two-page synthetic PDF and scanned synthetic PDF; production build, lint and typecheck. Complete a live synthetic report test after the owner enters the provider key. A successful build alone does not prove provider access or billing readiness.

## Free-tier section processing

The report form splits extracted text into lossless UTF-8 sections of up to 3,500 bytes, preserving line boundaries where possible. It sends requests serially with a 65-second gap and permits at most two paced retries for HTTP 429. Output is limited to 2,200 tokens with low reasoning effort for GPT-OSS. The API validates section/query bounds. The UI supports cancellation and displays a complete report only after every section succeeds. Section results are combined mechanically, explicitly labelled as separate analyses rather than a combined clinical assessment. The free allowance is shared by the provider organization, so concurrent users and daily limits can still interrupt a job. This is a low-volume pilot workflow, not a capacity guarantee.

Google AI Studio for the owner's Attoflow account showed Google AI Pro but no API billing account; its existing project also reported no free-tier access. Gemini was not activated. Review developer API medical-use and sensitive-data restrictions before considering it for any report workflow.
