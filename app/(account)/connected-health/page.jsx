import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {ConnectedHealth} from '@/components/ConnectedHealth';
import {SESSION_COOKIE,getUserBySessionToken,listHealthObservations} from '@/lib/auth/sqliteStore';
export default async function Page(){const jar=await cookies();const user=await getUserBySessionToken(jar.get(SESSION_COOKIE)?.value);if(!user)redirect('/login?next=/connected-health');return <AppShell eyebrow="CONNECTED HEALTH" title="Notice the pattern, not just the number." description="Bring measurements together, see their source, and notice sustained changes in your own baseline."><ConnectedHealth initialRows={await listHealthObservations(user.id)}/></AppShell>;}
