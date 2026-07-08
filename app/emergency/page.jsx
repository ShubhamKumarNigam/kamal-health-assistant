import { PhoneCall, ShieldAlert } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
export default function EmergencyPage() {
    return (<main className="min-h-screen bg-emergency text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-10">
        <div className="mb-8 flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-lg bg-white text-emergency">
            <ShieldAlert aria-hidden="true" className="h-9 w-9"/>
          </span>
          <p className="text-xl font-bold">Emergency warning</p>
        </div>
        <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
          These symptoms may need urgent medical help now.
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-9 text-red-50">
          Call emergency services or ask someone nearby to help you call. Do not wait for the normal diagnosis flow.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a className="touch-target inline-flex items-center justify-center gap-3 rounded-lg bg-white px-6 py-4 text-lg font-bold text-emergency transition hover:bg-red-50" href="tel:112">
            <PhoneCall aria-hidden="true" className="h-6 w-6"/>
            <span>Call 112 emergency services</span>
          </a>
          <ActionButton href="/session" icon={ShieldAlert} label="Return to session demo" variant="emergency"/>
        </div>
        <section className="mt-10 rounded-lg border border-red-200 bg-white/10 p-5">
          <h2 className="text-2xl font-bold">While help is coming</h2>
          <p className="mt-3 text-lg leading-8 text-red-50">
            Sit upright if breathing is difficult. Keep the phone nearby. Share the symptoms and timing with the person helping you.
          </p>
        </section>
      </section>
    </main>);
}
