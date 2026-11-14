import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVaultFile,vaultMetadata,fileMatchesType,MAX_FILE_BYTES} from '../../lib/vault';
import {sourceReferences,historyEvidence} from '../../lib/evidence';
test('vault validates types, sizes, hashes and safe names',()=>{
 const file={name:'../report.pdf',mime:'application/pdf',size:40,sha256:'a'.repeat(64)};
 assert.equal(validateVaultFile(file).name,'.._report.pdf');
 assert.throws(()=>validateVaultFile({...file,mime:'text/html'}));
 assert.throws(()=>validateVaultFile({...file,size:MAX_FILE_BYTES+1}));
 assert.throws(()=>validateVaultFile({...file,sha256:'not-a-hash'}));
 assert.equal(fileMatchesType(Buffer.from('%PDF-1.7'),'application/pdf'),true);
 assert.equal(fileMatchesType(Buffer.from('<html>bad</html>'),'application/pdf'),false);
 assert.equal(fileMatchesType(Buffer.from('hello\0'),'text/plain'),false);
});
test('document metadata retains explicit folder and unknown dates without inventing facts',()=>{
 const m=vaultMetadata({folder:'Annual check-up',notes:'Follow-up scheduled',category:'Laboratory Reports'});
 assert.equal(m.folder,'Annual check-up');assert.equal(m.documentDate,'');assert.equal(m.notes,'Follow-up scheduled');
 assert.throws(()=>vaultMetadata({documentDate:'2026-02-30'}));
 assert.equal(vaultMetadata({category:'invented'}).category,'Other Documents');
});
test('citations cannot add model-generated URLs or IDs that were not supplied',()=>{
 const sources=[{id:'D1',href:'/vault/123',text:'private source text',title:'A report'}];
 assert.deepEqual(sourceReferences(['D1','D1','invented','https://evil.example'],sources),[{id:'D1',href:'/vault/123',title:'A report'}]);
 assert.deepEqual(sourceReferences(null,sources),[]);
 const history=historyEvidence([{id:'abc',createdAt:'2026-01-01',formattedSummary:'Patient report'}]);
 assert.equal(history[0].href,'/records/conversations/abc');assert.match(history[0].scope,/unconfirmed/);
});
