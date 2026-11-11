export function phoneAuthConfigured(env = process.env) {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID && env.KAMAL_SMS_ALLOWED_PREFIXES);
}

export function normalizePhone(value) {
  const phone = String(value || '').trim().replace(/[\s()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function phoneAllowed(phone, env = process.env) {
  return (env.KAMAL_SMS_ALLOWED_PREFIXES || '').split(',').map(s => s.trim())
    .filter(s => /^\+[1-9]\d{0,3}$/.test(s)).some(prefix => phone.startsWith(prefix));
}

export async function verifyProvider(action, fields, {env = process.env, fetcher = fetch} = {}) {
  if (!phoneAuthConfigured(env)) throw new Error('Mobile sign-in is not available yet. Use Google or email.');
  const path = action === 'start' ? 'Verifications' : 'VerificationCheck';
  const response = await fetcher(`https://verify.twilio.com/v2/Services/${encodeURIComponent(env.TWILIO_VERIFY_SERVICE_SID)}/${path}`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: {Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams(fields)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(response.status === 429 ? 'Too many requests. Please wait before trying again.' : 'We could not verify this mobile number. Please try again later.');
  return {sid: data.sid, status: data.status};
}
