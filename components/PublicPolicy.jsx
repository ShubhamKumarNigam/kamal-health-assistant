import Link from 'next/link';
import { policyDate } from '@/lib/publicPolicies';

export default function PublicPolicy({ title, sections }) {
  return <main className="mx-auto max-w-3xl px-6 py-12 text-lg leading-8 text-[#183c3a]">
    <Link href="/" className="font-bold underline">KAMAL Health</Link>
    <h1 className="my-6 text-4xl font-bold">{title}</h1>
    <p>Last updated: {policyDate}</p>
    {sections.map(([heading, text]) => <section key={heading} className="mt-8">
      <h2 className="mb-3 text-2xl font-bold">{heading}</h2><p>{text}</p>
    </section>)}
    <nav aria-label="Service information" className="mt-12 flex flex-wrap gap-6 underline">
      <Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms of use</Link><Link href="/login">Create an account or sign in</Link>
    </nav>
  </main>;
}
