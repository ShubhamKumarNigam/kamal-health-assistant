export const VAULT_CATEGORIES=['Consultations','Prescriptions','Medications','Laboratory Reports','Imaging','Diagnoses / Conditions','Allergies','Vaccinations','Insurance','Hospital Visits','Procedures','Wearable Reports','Other Documents'];
export const CHUNK_BYTES=512*1024;
export const MAX_FILE_BYTES=10*1024*1024;
export const MAX_ACCOUNT_BYTES=50*1024*1024;
export const VAULT_TYPES=['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv'];
export function validateVaultFile(input){
 const name=String(input.name||'').replace(/[\x00-\x1f\\/]/g,'_').trim().slice(0,180);
 if(!name||!VAULT_TYPES.includes(input.mime)||!Number.isSafeInteger(input.size)||input.size<1||input.size>MAX_FILE_BYTES)throw new Error('Choose a PDF, PNG, JPEG, WebP, TXT or CSV file up to 10 MB.');
 if(!/^[a-f0-9]{64}$/.test(input.sha256||''))throw new Error('Missing file integrity check.');
 return {name,mime:input.mime,size:input.size,sha256:input.sha256};
}
export function vaultMetadata(input){
 const text=(key,max)=>String(input[key]||'').trim().slice(0,max);
 const category=VAULT_CATEGORIES.includes(input.category)?input.category:'Other Documents';
 const date=text('documentDate',10);
 if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date).toISOString().slice(0,10)!==date))throw new Error('Use a valid document date.');
 return {title:text('title',180),category,folder:text('folder',100)||category,summary:text('summary',1800),documentDate:date,institution:text('institution',180),country:text('country',80),tags:text('tags',300),notes:text('notes',8000)};
}
export function fileMatchesType(bytes,mime){
 const b=Uint8Array.from(bytes),ascii=(n)=>String.fromCharCode(...b.slice(0,n));
 if(mime==='application/pdf')return ascii(5)==='%PDF-';
 if(mime==='image/png')return [...b.slice(0,8)].join(',')==='137,80,78,71,13,10,26,10';
 if(mime==='image/jpeg')return b[0]===255&&b[1]===216&&b[2]===255;
 if(mime==='image/webp')return ascii(4)==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
 return mime.startsWith('text/')&&!b.includes(0);
}
