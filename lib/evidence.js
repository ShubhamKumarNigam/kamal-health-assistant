const externalPages=[
 {pattern:/bloat|ballonn|انتفاخ|पेट फूल/i,title:'NHS — Bloating',url:'https://www.nhs.uk/symptoms/bloating/'},
 {pattern:/headache|migraine|صداع|सिरदर्द/i,title:'NHS — Headaches',url:'https://www.nhs.uk/symptoms/headaches/'},
 {pattern:/blood test|lab report|haemoglobin|hemoglobin|cholesterol|تحاليل/i,title:'NHS — Blood tests',url:'https://www.nhs.uk/tests-and-treatments/blood-tests/'},
 {pattern:/diabet|glucose|blood sugar|سكري/i,title:'NHS — Type 2 diabetes',url:'https://www.nhs.uk/conditions/type-2-diabetes/'}
];
export function sourceReferences(ids,sources){return [...new Set(Array.isArray(ids)?ids:[])].map(id=>sources.find(s=>s.id===id)).filter(Boolean).map(({text,...source})=>source);}
export async function externalEvidence(text){
 const selected=externalPages.filter(p=>p.pattern.test(text)).slice(0,1);
 const results=await Promise.all(selected.map(async(page)=>{try{
  const response=await fetch(page.url,{signal:AbortSignal.timeout(4500),next:{revalidate:86400},redirect:'error'});if(!response.ok)return null;
  const html=await response.text();const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];if(!main)return null;
  const plain=main.replace(/<(script|style|nav)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  if(plain.length<200)return null;return {id:'E1',kind:'External guidance',title:page.title,href:page.url,retrievedAt:new Date().toISOString(),text:plain.slice(0,5000),scope:'Retrieved excerpt; UK guidance, not a personalised assessment.'};
 }catch{return null;}}));return results.filter(Boolean);
}
export function historyEvidence(sessions){return sessions.slice(0,3).map((s,i)=>({id:`H${i+1}`,kind:'Previous conversation',title:`Conversation · ${s.createdAt}`,href:`/records/conversations/${encodeURIComponent(s.id)}`,text:String(s.formattedSummary||'').slice(0,900),excerpt:String(s.formattedSummary||'').slice(0,900),scope:'Earlier AI summary and patient statements; unconfirmed historical context.'}));}
