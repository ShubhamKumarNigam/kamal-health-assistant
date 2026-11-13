import test from 'node:test';
import assert from 'node:assert/strict';
import {splitReportSections, analyseReportSections, REPORT_REQUEST_GAP_MS} from '../../lib/reportSections.js';

const response = (answer = 'Reviewed') => new Response(JSON.stringify({ok:true,analysis:{answer, findings:[answer], limitations:[]}}),{status:200});
test('sectioning preserves all text and Unicode without exceeding the byte allowance',()=>{
  const text = ('Page marker\nGlucose 90 mg/dL 70–99\nالعربية 🧪\n').repeat(250) + 'FINAL PAGE';
  const parts = splitReportSections(text);
  assert.equal(parts.join(''),text);
  assert.ok(parts.length>1);
  assert.ok(parts.every(p=>Buffer.byteLength(p,'utf8')<=3500));
  assert.ok(parts.every(p=>!p.includes('\uFFFD')));
});
test('every section is sent in order and paced before the combined result appears',async()=>{
  const payload=new FormData(); const text='Synthetic line\n'.repeat(300);payload.set('reportText',text);
  const sent:string[]=[];let waits=0;
  const result=await analyseReportSections(payload,{fetcher:async(_url:any,options:any)=>{sent.push(options.body.get('reportText'));return response(`Part ${sent.length}`);},wait:async(ms:any)=>{assert.equal(ms,REPORT_REQUEST_GAP_MS);waits++;}} as any);
  assert.equal(sent.join(''),text);assert.equal(waits,sent.length-1);
  assert.equal(result.findings.length,sent.length);assert.match(result.summary,/All 2 report sections/);
});
test('failure of a later section never returns an apparently complete report',async()=>{
  const payload=new FormData();payload.set('reportText','x'.repeat(4000));let calls=0;
  await assert.rejects(analyseReportSections(payload,{fetcher:async()=>++calls===1?response():new Response(JSON.stringify({message:'Quota unavailable'}),{status:413}),wait:async()=>{}} as any),/No complete analysis was produced \(1 of 2 sections finished\)/);
  assert.equal(calls,2);
});
test('rate limits retry with pacing, then stop after three failed requests',async()=>{
  let calls=0;let waits=0;
  await assert.rejects(analyseReportSections(new FormData(),{fetcher:async()=>{calls++;return new Response(JSON.stringify({message:'Rate limit'}),{status:429});},wait:async()=>{waits++;}} as any),/No complete analysis/);
  assert.equal(calls,3);assert.equal(waits,2);
});
test('cancellation during the pacing wait prevents the next request',async()=>{
  const controller=new AbortController();const payload=new FormData();payload.set('reportText','x'.repeat(4000));let calls=0;
  await assert.rejects(analyseReportSections(payload,{signal:controller.signal,fetcher:async()=>{calls++;return response();},wait:async()=>{controller.abort();}} as any),{name:'AbortError'});
  assert.equal(calls,1);
});
