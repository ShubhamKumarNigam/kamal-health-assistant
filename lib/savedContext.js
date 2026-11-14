import {query} from './auth/sqliteStore';
const stop=new Set('the and are with what about have from this that your please could would should tell been were when does need know want report reports previous saved history information'.split(' '));
export function contextTerms(text){return [...new Set((String(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(t=>!stop.has(t)))].slice(0,20);}
export function relevantExcerpt(text,question,max=1400){
 const value=String(text||''),terms=contextTerms(question);
 const pieces=value.split(/\n\s*\n|\n/).flatMap(p=>p.match(/[\s\S]{1,700}/g)||[]);
 const ranked=pieces.map((text,index)=>({text,index,score:terms.reduce((n,t)=>n+(text.toLowerCase().includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score||a.index-b.index);
 let remaining=max;const selected=[];
 for(const p of ranked){if(remaining<=0)break;if(selected.length&&p.score===0&&selected[0].score>0)break;const text=p.text.slice(0,remaining);selected.push({...p,text});remaining-=text.length+5;}
 return selected.sort((a,b)=>a.index-b.index).map(p=>p.text).join('\n[…]\n');
}
export async function relevantSavedRecords(userId,question,includeDocuments=true,db=query){
 const terms=contextTerms(question).join(' | ');
 const documents=includeDocuments?await db(`SELECT id FROM vault_documents WHERE user_id=$1 AND status='ready' ORDER BY ts_rank_cd(to_tsvector('simple',coalesce(metadata_json::text,'')||' '||name||' '||extracted_text),to_tsquery('simple',$2)) DESC,updated_at DESC LIMIT 3`,[userId,terms]):[];
 const rows=await db(`SELECT id,created_at,formatted_summary FROM diagnosis_sessions WHERE user_id=$1 ORDER BY ts_rank_cd(to_tsvector('simple',formatted_summary),to_tsquery('simple',$2)) DESC,created_at DESC LIMIT 2`,[userId,terms]);
 return {documentIds:documents.map(d=>d.id),sessions:rows.map(s=>({id:s.id,createdAt:s.created_at,formattedSummary:relevantExcerpt(s.formatted_summary,question,850)}))};
}
export function documentEvidence(doc,question,index){
 const extracted=relevantExcerpt(doc.extractedText,question,1400);
 const text=JSON.stringify({summary:doc.metadata.summary?.slice(0,450),extractedText:extracted,notes:relevantExcerpt(doc.metadata.notes,question,450),analysis:doc.analysis?relevantExcerpt(JSON.stringify(doc.analysis),question,400):null});
 return {id:`D${index}`,kind:'Vault document',title:doc.metadata.title||doc.name,href:`/vault/${doc.id}`,text,excerpt:extracted||doc.metadata.summary||'No extracted text available; only saved metadata supplied.',recordUpdatedAt:doc.updatedAt,scope:'Selected excerpts, not the full document. Notes and AI analyses are unverified; historical information may have changed.'};
}
