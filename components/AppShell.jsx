import Link from "next/link";
import { Bell, ClipboardList, FileText, ImageUp, Leaf, MessageCircle, Search, ShieldPlus, Utensils, User } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
const navItems = [
    { href: "/", label: "Home", icon: Leaf },
    { href: "/session", label: "Session", icon: MessageCircle },
    { href: "/onboarding/history", label: "History", icon: ClipboardList },
    { href: "/reminders", label: "Reminders", icon: Bell },
    { href: "/diet", label: "Diet", icon: Utensils },
    { href: "/image-upload", label: "Analyser", icon: ImageUp },
    { href: "/search", label: "Search", icon: Search },
    { href: "/reports/demo", label: "Report", icon: FileText }
];
export function AppShell({ children, eyebrow, title, description, variant = "default" }) {
    const isDark = variant === "dark";
    const mainClass = isDark
        ? "kamal-theme-page kamal-app-shell min-h-screen bg-[#122724] text-[#DDFBF6]"
        : "kamal-theme-page kamal-app-shell min-h-screen bg-bg text-text-primary";
    const logoTitleClass = "kamal-logo-title block text-lg font-extrabold leading-tight tracking-normal";
    const logoSubtitleClass = "text-xs font-bold text-text-secondary";
    const navClass = "kamal-sidebar-link touch-target inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-extrabold transition";
    const ctaClass = "kamal-topbar-cta touch-target inline-flex items-center justify-center gap-2 rounded-full bg-[#324c4a] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-black";
    const eyebrowClass = isDark
        ? "mb-2 text-sm font-extrabold uppercase tracking-normal text-[#9BE7D9]"
        : "mb-2 text-sm font-bold uppercase tracking-normal text-primary";
    const titleClass = isDark
        ? "text-3xl font-extrabold leading-tight text-white md:text-5xl"
        : "text-3xl font-bold leading-tight md:text-5xl";
    const descriptionClass = isDark
        ? "mt-3 text-lg font-medium leading-8 text-[#DDFBF6]"
        : "mt-3 text-lg leading-8 text-text-secondary";
    const contentClass = isDark ? "kamal-vertical-frame" : "kamal-content-frame";
    return (<main className={mainClass}>
      <div className="kamal-shell-grid">
        <aside className="kamal-sidebar hidden lg:flex">
          <Link className="flex items-center gap-3" href="/">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#DAF8EF] shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
              <img alt="" className="h-8 w-8" src="/kamal-logo.svg"/>
            </span>
            <span className="min-w-0">
              <span className={logoTitleClass}>KAMAL</span>
              <span className={logoSubtitleClass}>
                Health assistant
              </span>
            </span>
          </Link>
          <div className="mt-7 rounded-lg border border-[#324C4A]/10 bg-[#DAF8EF]/70 p-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#324C4A]">
              <ShieldPlus aria-hidden="true" className="h-4 w-4"/>
              <span>Care workspace</span>
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-[#5B605D]">
              Session tools, records, and support stay one click away.
            </p>
          </div>
          <nav aria-label="Main navigation" className="mt-7 flex flex-1 flex-col gap-1">
            {navItems.map((item) => {
            const Icon = item.icon;
            return (<Link className={navClass} href={item.href} key={item.href}>
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0"/>
                  <span>{item.label}</span>
                </Link>);
        })}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="px-4 pt-5 md:px-6 lg:hidden">
            <div className="kamal-topbar mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-[#324c4a]/10 bg-white/80 px-4 py-3 shadow-[0_18px_50px_rgba(50,76,74,0.08)] backdrop-blur">
              <Link className="flex items-center gap-2.5" href="/">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#DAF8EF]">
                  <img alt="" className="h-7 w-7" src="/kamal-logo.svg"/>
                </span>
                <span className="kamal-logo-title text-lg font-extrabold tracking-normal">KAMAL</span>
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Link className={ctaClass} href="/profile">
                  <User aria-hidden="true" className="h-4 w-4"/>
                  <span>Profile</span>
                </Link>
              </div>
            </div>
            <nav aria-label="Mobile navigation" className="kamal-mobile-rail mt-4 flex gap-2 overflow-x-auto pb-2">
              {navItems.map((item) => {
            const Icon = item.icon;
            return (<Link className="touch-target inline-flex shrink-0 items-center gap-2 rounded-full border border-[#324C4A]/12 bg-white/80 px-4 py-2 text-sm font-extrabold text-[#324C4A]" href={item.href} key={item.href}>
                  <Icon aria-hidden="true" className="h-4 w-4"/>
                  <span>{item.label}</span>
                </Link>);
        })}
            </nav>
          </header>

          <section className="page-band">
            <div className="mx-auto max-w-7xl">
              <div className={contentClass}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-3xl">
                    {eyebrow ? (<p className={eyebrowClass}>
                        {eyebrow}
                      </p>) : null}
                    <h1 className={titleClass}>
                      {title}
                    </h1>
                    <p className={descriptionClass}>
                      {description}
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 lg:flex">
                    <ThemeToggle />
                    <Link className={ctaClass} href="/profile">
                      <User aria-hidden="true" className="h-4 w-4"/>
                      <span>Profile</span>
                    </Link>
                  </div>
                </div>
                {children}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>);
}
