"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
export function ProfileLogoutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    async function logout() {
        setLoading(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login?next=/session&signedOut=1");
            router.refresh();
        }
        finally {
            setLoading(false);
        }
    }
    return (<button className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#324C4A] px-5 py-3 text-base font-extrabold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={loading} onClick={logout} type="button">
      <LogOut aria-hidden="true" className="h-5 w-5"/>
      <span>{loading ? "Logging out..." : "Log out"}</span>
    </button>);
}
