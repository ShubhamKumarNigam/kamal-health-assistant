import {CHUNK_BYTES} from './vault';
export async function vaultRequest(url,body,method='POST'){const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.message||'Vault request failed.');return result;}
export async function uploadVaultFile(file,metadata,extractedText,progress){
 const buffer=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',buffer);const sha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const start=await vaultRequest('/api/vault',{name:file.name,mime:file.type||'text/plain',size:file.size,sha256});
 for(let part=0;part<start.parts;part++){const bytes=new Uint8Array(buffer.slice(part*CHUNK_BYTES,(part+1)*CHUNK_BYTES));let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));progress(`Saving ${file.name}: part ${part+1} of ${start.parts}`);await vaultRequest(`/api/vault/${start.id}`,{part,data:btoa(binary)});}
 return (await vaultRequest(`/api/vault/${start.id}`,{action:'finish',...metadata,extractedText})).document;
}
export async function downloadVaultBlob(doc){const chunks=[];for(let part=0;part<Math.ceil(doc.size/CHUNK_BYTES);part++){const r=await fetch(`/api/vault/${doc.id}/file?part=${part}`,{cache:'no-store'});if(!r.ok)throw new Error('Original file is unavailable.');chunks.push(await r.arrayBuffer());}const blob=new Blob(chunks,{type:doc.mime});const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());if([...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')!==doc.sha256)throw new Error('Downloaded file did not pass its integrity check.');return blob;}
export function saveBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
