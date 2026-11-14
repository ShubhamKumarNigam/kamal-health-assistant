import crypto from 'crypto';
import {query} from './auth/sqliteStore';
import {validateVaultFile,vaultMetadata,CHUNK_BYTES,MAX_ACCOUNT_BYTES,fileMatchesType} from './vault';
function record(row){return row?{id:row.id,name:row.name,mime:row.mime,size:row.size,sha256:row.sha256,status:row.status,metadata:row.metadata_json,extractedText:row.extracted_text,analysis:row.analysis_json,createdAt:row.created_at,updatedAt:row.updated_at}:null;}
export async function listVault(userId){return (await query("SELECT id,name,mime,size,sha256,status,metadata_json,created_at,updated_at FROM vault_documents WHERE user_id=$1 AND status IN ('ready','trash') ORDER BY created_at DESC LIMIT 200",[userId])).map(record);}
export async function getVault(userId,id){return record((await query('SELECT * FROM vault_documents WHERE user_id=$1 AND id=$2',[userId,id]))[0]);}
export async function startVaultUpload(userId,input){
 const file=validateVaultFile(input),id=crypto.randomUUID();
 const rows=await query(`WITH reserved AS (UPDATE users SET vault_bytes=vault_bytes+$2 WHERE id=$1 AND vault_bytes+$2<=$7 RETURNING id) INSERT INTO vault_documents(id,user_id,name,mime,size,sha256) SELECT $3,id,$4,$5,$2,$6 FROM reserved RETURNING id`,[userId,file.size,id,file.name,file.mime,file.sha256,MAX_ACCOUNT_BYTES]);
 if(!rows.length)throw new Error('Your 50 MB vault allowance is full, including retained and unfinished uploads. No payment has been initiated.');return {id,parts:Math.ceil(file.size/CHUNK_BYTES)};
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
