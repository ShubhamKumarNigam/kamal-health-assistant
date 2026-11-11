import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone, phoneAllowed, phoneAuthConfigured, verifyProvider} from '../../lib/auth/phoneProvider.js';
const env={NODE_ENV:'test' as const,TWILIO_ACCOUNT_SID:'test-account',TWILIO_AUTH_TOKEN:'test-secret',TWILIO_VERIFY_SERVICE_SID:'test-service',KAMAL_SMS_ALLOWED_PREFIXES:'+971,+91'};
test('SMS remains unavailable without provider configuration and a country allowlist',()=>{
  assert.equal(phoneAuthConfigured({NODE_ENV:'test'}),false);
  assert.equal(phoneAuthConfigured({...env,KAMAL_SMS_ALLOWED_PREFIXES:''}),false);
  assert.equal(phoneAllowed('+12025550123',env),false);
  assert.equal(phoneAllowed('+971501234567',env),true);
});
test('phone normalization requires an international number and rejects malformed input',()=>{
  assert.equal(normalizePhone('+971 (50) 123-4567'),'+971501234567');
  for(const value of ['0501234567','+00123456789','+971test12345','+971501234567;DROP','+1234567890123456']) assert.equal(normalizePhone(value),null);
});
test('verification sends the provider challenge ID rather than trusting a client phone identity',async()=>{
  let body='';
  const result=await verifyProvider('check',{VerificationSid:'VE-challenge',Code:'123456'},{env,fetcher:async (_url:any,init:any)=>{
    body=String(init.body);return new Response(JSON.stringify({sid:'VE-challenge',status:'approved'}),{status:200});
  }});
  assert.equal(result.status,'approved');assert.equal(result.sid,'VE-challenge');
  assert.match(body,/VerificationSid=VE-challenge/);assert.doesNotMatch(body,/To=/);
});
test('provider failures never expose provider credentials or raw error details to users',async()=>{
  await assert.rejects(verifyProvider('start',{To:'+971501234567',Channel:'sms'},{env,fetcher:async()=>new Response(JSON.stringify({message:'test-secret internal provider details'}),{status:401})}),error=>{
    assert.doesNotMatch(String(error),/test-secret|internal provider/);return true;
  });
});
