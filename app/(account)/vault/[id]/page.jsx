import {cookies} from 'next/headers';
import {redirect,notFound} from 'next/navigation';
import {SESSION_COOKIE,getUserBySessionToken} from '@/lib/auth/sqliteStore';
import {getVault,listVault} from '@/lib/vaultStore';
import {AppShell} from '@/components/AppShell';
import {VaultDocument} from '@/components/VaultDocument';
export default async function VaultRecord({params}){const user=await getUserBySessionToken((await cookies()).get(SESSION_COOKIE)?.value);if(!user)redirect('/login');const {id}=await params,doc=await getVault(user.id,id);if(!doc||doc.status==='uploading')notFound();const folders=[...new Set((await listVault(user.id)).filter(d=>d.status==='ready').map(d=>d.metadata.folder))];return <AppShell title="Your document, in context" eyebrow="MY HEALTH VAULT" description="Original, notes, analysis and sharing choices in one place."><VaultDocument initialDocument={doc} folders={folders} clientId={process.env.GOOGLE_CLIENT_ID||''}/></AppShell>;}
