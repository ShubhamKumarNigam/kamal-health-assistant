import crypto from 'node:crypto';

// Separate encryption domain; rotating the OAuth secret requires reconnecting Drive.
function key() {
 const secret=process.env.GOOGLE_CLIENT_SECRET?.trim();
 if(!secret) throw new Error('Google Drive is not configured.');
 return Buffer.from(crypto.hkdfSync('sha256',secret,'kamal-drive-v1','refresh-token-encryption',32));
}
export function sealDriveToken(token,userId){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
 cipher.setAAD(Buffer.from(userId));
 const bytes=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64');
}
export function openDriveToken(value,userId){
 const bytes=Buffer.from(value,'base64');
 const decipher=crypto.createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));
 decipher.setAAD(Buffer.from(userId));decipher.setAuthTag(bytes.subarray(12,28));
 return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
}
