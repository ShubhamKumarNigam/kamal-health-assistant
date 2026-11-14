import {cookies} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {SESSION_COOKIE,getUserBySessionToken,getDiagnosisSessionById} from '@/lib/auth/sqliteStore';
import {AppShell} from '@/components/AppShell';
import {SourceList} from '@/components/SourceList';
export default async function ConversationRecord({params}){const user=await getUserBySessionToken((await cookies()).get(SESSION_COOKIE)?.value);if(!user)redirect('/login');const {id}=await params,record=await getDiagnosisSessionById(user.id,id);if(!record)notFound();return <AppShell title="Saved conversation" eyebrow="SOURCE RECORD" description={record.createdAt}><section className="care-card" data-no-translate translate="no"><p>AI-generated, not clinician-confirmed. This is historical context.</p><pre className="whitespace-pre-wrap font-sans my-5">{record.formattedSummary}</pre>{record.transcript.filter(t=>t.role==='assistant').map((t,i)=><SourceList key={i} sources={t.sources}/>)}</section></AppShell>;}
