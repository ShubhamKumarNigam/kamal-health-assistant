import crypto from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {initializeAuthDatabase, createSessionForVerifiedPhone} from './sqliteStore';
import {normalizePhone, phoneAllowed, phoneAuthConfigured, verifyProvider} from './phoneProvider';

let schema;
function sql() { return neon(process.env.DATABASE_URL || process.env.POSTGRES_URL); }
async function query(statement, params = []) { return sql().query(statement, params); }
function digest(value) { return crypto.createHmac('sha256', process.env.TWILIO_AUTH_TOKEN).update(value).digest('hex'); }
async function ready() {
  if (!schema) schema = (async () => {
    await initializeAuthDatabase();
    await query(`CREATE TABLE IF NOT EXISTS phone_identities (phone text PRIMARY KEY, user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, verified_at timestamptz NOT NULL DEFAULT now())`);
    await query(`CREATE TABLE IF NOT EXISTS phone_auth_limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL)`);
    await query(`CREATE TABLE IF NOT EXISTS phone_auth_challenges (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, phone text NOT NULL, purpose text NOT NULL, provider_sid text NOT NULL, attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL, consumed boolean NOT NULL DEFAULT false)`);
  })().catch(error => { schema = undefined; throw error; });
  await schema;
}
async function rate(key, maximum, seconds) {
  const rows = await query(`INSERT INTO phone_auth_limits (key,hits,expires_at) VALUES ($1,1,now()+make_interval(secs=>$2))
    ON CONFLICT (key) DO UPDATE SET hits=CASE WHEN phone_auth_limits.expires_at<=now() THEN 1 ELSE phone_auth_limits.hits+1 END,
    expires_at=CASE WHEN phone_auth_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE phone_auth_limits.expires_at END
    WHERE phone_auth_limits.expires_at<=now() OR phone_auth_limits.hits<$3 RETURNING hits`, [digest(key),seconds,maximum]);
  if (!rows.length) throw new Error('Too many requests. Please wait before trying again.');
}
export async function startPhoneChallenge({phone:input, purpose, user, ip}) {
  if (!phoneAuthConfigured()) return {ok:false,status:503,message:'Mobile sign-in is not available yet. Use Google or email.'};
  const phone = normalizePhone(input);
  if (!phone || !phoneAllowed(phone)) return {ok:false,status:400,message:'Enter a supported mobile number with its country code.'};
  if (!['link','login'].includes(purpose)) return {ok:false,status:400,message:'Invalid request.'};
  if (purpose === 'link' && !user?.emailVerified) return {ok:false,status:401,message:'Sign in with a verified email account before linking a mobile number.'};
  await ready();
  await rate(`ip:${ip}`,10,3600);
  await rate(`phone-minute:${phone}`,1,60);
  await rate(`phone-hour:${phone}`,5,3600);
  await rate('global-hour',30,3600);
  // Remove only expired authentication metadata, never patient data.
  await query('DELETE FROM phone_auth_challenges WHERE expires_at < now()');
  await query('DELETE FROM phone_auth_limits WHERE expires_at < now()');
  const [identity] = await query('SELECT user_id FROM phone_identities WHERE phone=$1',[phone]);
  const token = crypto.randomBytes(32).toString('hex');
  const generic = {ok:true,token,message:'If this number is eligible, a verification code has been sent. Codes expire after 10 minutes.'};
  if ((purpose === 'login' && !identity) || (purpose === 'link' && identity && identity.user_id !== user.id)) return generic;
  const owner = purpose === 'link' ? user.id : identity.user_id;
  await query('UPDATE phone_auth_challenges SET consumed=true WHERE phone=$1 AND purpose=$2',[phone,purpose]);
  const sent = await verifyProvider('start',{To:phone,Channel:'sms'});
  if (sent.status !== 'pending' || !sent.sid) throw new Error('The SMS could not be sent. Please try again.');
  await query(`INSERT INTO phone_auth_challenges (id,user_id,phone,purpose,provider_sid,expires_at) VALUES ($1,$2,$3,$4,$5,now()+interval '10 minutes')`,[digest(token),owner,phone,purpose,sent.sid]);
  return generic;
}
export async function finishPhoneChallenge({token,code,user}) {
  if (!phoneAuthConfigured()) return {ok:false,status:503,message:'Mobile sign-in is not available yet.'};
  if (!/^[a-f0-9]{64}$/.test(token || '') || !/^\d{6}$/.test(String(code || ''))) return {ok:false,status:400,message:'Enter the six-digit code.'};
  await ready();
  const [challenge] = await query(`UPDATE phone_auth_challenges SET attempts=attempts+1 WHERE id=$1 AND NOT consumed AND expires_at>now() AND attempts<5 AND (purpose='login' OR user_id=$2) RETURNING *`,[digest(token),user?.id || '']);
  if (!challenge) return {ok:false,status:400,message:'This code is unavailable or expired. Request a new code.'};
  const checked = await verifyProvider('check',{VerificationSid:challenge.provider_sid,Code:String(code)});
  if (checked.status !== 'approved' || checked.sid !== challenge.provider_sid) return {ok:false,status:400,message:'The code did not match. Please try again.'};
  const used = await query('UPDATE phone_auth_challenges SET consumed=true WHERE id=$1 AND NOT consumed RETURNING id',[digest(token)]);
  if (!used.length) return {ok:false,status:400,message:'This code has already been used.'};
  if (challenge.purpose === 'link') {
    // A verified number never transfers between accounts automatically.
    await query(`INSERT INTO phone_identities(phone,user_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET phone=EXCLUDED.phone,verified_at=now()`,[challenge.phone,user.id]);
    return {ok:true,message:'Mobile number verified. You can now use SMS codes to sign in.'};
  }
  const [identity] = await query('SELECT user_id FROM phone_identities WHERE phone=$1 AND user_id=$2',[challenge.phone,challenge.user_id]);
  if (!identity) return {ok:false,status:400,message:'The mobile number is no longer linked. Sign in with Google or email.'};
  return createSessionForVerifiedPhone(identity.user_id);
}
