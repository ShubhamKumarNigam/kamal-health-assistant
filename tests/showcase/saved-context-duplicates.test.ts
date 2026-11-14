import test from 'node:test';
import assert from 'node:assert/strict';
import {checkVaultUpload,startVaultUpload} from '../../lib/vaultStore';
import {contextTerms,relevantExcerpt,documentEvidence,relevantSavedRecords} from '../../lib/savedContext';
const file={name:'report.txt',mime:'text/plain',size:20,sha256:'a'.repeat(64)};

test('identical renamed files and trash are caught within the account',async()=>{
 let writes=0;
 const db=async(sql:string,params:any[]=[])=>{assert.match(sql,/user_id=\$1/);assert.equal(params[0],'alice');if(!sql.startsWith('SELECT'))writes++;return [{id:'old',name:'renamed.txt',status:'trash',sha256:file.sha256,metadata_json:{folder:'Lab'}}];};
 const match=await checkVaultUpload('alice',file,db);assert.equal(match.exact[0].id,'old');assert.equal(match.sameName.length,0);
 await assert.rejects(startVaultUpload('alice',{...file,allowSameName:true},db),(e:any)=>e.status===409&&e.conflicts.exact[0].status==='trash');assert.equal(writes,0);
});
test('same name changed contents requires explicit confirmation and reserves only after approval',async()=>{
 let writes=0;
 const db=async(sql:string)=>{if(sql.startsWith('SELECT'))return [{id:'old',name:file.name,status:'ready',sha256:'b'.repeat(64),metadata_json:{folder:'Lab'}}];writes++;assert.match(sql,/ON CONFLICT DO NOTHING/);return [{id:'new'}];};
 await assert.rejects(startVaultUpload('alice',file,db),(e:any)=>e.status===409&&e.conflicts.sameName.length===1);assert.equal(writes,0);
 const result=await startVaultUpload('alice',{...file,allowSameName:true},db);assert.equal(result.parts,1);assert.equal(writes,1);
});
test('concurrent identical upload returns a conflict rather than a second reservation',async()=>{
 let reads=0;
 const db=async(sql:string)=>{if(sql.startsWith('SELECT'))return ++reads===1?[]:[{id:'winner',name:file.name,status:'uploading',sha256:file.sha256}];return [];};
 await assert.rejects(startVaultUpload('alice',file,db),(e:any)=>e.status===409&&e.conflicts.exact[0].id==='winner');
});
test('source extraction can find relevant text beyond the start of a long report',()=>{
 const late='Ferritin: 19 ug/L; printed reference interval 15–150.';
 const text='Administrative header\n'.repeat(500)+late;
 const result=relevantExcerpt(text,'What was my ferritin?',500);assert.ok(result.includes(late));assert.ok(result.length<=500);
 assert.deepEqual(contextTerms('the and with'),[]);
 assert.ok(contextTerms('blood sugar glucose').includes('glucose'));
});
test('document sources link exact owner-controlled records and snapshot excerpts',()=>{
 const doc={id:'doc-1',name:'lab.txt',metadata:{summary:'Summary',notes:'Unverified note'},extractedText:'Ferritin: 19 ug/L',analysis:null,updatedAt:'2026-11-14'};
 const source=documentEvidence(doc,'ferritin',1);assert.equal(source.href,'/vault/doc-1');assert.equal(source.id,'D1');assert.match(source.excerpt,/19 ug/);assert.match(source.scope,/unverified/);
});
test('automatic selection searches all ready account records and completed conversations',async()=>{
 const calls:any[]=[];const db=async(sql:string,params:any[]=[])=>{calls.push({sql,params});return sql.includes('vault_documents')?[{id:'older-relevant'}]:[{id:'chat',created_at:'2026-01-01',formatted_summary:'Patient reported ferritin 19'}];};
 const selected=await relevantSavedRecords('alice','ferritin',true,db);assert.deepEqual(selected.documentIds,['older-relevant']);assert.equal(selected.sessions[0].id,'chat');
 for(const call of calls){assert.equal(call.params[0],'alice');assert.match(call.sql,/WHERE user_id=\$1/);assert.match(call.sql,/ts_rank_cd/);}
 assert.match(calls[0].sql,/status='ready'/);
});
