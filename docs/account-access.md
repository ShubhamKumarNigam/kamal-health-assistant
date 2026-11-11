# Account access and activation

The homepage offers Create your account and Sign in separately from Try Demo. Google/email registration opens `/workspace`; `/demo` remains synthetic. Existing patient history, conversations, analysis, reports and reminders are account tools. Showcase-only wearables, family context and temporary sharing are not live integrations.

## Google ownership replacement

Owner: Shubham Kumar Nigam. New Cloud project: KAMAL Health (`dazzling-scheme-514418-t5`). Configure an External Google Auth application, then a Web application OAuth client.

- Authorized JavaScript origin: `https://kamal-health-assistant.vercel.app`
- Authorized redirect URI, exact: `https://kamal-health-assistant.vercel.app/api/auth/google/callback`
- Update existing Vercel production `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` together, then redeploy.
- Never commit/download client secrets into this repository or paste them into chat.
- Use only openid/email/profile sign-in scopes. Check Audience publishing status before allowing general users; test mode is not the public launch configuration.
- Test a new and existing Google account through the callback into `/workspace`, including logout and sign-in again. A successful redirect to Google alone does not establish working login.
- Changing OAuth client ownership preserves existing users through verified-email matching. Existing sessions and database records are retained.

Email signup also requires working Resend credentials and a verified sender domain. A provider test sender is not sufficient evidence that arbitrary users can receive codes. Verify delivery, expiry, password reset and account isolation before public rollout.

## Optional Twilio Verify integration

Implemented for Google/email accounts: verify a number in Profile, then sign in with SMS. Numbers are stored in a separate unique `phone_identities` table. Editing the ordinary contact phone field does not establish an authentication identity. A number already owned by another account is never transferred automatically.

Configure these server-only Vercel variables after setting up Twilio billing and a Verify Service:

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
KAMAL_SMS_ALLOWED_PREFIXES=+971,+91
```

Choose supported countries intentionally; configure Twilio Verify Fraud Guard, geographical permissions, service rate limits and billing alerts as well. No SMS is sent without all four settings. The default application caps are one start per number per minute, five per number/hour, ten per source IP/hour and thirty total/hour. These are initial abuse limits, not an automatic spending guarantee.

Challenges expire after ten minutes, allow at most five checks, are bound to an HttpOnly browser cookie and (for linking) the signed-in account, and are atomically consumed after provider approval. OTPs and provider credentials are not stored in the application database. Existing session cookies are issued only after verification of a previously linked identity. Provider errors are sanitized.

Before enabling publicly: test SMS delivery with an owned number, wrong and expired codes, replay/concurrent verification, cross-account linking attempts, number changes, rate limits and logout. Review account recovery for lost/recycled mobile numbers. SMS is a convenience login and is not phishing-resistant MFA. Provider-backed and database concurrency tests require a staging database and configured Twilio service; local unit tests do not replace them.
