import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReportText, MAX_REPORT_CHARS} from '../../lib/reportText.js';
import {classifyProviderError, fetchChatCompletion} from '../../lib/aiProviderClient.js';

test('reports are never silently truncated or accepted without readable text', () => {
  assert.throws(() => validateReportText('   '), /No readable text/);
  assert.throws(() => validateReportText('x'.repeat(MAX_REPORT_CHARS + 1)), /too long/);
  assert.equal(validateReportText('  Glucose 90 mg/dL; interval 70-99  '), 'Glucose 90 mg/dL; interval 70-99');
});
test('provider failures distinguish access, billing and retired models without exposing raw data', () => {
  assert.equal(classifyProviderError(400, 'model is decommissioned').code, 'AI_MODEL');
  assert.equal(classifyProviderError(400, 'insufficient balance private-key').code, 'AI_BILLING');
  assert.equal(classifyProviderError(401, 'private-key').code, 'AI_AUTH');
  assert.equal(classifyProviderError(400, 'unknown parameter').code, 'AI_REQUEST');
  assert.equal(classifyProviderError(413, 'Request too large on tokens per minute').code, 'AI_REQUEST_TOO_LARGE');
  assert.doesNotMatch(JSON.stringify(classifyProviderError(400, 'insufficient balance private-key')), /private-key/);
});
test('an oversized provider request is not retried or labelled temporarily busy', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {calls++; return new Response(JSON.stringify({error:{message:'Request too large on tokens per minute (TPM) rate limit'}}), {status:413});};
  try {
    const result = await fetchChatCompletion({url:'https://api.groq.com/openai/v1/chat/completions',apiKey:'test',model:'test',messages:[],fallbackMessage:'Unavailable',retryAttempts:2});
    assert.equal(calls,1);
    assert.equal((result as any).code,'AI_REQUEST_TOO_LARGE');
    assert.match((result as any).message,/Waiting and retrying will not fix it/);
    assert.equal((result as any).rateLimited,false);
  } finally {globalThis.fetch=original;}
});
test('provider payload and errors survive a mocked completion request', async () => {
  const original = globalThis.fetch;
  let body: any;
  globalThis.fetch = async (_url: any, options: any) => {
    body = JSON.parse(options.body);
    return new Response(JSON.stringify({error:{message:'model is decommissioned'}}), {status:400});
  };
  try {
    const result = await fetchChatCompletion({url:'https://api.groq.com/openai/v1/chat/completions', apiKey:'test', model:'test', messages:[], maxTokens:6000, response_format:{type:'json_object'}, fallbackMessage:'Unavailable', retryAttempts:0});
    assert.equal(body.max_tokens, 6000);
    assert.equal(body.response_format.type, 'json_object');
    assert.equal(result.ok, false);
    assert.equal((result as any).code, 'AI_MODEL');
  } finally { globalThis.fetch = original; }
});
