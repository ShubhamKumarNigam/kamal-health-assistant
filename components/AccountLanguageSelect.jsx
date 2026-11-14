'use client';
import {useEffect,useState} from 'react';
import {languages} from '@/lib/languages';
export function AccountLanguageSelect({initialLanguage='en',onChange}){
 const [code,setCode]=useState(initialLanguage),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;fetch('/api/preferences',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(active&&data.ok){setCode(data.languageCode);onChange?.(data.languageCode);}}).catch(()=>{});return()=>{active=false;};},[]);
 async function change(next){setBusy(true);setMessage('');try{const r=await fetch('/api/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({languageCode:next})});const data=await r.json();if(!r.ok||!data.ok)throw new Error(data.message);setCode(data.languageCode);onChange?.(data.languageCode);window.dispatchEvent(new CustomEvent('kamal-language-change',{detail:{languageCode:data.languageCode}}));setMessage('Language saved to your account.');}catch(e){setMessage(e.message||'Could not save language.');}finally{setBusy(false);}}
 return <div data-no-translate translate="no"><label>Preferred language <select className="ml-3 rounded-lg bg-white p-3 text-[#18313e]" value={code} disabled={busy} onChange={e=>change(e.target.value)}>{languages.map(l=><option key={l.code} value={l.code}>{l.name}</option>)}</select></label><p className="text-sm mt-2">Saved across sessions and devices. English is the default. Applies to new replies.</p><p role="status" className="text-sm">{message}</p></div>;
}
