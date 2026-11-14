'use client';
import Script from 'next/script';
import {useEffect,useState} from 'react';

export function DriveCopy({clientId,document}){
 const [state,setState]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function action(body){
  const r=await fetch('/api/drive',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XmlHttpRequest'},body:JSON.stringify(body)}),data=await r.json();
  if(!r.ok)throw new Error(data.message||'Drive connection failed.');setState(data);return data;
 }
 useEffect(()=>{
  let live=true,running=false;
  async function refresh(){if(running)return;running=true;try{const r=await fetch('/api/drive',{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(!live)return;setState(data);if(data.connected&&data.enabled&&data.pending&&!data.syncing)await action({action:'retry'});}catch{if(live)setMessage('Drive status is temporarily unavailable. Your vault records are safe.');}finally{running=false;}}
  refresh();const timer=setInterval(refresh,15000);return()=>{live=false;clearInterval(timer);};
 },[]);
 function connect(){
  if(!window.google?.accounts?.oauth2){setMessage('Google connection is loading. Please try again shortly.');return;}
  setBusy(true);setMessage('');
  window.google.accounts.oauth2.initCodeClient({client_id:clientId,scope:'https://www.googleapis.com/auth/drive.file',include_granted_scopes:false,ux_mode:'popup',select_account:true,
   callback:async response=>{try{if(!response.code)throw new Error('Google Drive access was not granted.');await action({action:'connect',code:response.code,consent:true});setMessage('Automatic sync enabled. Existing and new vault records will be copied to the Google account you selected.');}catch(e){setMessage(e.message);}finally{setBusy(false);}},
   error_callback:()=>{setBusy(false);setMessage('Google connection was cancelled or blocked. Your vault is unchanged.');}
  }).requestCode();
 }
 async function disconnect(){setBusy(true);try{await action({action:'disconnect'});setMessage('Automatic sync stopped. Existing Drive copies remain. An already-running transfer may finish. You can also revoke KAMAL access in your Google Account.');}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 return <section className="care-card" data-no-translate translate="no"><h2>Optional Google Drive sync</h2>
  <p>Keep a private Drive copy of your vault. Connecting enables automatic one-way sync of all existing and new saved originals, summaries, notes and analyses, even after you close this page. Related records use their KAMAL folder inside “KAMAL Health”.</p>
  <p className="my-3">Google sign-in alone does not enable this. KAMAL stores encrypted access credentials for this optional connection and can access only files used with the app. Drive edits do not flow back to KAMAL; later KAMAL updates replace managed copies. Trashing a KAMAL record does not delete its Drive copy. Nothing is made public.</p>
  {state?.available===false&&<p role="status">The shared demo cannot connect private Drive storage. Sign in to your own KAMAL account first.</p>}
  {clientId?<><Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"/>{state?.connected?<><p className="my-3 font-semibold">{state.enabled?"Automatic sync is ON — no Copy button is needed.":"Automatic sync needs reconnection."}</p><p role="status">{!state.enabled?'Reconnect required':state.syncing?'Syncing your records…':state.pending?`${state.pending} record(s) waiting to sync`:'All saved records synced'}{state.lastSyncedAt&&` · Last successful sync: ${new Date(state.lastSyncedAt).toLocaleString()}`}</p>{state.error&&<p role="alert">{state.error}</p>}<div className="flex gap-4 flex-wrap mt-3">{!state.enabled&&<button className="care-button" disabled={busy} onClick={connect}>Reconnect Google Drive</button>}<button className="underline" disabled={busy} onClick={disconnect}>Disconnect automatic sync</button></div></>:<button className="care-button" disabled={busy||!state||state.available===false} onClick={connect}>Connect Google Drive and enable automatic sync</button>}</>:<p>Google Drive is not configured. Your private vault still works independently.</p>}
  <p className="mt-3">Transfers start after saves. If Google is unavailable, records remain pending and retry while your vault is open or when you next save or visit it. Disconnect stops future transfers and retains your Drive copies.</p>
  {state?.connected&&<div className="mt-5 border-t pt-4"><h3>Browse your Drive copies</h3>{state.rootUrl?<a className="care-button my-3 inline-flex" href={state.rootUrl} target="_blank" rel="noreferrer">Open KAMAL Health folder in Drive ↗</a>:<p>Your Drive folder link appears after the first successful transfer.</p>}<p>Links open Google Drive in a new tab. Sign in to the Google account you connected. Only KAMAL-managed copies are listed here.</p><ul className="mt-3 space-y-4">{(state.files||[]).filter(f=>!document||f.id===document.id).map(f=><li key={f.id}><strong>{f.title}</strong><p>{f.folder}{!f.current?' · Update pending':''}</p><div className="flex flex-wrap gap-4">{f.fileUrl&&<a className="underline" href={f.fileUrl} target="_blank" rel="noreferrer">Open original ↗</a>}{f.summaryUrl&&<a className="underline" href={f.summaryUrl} target="_blank" rel="noreferrer">Open summary and notes ↗</a>}{f.folderUrl&&<a className="underline" href={f.folderUrl} target="_blank" rel="noreferrer">Open folder ↗</a>}</div></li>)}</ul></div>}
  <p role="status" className="mt-3">{message}</p>
 </section>;
}
