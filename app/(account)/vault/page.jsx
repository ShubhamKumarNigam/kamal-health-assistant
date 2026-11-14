import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {SESSION_COOKIE,getUserBySessionToken} from '@/lib/auth/sqliteStore';
import {listVault} from '@/lib/vaultStore';
import {AppShell} from '@/components/AppShell';
import {SavedContextSetting} from '@/components/SavedContextSetting';
import {DriveCopy} from '@/components/DriveCopy';
import {HealthVault} from '@/components/HealthVault';
export default async function VaultPage(){const user=await getUserBySessionToken((await cookies()).get(SESSION_COOKIE)?.value);if(!user)redirect('/login?next=/vault');return <AppShell title="My Health Vault" eyebrow="RECORDS THAT STAY TOGETHER" description="Originals, summaries and related updates, organised around you."><SavedContextSetting/><DriveCopy clientId={process.env.GOOGLE_CLIENT_ID||''}/><HealthVault initialDocuments={await listVault(user.id)}/></AppShell>;}
