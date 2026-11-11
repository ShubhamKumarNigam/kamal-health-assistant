import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {Activity,ArrowRight,Bell,FileText,FolderHeart,MessageCircle,Search,ShieldCheck,User} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {SESSION_COOKIE,getUserBySessionToken} from '@/lib/auth/sqliteStore';
const tools=[
 ['/session','Start a health conversation','Continue the existing guided session with your saved patient context.',MessageCircle],
 ['/onboarding/history','Your health history','Review your saved records and previous sessions.',FolderHeart],
 ['/image-upload','Analyse a document','Use the existing document and image analysis service.',FileText],
 ['/reminders','Your care reminders','Manage saved reminders and notification settings.',Bell],
 ['/reports/demo','Prepare a health report','Create a handoff from your existing account records.',Activity],
 ['/search','Search your records','Find reports, reminders and saved health information.',Search],
 ['/profile','Your profile','Manage account details and language preferences.',User],
 ['/diet','Food and wellbeing','Open your existing nutrition and wellbeing tools.',ShieldCheck],
];
export default async function Workspace(){const jar=await cookies();const user=await getUserBySessionToken(jar.get(SESSION_COOKIE)?.value);if(!user)redirect('/login?next=/workspace');return <AppShell title={`Welcome back${user.name?', '+user.name.split(' ')[0]:''}`} eyebrow="YOUR PERSONAL KAMAL WORKSPACE" description="Your existing account, records and care tools—together in one place."><section className="account-context-notice"><ShieldCheck size={22}/><div><strong>Your signed-in health space</strong><p>These tools use your existing KAMAL account and configured services. The synthetic exhibition demo is separate and never writes to your patient record.</p></div><Link href="/demo">Explore demo <ArrowRight size={17}/></Link></section><div className="account-tool-grid">{tools.map(([href,title,description,Icon])=><Link href={href} key={href} className="account-tool-card"><Icon size={26}/><h2>{title}</h2><p>{description}</p><span>Open tool <ArrowRight size={17}/></span></Link>)}</div></AppShell>;}
