import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ClinicalCard } from "@/components/ClinicalCard";
import { ProfileContactForm } from "@/components/ProfileContactForm";
import { ProfileLanguageButtons } from "@/components/ProfileLanguageButtons";
import { ProfileLogoutButton } from "@/components/ProfileLogoutButton";
import { SESSION_COOKIE, getUserBySessionToken } from "@/lib/auth/sqliteStore";
export default async function ProfilePage() {
    const cookieStore = await cookies();
    const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) {
        redirect("/login?next=/profile");
    }
    const initials = user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "K";
    return (<AppShell description="Profile settings keep contact details and language visible." eyebrow="Account" title="Patient profile">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-soft lg:col-span-2">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_.9fr]">
            <div className="bg-[#324C4A] p-6 text-white md:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-white/20 bg-[#DAF8EF] text-3xl font-extrabold text-[#324C4A] shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold uppercase tracking-normal text-[#ADF8EF]">
                    Signed in account
                  </p>
                  <h2 className="mt-2 break-words text-3xl font-extrabold leading-tight">
                    {user.name}
                  </h2>
                  <p className="mt-2 break-words font-semibold text-[#DAF8EF]">
                    {user.email}
                  </p>
                </div>
              </div>
              <ProfileContactForm initialEmail={user.email} initialName={user.name} initialPhone={user.phone}/>
            </div>
            <div className="flex flex-col justify-between gap-6 p-6 md:p-8">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-normal text-primary">
                  Account controls
                </p>
                <h3 className="mt-2 text-2xl font-extrabold text-text-primary">
                  Log out from profile only
                </h3>
                <p className="mt-3 leading-7 text-text-secondary">
                  KAMAL keeps this browser signed in with a secure session cookie. Use this profile action when you want to end the session.
                </p>
              </div>
              <ProfileLogoutButton />
            </div>
          </div>
        </section>
        <div className="lg:col-span-2">
          <ClinicalCard title="Language">
            <ProfileLanguageButtons />
          </ClinicalCard>
        </div>
      </div>
    </AppShell>);
}
