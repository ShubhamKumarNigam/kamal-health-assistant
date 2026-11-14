import PublicPolicy from '@/components/PublicPolicy';
import { termsSections } from '@/lib/publicPolicies';
export const metadata = { title: 'Terms of Use | KAMAL Health' };
export default function TermsPage() { return <PublicPolicy title="Terms of use" sections={termsSections}/>; }
