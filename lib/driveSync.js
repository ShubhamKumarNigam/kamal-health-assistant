import crypto from 'node:crypto';
import {query} from './auth/sqliteStore';
import {openDriveToken,sealDriveToken} from './driveCrypto';

export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const pending=`d.status='ready' AND (s.document_id IS NULL OR s.synced_version IS DISTINCT FROM d.updated_at)`;
const escape=value=>String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
export async function driveStatus(userId){
 const [c]=await query('SELECT generation,enabled,last_error,last_synced_at,lease_until FROM drive_connections WHERE user_id=$1',[userId]);
 if(!c)return {connected:false};
 const [counts]=await query(`SELECT count(*)::int AS pending FROM vault_documents d LEFT JOIN drive_sync_records s ON s.document_id=d.id AND s.generation=$2 WHERE d.user_id=$1 AND ${pending}`,[userId,c.generation]);
 return {connected:true,enabled:c.enabled,pending:counts.pending,error:c.last_error,lastSyncedAt:c.last_synced_at,syncing:c.lease_until&&new Date(c.lease_until)>new Date()};
}
async function tokens(fields,request=fetch){
 const r=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID.trim(),client_secret:process.env.GOOGLE_CLIENT_SECRET.trim(),...fields}),signal:AbortSignal.timeout(10000)});
 const data=await r.json();
 if(!r.ok||!data.access_token){const e=new Error(data.error==='invalid_grant'?'Google access expired or was revoked. Reconnect Google Drive.':'Google Drive is temporarily unavailable. Pending records will retry.');e.reconnect=data.error==='invalid_grant';throw e;}
 return data;
}
export async function connectDrive(userId,code,origin){
 if(typeof code!=='string'||code.length>4096)throw new Error('Invalid Google authorization.');
 const data=await tokens({code,grant_type:'authorization_code',redirect_uri:origin});
 if(!data.scope?.split(' ').includes(DRIVE_SCOPE)||!data.refresh_token)throw new Error('Offline Drive access was not granted. Reconnect and approve automatic sync.');
 const token=sealDriveToken(data.refresh_token,userId);
 // Reconnection invalidates old workers. File appProperties recover prior copies.
 await query(`INSERT INTO drive_connections(user_id,refresh_token,generation,enabled) VALUES($1,$2,$3,true) ON CONFLICT(user_id) DO UPDATE SET refresh_token=EXCLUDED.refresh_token,generation=EXCLUDED.generation,enabled=true,last_error=NULL,lease_until=NULL,lease_owner=NULL`,[userId,token,crypto.randomUUID()]);
}
export async function disconnectDrive(userId){
 // Remove local credentials first. Existing files and Google sign-in remain untouched.
 await query('DELETE FROM drive_connections WHERE user_id=$1',[userId]);
}
export function driveSummary(doc,origin){return `KAMAL record — AI content is unverified\nOriginal: ${doc.name}\nKAMAL: ${origin}/vault/${doc.id} (sign-in required)\nUpdated: ${doc.updated_at}\n\n${JSON.stringify(doc.metadata_json,null,2)}\n\nSaved analysis:\n${JSON.stringify(doc.analysis_json,null,2)}`;}

// Durable pending work is inferred from document versions; crashes never mark it done.
// One account lease serializes folder creation and retries across server instances.
export async function syncDrive(userId,origin,dependencies={}){
 const db=dependencies.query||query,request=dependencies.fetch||fetch;
 const owner=crypto.randomUUID();
 const [connection]=await db(`UPDATE drive_connections SET lease_owner=$2,lease_until=now()+interval '2 minutes' WHERE user_id=$1 AND enabled=true AND (lease_until IS NULL OR lease_until<now()) RETURNING *`,[userId,owner]);
 if(!connection)return;
 const generation=connection.generation;
 const active=async()=>!!(await db('SELECT user_id FROM drive_connections WHERE user_id=$1 AND generation=$2 AND lease_owner=$3 AND enabled=true AND lease_until>now()',[userId,generation,owner])).length;
 try{
  const docs=await db(`SELECT d.*,d.updated_at::text AS sync_version FROM vault_documents d LEFT JOIN drive_sync_records s ON s.document_id=d.id AND s.generation=$2 WHERE d.user_id=$1 AND ${pending} ORDER BY d.updated_at LIMIT 3`,[userId,generation]);
  if(!docs.length)return;
  let refresh;try{refresh=openDriveToken(connection.refresh_token,userId);}catch{const e=new Error('Reconnect Google Drive to restore secure access.');e.reconnect=true;throw e;}
  const token=(await tokens({refresh_token:refresh,grant_type:'refresh_token'},request)).access_token;
  async function api(path,options={}){
   if(!await active())throw new Error('Drive sync stopped.');
   const r=await request(`https://www.googleapis.com/${path}`,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers},signal:AbortSignal.timeout(10000)});
   const data=await r.json();
   if(!r.ok){const e=new Error(r.status===401?'Google access expired. Reconnect Google Drive.':r.status===403?'Google Drive refused the transfer. Check Drive permissions and storage, then reconnect if needed.':'Google Drive is temporarily unavailable. Pending records will retry.');e.reconnect=r.status===401;throw e;}return data;
  }
  async function folder(name,parent){
   const q=`trashed=false and mimeType='application/vnd.google-apps.folder' and name='${escape(name)}' and appProperties has {key='kamalManaged' and value='true'}${parent?` and '${escape(parent)}' in parents`:''}`;
   const found=await api(`drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
   return found.files?.[0]?.id||(await api('drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',appProperties:{kamalManaged:'true'},...(parent?{parents:[parent]}:{})})})).id;
  }
  async function put(recordKey,name,mime,bytes,parent){
   const q=`trashed=false and appProperties has {key='kamalRecordId' and value='${escape(recordKey)}'}`;
   const found=await api(`drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,parents)&pageSize=1`),existing=found.files?.[0];
   const boundary=`kamal_${crypto.randomUUID()}`,metadata={name,mimeType:mime,appProperties:{kamalRecordId:recordKey},...(!existing?{parents:[parent]}:{})};
   const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--`)]);
   const move=existing&&!existing.parents?.includes(parent)?`&addParents=${encodeURIComponent(parent)}&removeParents=${encodeURIComponent((existing.parents||[]).join(','))}`:'';
   return api(`upload/drive/v3/files${existing?`/${existing.id}`:''}?uploadType=multipart&fields=id${move}`,{method:existing?'PATCH':'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  }
  const started=Date.now(),root=await folder('KAMAL Health');
  for(const doc of docs){
   if(Date.now()-started>35000)break;
   if(!(await db("SELECT id FROM vault_documents WHERE id=$1 AND user_id=$2 AND status='ready'",[doc.id,userId])).length)continue;
   const group=await folder(doc.metadata_json.folder||doc.metadata_json.category,root);
   const chunks=await db('SELECT data FROM vault_chunks WHERE document_id=$1 ORDER BY part',[doc.id]);
   const bytes=Buffer.concat(chunks.map(c=>Buffer.from(c.data,'base64')));
   if(bytes.length!==doc.size||crypto.createHash('sha256').update(bytes).digest('hex')!==doc.sha256)throw new Error('Original integrity check failed. The Drive copy was not updated.');
   const file=await put(doc.id,doc.name,doc.mime,bytes,group);
   await put(`${doc.id}-summary`,`${doc.name}.kamal-summary.txt`,'text/plain',Buffer.from(driveSummary(doc,origin)),group);
   if(!await active())break;
   await db(`INSERT INTO drive_sync_records(document_id,generation,synced_version,drive_file_id) VALUES($1,$2,$3,$4) ON CONFLICT(document_id,generation) DO UPDATE SET synced_version=EXCLUDED.synced_version,drive_file_id=EXCLUDED.drive_file_id`,[doc.id,generation,doc.sync_version,file.id]);
   await db('UPDATE drive_connections SET last_error=NULL,last_synced_at=now() WHERE user_id=$1 AND generation=$2 AND lease_owner=$3',[userId,generation,owner]);
  }
 }catch(e){await db('UPDATE drive_connections SET last_error=$4,enabled=CASE WHEN $5 THEN false ELSE enabled END WHERE user_id=$1 AND generation=$2 AND lease_owner=$3',[userId,generation,owner,e.message?.startsWith('Google')||e.message?.startsWith('Reconnect')||e.message?.startsWith('Original')?e.message:'Drive sync is pending. It will retry automatically when you use your vault.',!!e.reconnect]);}
 finally{await db('UPDATE drive_connections SET lease_owner=NULL,lease_until=NULL WHERE user_id=$1 AND generation=$2 AND lease_owner=$3',[userId,generation,owner]);}
}
