"use client";
import {useState} from 'react';

export function PhoneVerification({enabled, purpose='login', nextPath='/workspace'}) {
  const [phone,setPhone]=useState('');
  const [code,setCode]=useState('');
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [done,setDone]=useState(false);
  async function submit(event) {
    event.preventDefault();setBusy(true);setMessage('');
    try {
      const response=await fetch('/api/auth/phone',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sent?{action:'check',code}:{action:'start',phone,purpose})});
      const result=await response.json();
      setMessage(result.message);
      if(result.ok) {
        if(sent) {setDone(true);if(result.authenticated) window.location.assign(nextPath.startsWith('/')&&!nextPath.startsWith('//')?nextPath:'/workspace');}
        else setSent(true);
      }
    } catch {setMessage('Connection failed. Please try again.');}
    finally {setBusy(false);}
  }
  return <section className="my-5 rounded-xl border border-[#324c4a]/20 p-5">
    <h3 className="text-xl font-bold">{purpose==='link'?'Mobile-number sign-in':'Sign in with a mobile number'}</h3>
    <p className="my-3 leading-7">{purpose==='link'?'Verify a number you own to sign in with SMS codes. Your Google/email account stays available.':'Use a number you previously verified in your KAMAL profile. New here? Create an account with Google or email first.'}</p>
    {!enabled?<p className="font-semibold">SMS sign-in is not available yet. Please use Google or email.</p>:<form onSubmit={submit} className="grid gap-3">
      <label>Mobile number, including country code<input className="mt-1 block min-h-12 w-full rounded-lg border p-3 text-black" autoComplete="tel" type="tel" required maxLength={25} placeholder="+971 50 123 4567" value={phone} disabled={sent||busy||done} onChange={e=>setPhone(e.target.value)}/></label>
      {sent&&!done&&<label>Six-digit SMS code<input className="mt-1 block min-h-12 w-full rounded-lg border p-3 text-black" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>}
      {!done&&<button className="min-h-12 rounded-lg bg-[#324c4a] px-4 py-3 font-bold text-white disabled:opacity-50" disabled={busy}>{busy?'Please wait…':sent?'Verify code':'Send verification code'}</button>}
      {sent&&!done&&<button type="button" disabled={busy} className="min-h-12 underline" onClick={()=>{setSent(false);setCode('');setMessage('Wait at least 60 seconds before requesting another code.');}}>Change number or request another code</button>}
    </form>}
    {message&&<p role="status" className="mt-3 leading-7">{message}</p>}
  </section>;
}
