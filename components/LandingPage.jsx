import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bell, CirclePlay, ClipboardList, FileText, HeartPulse, Languages, MessageCircle, Search, Stethoscope, UploadCloud } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
const navItems = [
    { href: "/session", label: "Symptom sessions" },
    { href: "/image-upload", label: "Uploads" },
    { href: "/reminders", label: "Reminders" },
    { href: "/search", label: "Searchable records" },
    { href: "/reports/demo", label: "Shareable reports" }
];
const concerns = [
    {
        title: "Symptom sessions",
        description: "Guided check-ins help patients explain fever, pain, timing, triggers, and changes.",
        icon: ClipboardList
    },
    {
        title: "Medical uploads",
        description: "Upload reports, medical images, or documents for a clearer next-step summary.",
        icon: UploadCloud
    },
    {
        title: "Care reminders",
        description: "Keep medicines and follow-up tasks visible with simple reminder scheduling.",
        icon: Bell
    },
    {
        title: "Searchable records",
        description: "Find pages, reminders, reports, and saved patient history from one search view.",
        icon: Search
    },
    {
        title: "Shareable reports",
        description: "Create doctor-ready handoff reports from saved sessions and patient context.",
        icon: FileText
    },
    {
        title: "Everyday care",
        description: "Doctor-ready reports summarize symptoms, next steps, and safety notes.",
        icon: Stethoscope
    }
];
const services = [
    {
        title: "Language intake",
        meta: "Multilingual support",
        icon: Languages
    },
    {
        title: "Guided session",
        meta: "Voice + text",
        icon: MessageCircle
    },
    {
        title: "Care reminders",
        meta: "Email ready",
        icon: Bell
    },
    {
        title: "Doctor report",
        meta: "Shareable",
        icon: FileText
    }
];
const kamalPoints = [
    "Start a doctor-style diagnosis session from your saved concern.",
    "Use voice input, typing, or image upload during follow-up questions.",
    "Analyse reports and medical images with a dedicated analyser.",
    "Save completed diagnosis summaries into patient history.",
    "Set medicine reminders and track upcoming care tasks.",
    "Search pages, reminders, reports, and patient records quickly."
];
export function LandingPage({ isLoggedIn = false }) {
    const profileHref = isLoggedIn ? "/profile" : "/login?next=/profile";
    return (<main className="kamal-theme-page kamal-landing min-h-screen overflow-hidden bg-[#daf8ef] text-[#000000]" id="home">
      <header className="px-4 pt-5 md:px-6">
        <div className="kamal-topbar mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-[#324c4a]/10 bg-white/80 px-4 py-3 shadow-[0_18px_50px_rgba(50,76,74,0.08)] backdrop-blur">
          <Link className="flex items-center gap-2.5" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#DAF8EF] shadow-[0_10px_24px_rgba(50,76,74,0.12)]">
              <img alt="" className="h-7 w-7" src="/kamal-logo.svg"/>
            </span>
            <span className="text-lg font-extrabold tracking-normal">KAMAL</span>
          </Link>

          <nav aria-label="Landing navigation" className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (<Link className="kamal-nav-link text-base font-bold text-[#5b605d] transition hover:text-[#000000]" href={item.href} key={item.href}>
                {item.label}
              </Link>))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link className="kamal-topbar-cta touch-target inline-flex items-center justify-center gap-2 rounded-full bg-[#324c4a] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-black" href={profileHref}>
              <span>Profile</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4"/>
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 py-6 md:px-6 md:py-8">
        <div className="kamal-hero-frame mx-auto max-w-7xl rounded-[2rem] bg-[#324c4a] p-3 shadow-[0_30px_90px_rgba(50,76,74,0.24)] md:rounded-[2.5rem] md:p-4">
          <div className="relative min-h-[620px] overflow-hidden rounded-[1.55rem] bg-[#324c4a]">
            <Image alt="A person meditating in a forest with sunlight streaming through the trees" className="absolute inset-0 h-full w-full object-cover" fill priority sizes="100vw" src="/pinterest-meditation.png"/>
            <div className="absolute inset-0 bg-gradient-to-r from-[#1c3431]/92 via-[#324c4a]/68 to-[#324c4a]/16"/>
            <div className="absolute inset-0 bg-gradient-to-t from-[#061413]/58 via-transparent to-transparent"/>

            <div className="relative z-10 flex min-h-[620px] w-full flex-col justify-between p-6 text-white md:p-10">
              <div className="relative z-10">
                <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-extrabold text-[#daf8ef] ring-1 ring-white/15">
                  <HeartPulse aria-hidden="true" className="h-4 w-4"/>
                  KAMAL health workspace
                </p>
                <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-normal md:text-7xl">
                  True care starts within reach.
                </h1>
                <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-[#daf8ef]">
                  Manage symptom sessions, medical uploads, medicine reminders,
                  searchable records, and shareable health reports in one place.
                </p>
              </div>

              <div className="relative z-10 mt-10 flex justify-start md:absolute md:bottom-10 md:right-12 lg:right-16">
                <Link className="touch-target inline-flex items-center justify-center gap-3 rounded-full bg-[#daf8ef] px-6 py-4 text-base font-extrabold text-[#324c4a] shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition hover:bg-white" href="/login?next=/session">
                  <CirclePlay aria-hidden="true" className="h-5 w-5"/>
                  <span>Start session</span>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6" id="symptom-sessions">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-extrabold uppercase tracking-normal text-[#609665]">
              More than symptom logging
            </p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#000000] md:text-5xl">
              Designed for calm decisions during stressful health moments.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {concerns.map((item) => {
            const Icon = item.icon;
            return (<article className="kamal-concern-card rounded-[1.4rem] border border-[#324c4a]/10 bg-white/65 p-5 shadow-[0_18px_50px_rgba(50,76,74,0.06)]" key={item.title}>
                  <span className="kamal-card-icon grid h-11 w-11 place-items-center rounded-full bg-[#daf8ef] text-[#609665] ring-1 ring-[#609665]/15">
                    <Icon aria-hidden="true" className="h-5 w-5"/>
                  </span>
                  <h3 className="kamal-card-title mt-5 text-lg font-extrabold text-[#000000]">
                    {item.title}
                  </h3>
                  <p className="kamal-card-copy mt-2 text-sm font-medium leading-6 text-[#5b605d]">
                    {item.description}
                  </p>
                </article>);
        })}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6" id="uploads">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[.82fr_1.18fr]">
          <ImageTile
            alt="A calm AI-supported healthcare consultation scene with patient notes and clinical tools"
            className="min-h-[360px] lg:min-h-[520px]"
            src="/deep-support-care.svg"
          />

          <div className="kamal-dark-panel rounded-[1.7rem] bg-[#324c4a] p-6 text-white md:p-8">
            <p className="text-sm font-extrabold uppercase tracking-normal text-[#daf8ef]">
              The easiest way to get deep support
            </p>
            <h2 className="mt-3 max-w-xl text-4xl font-extrabold leading-tight md:text-5xl">
              Built like a wellness app. Structured like a clinical intake.
            </h2>
            <p className="mt-5 max-w-2xl font-medium leading-8 text-[#daf8ef]">
              KAMAL blends a calm Leafcare-inspired experience with practical
              health flows: language selection, guided sessions, safety checks,
              reminders, and reports.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {services.map((service) => {
            const Icon = service.icon;
            return (<article className="kamal-service-card rounded-[1.2rem] bg-white/10 p-4 ring-1 ring-white/10" key={service.title}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#daf8ef] text-[#324c4a]">
                        <Icon aria-hidden="true" className="h-5 w-5"/>
                      </span>
                    </span>
                    <h3 className="mt-4 text-lg font-extrabold">
                      {service.title}
                    </h3>
                    <p className="mt-1 text-sm font-bold text-[#daf8ef]">
                      {service.meta}
                    </p>
                  </article>);
        })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6" id="services">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <div className="kamal-light-panel rounded-[1.7rem] bg-white/70 p-6 md:p-8">
            <p className="text-sm font-extrabold uppercase tracking-normal text-[#609665]">
              KAMAL workflow
            </p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight">
              One place for sessions, reports, reminders, and records.
            </h2>
            <p className="kamal-card-copy mt-5 leading-8 text-[#5b605d]">
              KAMAL connects the steps around a health concern so patients can explain symptoms, upload files, save results, and return to records later.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {kamalPoints.map((point, index) => (<article className="kamal-article-card flex min-h-[190px] flex-col justify-between rounded-[1.5rem] bg-white/70 p-5" key={point}>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#daf8ef] text-base font-extrabold text-[#609665]">
                  {index + 1}
                </span>
                <p className="mt-6 text-base font-extrabold leading-7 text-[#324c4a]">
                  {point}
                </p>
              </article>))}
          </div>
        </div>
      </section>
    </main>);
}
function ImageTile({ alt = "A person meditating in a forest with sunlight streaming through the trees", className = "", src = "/pinterest-meditation.png" }) {
    return (<div className={`kamal-image-card overflow-hidden rounded-[1.5rem] bg-white/70 shadow-[0_18px_60px_rgba(50,76,74,0.08)] ${className}`}>
      <Image alt={alt} className="h-full w-full object-cover" height={720} src={src} width={1080}/>
    </div>);
}
