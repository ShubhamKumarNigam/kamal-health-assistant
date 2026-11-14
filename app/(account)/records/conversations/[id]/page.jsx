import {cookies} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {SESSION_COOKIE,getUserBySessionToken,getDiagnosisSessionById} from '@/lib/auth/sqliteStore';
import {AppShell} from '@/components/AppShell';
import {SourceList} from '@/components/SourceList';
export default async function ConversationRecord({params}){const user=await getUserBySessionToken((await cookies()).get(SESSION_COOKIE)?.value);if(!user)redirect('/login');const {id}=await params,record=await getDiagnosisSessionById(user.id,id);if(!record)notFound();return <AppShell title="Saved conversation" eyebrow="SOURCE RECORD" description={record.createdAt}><section className="care-card" data-no-translate translate="no"><p>AI-generated, not clinician-confirmed. This is historical context.</p><pre className="whitespace-pre-wrap font-sans my-5">{record.formattedSummary}</pre><h2>Original saved conversation</h2>{record.transcript.map((t,i)=><article className="my-4 border-t pt-3" key={i}><strong>{t.role==='user'?'You':'KAMAL'}</strong><p className="whitespace-pre-wrap">{t.content}</p>{t.role==='assistant'&&<SourceList sources={t.sources}/>}</article>)}</section></AppShell>;}
