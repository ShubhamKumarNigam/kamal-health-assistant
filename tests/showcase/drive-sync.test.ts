import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {sealDriveToken,openDriveToken} from '../../lib/driveCrypto';
import {syncDrive,driveSummary,driveLink} from '../../lib/driveSync';
process.env.GOOGLE_CLIENT_SECRET='synthetic-test-secret-not-a-real-credential';
process.env.GOOGLE_CLIENT_ID='synthetic-client';

test('stored Drive credentials are authenticated, randomized and bound to the account',()=>{
 const sealed=sealDriveToken('test-refresh','alice');
 assert.equal(openDriveToken(sealed,'alice'),'test-refresh');
 assert.notEqual(sealed,sealDriveToken('test-refresh','alice'));
 assert.throws(()=>openDriveToken(sealed,'bob'));
 const bytes=Buffer.from(sealed,'base64');bytes[30]^=1;
 assert.throws(()=>openDriveToken(bytes.toString('base64'),'alice'));
 assert.ok(!sealed.includes('test-refresh'));
});

function fixture({failSummary=false,revoked=false,lease=true,corrupt=false,disconnect=false}={}){
 const bytes=Buffer.from('Synthetic file only'),version='2026-11-14 12:00:00.123456+00';
 const doc={id:'doc-1',name:'test.txt',mime:'text/plain',size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),updated_at:version,sync_version:version,metadata_json:{folder:'Follow-up',summary:'Synthetic',notes:'Additional test note'},analysis_json:{content:'Unverified test analysis'}};
 const writes:any[]=[],calls:any[]=[],dbCalls:any[]=[];
 const query=async(sql:string,params:any[])=>{
  dbCalls.push({sql,params});
  if(sql.includes('RETURNING *'))return lease?[{generation:'generation',refresh_token:sealDriveToken('refresh','alice')}]:[];
  if(sql.startsWith('SELECT d.*'))return [doc];
  if(sql.startsWith('SELECT user_id'))return disconnect?[]:[{user_id:'alice'}];
  if(sql.startsWith('SELECT id FROM'))return [{id:doc.id}];
  if(sql.startsWith('SELECT data'))return [{data:(corrupt?Buffer.from('bad'):bytes).toString('base64')}];
  writes.push({sql,params});return [];
 };
 const fetch=async(url:string,options:any={})=>{
  calls.push({url,options});
  if(url.includes('/token'))return Response.json(revoked?{error:'invalid_grant'}:{access_token:'access'},{status:revoked?400:200});
  if(url.includes('upload/')){
   if(failSummary&&options.body.toString().includes('doc-1-summary'))return Response.json({error:{}},{status:503});
   return Response.json({id:'existing-file'});
  }
  if(url.includes('mimeType'))return Response.json({files:[{id:'folder'}]});
  return Response.json({files:[{id:'existing-file',parents:['old-folder']}]});
 };
 return {query,fetch,writes,calls,dbCalls,doc,version};
}
test('sync preserves exact version, updates managed files, moves folders and includes notes and analysis',async()=>{
 const f=fixture();await syncDrive('alice','https://kamal.example',f);
 const uploads=f.calls.filter(c=>c.url.includes('upload/'));
 assert.equal(uploads.length,2);assert.ok(uploads.every(c=>c.options.method==='PATCH'));
 assert.ok(uploads.every(c=>c.url.includes('addParents=folder&removeParents=old-folder')));
 assert.ok(uploads[1].options.body.toString().includes('Additional test note'));
 assert.ok(uploads[1].options.body.toString().includes('Unverified test analysis'));
 assert.equal(f.writes.find(w=>w.sql.startsWith('INSERT INTO drive_sync_records')).params[2],f.version);
 assert.deepEqual(f.writes.find(w=>w.sql.startsWith('INSERT INTO drive_sync_records')).params.slice(3),['existing-file','folder','existing-file']);
 assert.ok(f.dbCalls.find(c=>c.sql.startsWith('SELECT d.*')).sql.includes("d.user_id=$1"));
});
test('partial failure leaves the record pending for a retry',async()=>{
 const f=fixture({failSummary:true});await syncDrive('alice','https://kamal.example',f);
 assert.ok(!f.writes.some(w=>w.sql.startsWith('INSERT INTO drive_sync_records')));
 assert.ok(f.writes.some(w=>w.sql.includes('last_error=$4')));
 assert.ok(f.writes.some(w=>w.sql.includes('lease_owner=NULL')));
});
test('a revoked token disables retries until reconnection',async()=>{
 const f=fixture({revoked:true});await syncDrive('alice','https://kamal.example',f);
 assert.equal(f.writes.find(w=>w.sql.includes('last_error=$4')).params[4],true);
 assert.equal(f.calls.length,1);
});
test('an occupied lease prevents concurrent copies',async()=>{
 const f=fixture({lease:false});await syncDrive('alice','https://kamal.example',f);assert.equal(f.calls.length,0);
});
test('disconnect stops further Drive requests and corrupt originals cannot upload',async()=>{
 const stopped=fixture({disconnect:true});await syncDrive('alice','https://kamal.example',stopped);
 assert.ok(!stopped.calls.some(c=>c.url.includes('www.googleapis.com')));
 const corrupt=fixture({corrupt:true});await syncDrive('alice','https://kamal.example',corrupt);
 assert.ok(!corrupt.calls.some(c=>c.url.includes('upload/')));
 assert.ok(!corrupt.writes.some(w=>w.sql.startsWith('INSERT INTO drive_sync_records')));
});

test('Drive navigation links only accept Google file identifiers',()=>{
 assert.equal(driveLink('abc-123_'),'https://drive.google.com/file/d/abc-123_/view');
 assert.equal(driveLink('folder_123',true),'https://drive.google.com/drive/folders/folder_123');
 assert.equal(driveLink(null),null);assert.equal(driveLink('https://evil.example'),null);
});
