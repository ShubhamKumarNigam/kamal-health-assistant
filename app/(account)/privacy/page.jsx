import PublicPolicy from '@/components/PublicPolicy';
import { privacySections } from '@/lib/publicPolicies';
export const metadata = { title: 'Privacy Policy | KAMAL Health' };
export default function PrivacyPage() { return <PublicPolicy title="Privacy policy" sections={privacySections}/>; }
