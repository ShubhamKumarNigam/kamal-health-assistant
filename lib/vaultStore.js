import crypto from 'crypto';
import {query} from './auth/sqliteStore';
import {validateVaultFile,vaultMetadata,CHUNK_BYTES,MAX_ACCOUNT_BYTES,fileMatchesType} from './vault';
function record(row){return row?{id:row.id,name:row.name,mime:row.mime,size:row.size,sha256:row.sha256,status:row.status,metadata:row.metadata_json,extractedText:row.extracted_text,analysis:row.analysis_json,createdAt:row.created_at,updatedAt:row.updated_at}:null;}
export async function listVault(userId){return (await query("SELECT id,name,mime,size,sha256,status,metadata_json,created_at,updated_at FROM vault_documents WHERE user_id=$1 AND status IN ('ready','trash') ORDER BY created_at DESC LIMIT 200",[userId])).map(record);}
export async function getVault(userId,id){return record((await query('SELECT * FROM vault_documents WHERE user_id=$1 AND id=$2',[userId,id]))[0]);}
export async function checkVaultUpload(userId,input,db=query){
 const file=validateVaultFile(input);
 const rows=await db("SELECT id,name,status,sha256,metadata_json,created_at FROM vault_documents WHERE user_id=$1 AND (sha256=$2 OR lower(name)=lower($3)) ORDER BY created_at DESC",[userId,file.sha256,file.name]);
 return {exact:rows.filter(r=>r.sha256===file.sha256).map(conflictRecord),sameName:rows.filter(r=>r.sha256!==file.sha256).map(conflictRecord)};
}
function conflictRecord(r){return {id:r.id,name:r.name,status:r.status,folder:r.metadata_json?.folder||'',createdAt:r.created_at};}
function conflictError(conflicts){const error=new Error(conflicts.exact.length?'This document already exists in your vault (identical contents), even if its name is different. Open the existing record or restore it from trash.':'A file with this name already exists but its contents differ. Review it and confirm saving a separate version.');error.status=409;error.conflicts=conflicts;return error;}
export async function startVaultUpload(userId,input,db=query){
 const file=validateVaultFile(input),id=crypto.randomUUID(),conflicts=await checkVaultUpload(userId,input,db);
 if(conflicts.exact.length||(conflicts.sameName.length&&input.allowSameName!==true))throw conflictError(conflicts);
 const rows=await db(`WITH claimed AS (INSERT INTO vault_upload_claims(user_id,sha256,document_id) VALUES($1,$6,$3) ON CONFLICT DO NOTHING RETURNING document_id), reserved AS (UPDATE users SET vault_bytes=vault_bytes+$2 WHERE id=$1 AND vault_bytes+$2<=$7 AND EXISTS(SELECT 1 FROM claimed) RETURNING id) INSERT INTO vault_documents(id,user_id,name,mime,size,sha256) SELECT $3,id,$4,$5,$2,$6 FROM reserved RETURNING id`,[userId,file.size,id,file.name,file.mime,file.sha256,MAX_ACCOUNT_BYTES]);
 if(!rows.length){await db('DELETE FROM vault_upload_claims WHERE user_id=$1 AND sha256=$2 AND document_id=$3',[userId,file.sha256,id]);const latest=await checkVaultUpload(userId,input,db);if(latest.exact.length)throw conflictError(latest);throw new Error('Upload could not start. Your 50 MB allowance may be full or an identical upload is already starting. No extra storage was reserved.');}
 return {id,parts:Math.ceil(file.size/CHUNK_BYTES)};
}
export async function saveVaultChunk(userId,id,part,data){
 const doc=await getVault(userId,id);if(!doc||doc.status!=='uploading')throw new Error('Upload is unavailable.');
 if(!Number.isSafeInteger(part)||part<0||part>=Math.ceil(doc.size/CHUNK_BYTES)||typeof data!=='string'||data.length>Math.ceil(CHUNK_BYTES/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw new Error('Invalid upload chunk.');
 const bytes=Buffer.from(data,'base64'),expected=Math.min(CHUNK_BYTES,doc.size-part*CHUNK_BYTES);if(bytes.length!==expected||bytes.toString('base64')!==data)throw new Error('Incomplete upload chunk.');
 await query('INSERT INTO vault_chunks(document_id,part,data) VALUES($1,$2,$3) ON CONFLICT(document_id,part) DO UPDATE SET data=EXCLUDED.data',[id,part,data]);
}
export async function readVaultChunk(userId,id,part){return (await query("SELECT c.data FROM vault_chunks c JOIN vault_documents d ON d.id=c.document_id WHERE d.user_id=$1 AND d.id=$2 AND d.status='ready' AND c.part=$3",[userId,id,part]))[0]?.data;}
export async function finishVaultUpload(userId,id,input){
 const doc=await getVault(userId,id);if(!doc||doc.status!=='uploading')throw new Error('Upload is unavailable.');
 const chunks=await query('SELECT data FROM vault_chunks WHERE document_id=$1 ORDER BY part',[id]);const bytes=Buffer.concat(chunks.map(c=>Buffer.from(c.data,'base64')));
 if(bytes.length!==doc.size||crypto.createHash('sha256').update(bytes).digest('hex')!==doc.sha256||!fileMatchesType(bytes,doc.mime))throw new Error('File integrity or type check failed. Please upload a valid original.');
 const metadata=vaultMetadata(input);if(!metadata.title)metadata.title=doc.name;
 const extracted=String(input.extractedText||'');if(extracted.length>200000)throw new Error('Extracted text exceeds the vault limit.');
 await query("UPDATE vault_documents SET status='ready',metadata_json=$3::jsonb,extracted_text=$4,updated_at=now() WHERE user_id=$1 AND id=$2 AND status='uploading'",[userId,id,JSON.stringify(metadata),extracted]);return getVault(userId,id);
}
export async function updateVault(userId,id,input){
 const doc=await getVault(userId,id);if(!doc||!['ready','trash'].includes(doc.status))throw new Error('Document not found.');
 const metadata=vaultMetadata({...doc.metadata,...input.metadata});const status=input.status==='trash'?'trash':input.status==='ready'?'ready':doc.status;
 let analysis=doc.analysis;if(input.analysis!==undefined){if(JSON.stringify(input.analysis).length>80000)throw new Error('Analysis is too large.');analysis={content:input.analysis,savedAt:new Date().toISOString(),label:'AI-generated, unverified; saved by the account holder'};}
 await query('UPDATE vault_documents SET metadata_json=$3::jsonb,status=$4,analysis_json=$5::jsonb,updated_at=now() WHERE user_id=$1 AND id=$2',[userId,id,JSON.stringify(metadata),status,JSON.stringify(analysis)]);return getVault(userId,id);
}
