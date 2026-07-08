"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole, Mail, RotateCcw, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { OtpInput } from "@/components/OtpInput";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VoiceField } from "@/components/VoiceField";
import { OTP_COOLDOWN_SECONDS } from "@/lib/auth/config";
function isSafeNextPath(path) {
    return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/login");
}
export function AuthFlow({ demoEmail = "", forceGooglePrompt = false, initialError = "", initialMessage = "", nextPath }) {
    const router = useRouter();
    const safeNextPath = isSafeNextPath(nextPath) ? nextPath : "/session";
    const googleAuthHref = `/api/auth/google?next=${encodeURIComponent(safeNextPath)}${forceGooglePrompt ? "&prompt=select_account" : ""}`;
    const [mode, setMode] = useState(() => demoEmail ? "signin" : "signup");
    const [purpose, setPurpose] = useState("signup_verification");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [message, setMessage] = useState(initialMessage);
    const [error, setError] = useState(initialError);
    const [cooldown, setCooldown] = useState(0);
    const [loading, setLoading] = useState(false);
    const title = useMemo(() => {
        if (mode === "signup")
            return "Create your KAMAL account";
        if (mode === "verify")
            return "Enter the code we emailed you";
        if (mode === "forgot")
            return "Reset your password";
        if (mode === "reset")
            return "Choose a new password";
        return "Sign in to start your session";
    }, [mode]);
    useEffect(() => {
        if (cooldown <= 0)
            return;
        const timer = window.setInterval(() => {
            setCooldown((current) => Math.max(0, current - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [cooldown]);
    async function post(endpoint, body) {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const result = (await response.json());
            if (!response.ok || !result.ok) {
                throw new Error(result.message || "Something went wrong. Please try again.");
            }
            if (result.message)
                setMessage(result.message);
            return result;
        }
        catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Something went wrong. Please try again.");
            return null;
        }
        finally {
            setLoading(false);
        }
    }
    function enterVerification(nextPurpose, nextMessage) {
        setPurpose(nextPurpose);
        setOtp("");
        setCooldown(OTP_COOLDOWN_SECONDS);
        setMode(nextPurpose === "password_reset" ? "reset" : "verify");
        if (nextMessage)
            setMessage(nextMessage);
    }
    async function submitSignIn(event) {
        event.preventDefault();
        const result = await post("/api/auth/login", { email, password });
        if (!result)
            return;
        if (result.authenticated) {
            router.push(safeNextPath);
            router.refresh();
            return;
        }
        enterVerification("signup_verification", "Verify your email before starting the session.");
    }
    async function signInWithDemo() {
        setMode("signin");
        setEmail(demoEmail);
        setPassword("");
        setConfirmPassword("");
        const result = await post("/api/auth/demo-login", {});
        if (result?.authenticated) {
            router.push(safeNextPath);
            router.refresh();
        }
    }
    async function submitSignUp(event) {
        event.preventDefault();
        const result = await post("/api/auth/signup", {
            name,
            email,
            password,
            confirmPassword
        });
        if (result) {
            enterVerification("signup_verification", result.message);
        }
    }
    async function submitForgot(event) {
        event.preventDefault();
        const result = await post("/api/auth/forgot-password", { email });
        if (result) {
            enterVerification("password_reset", result.message);
        }
    }
    async function verifyCode(code = otp) {
        if (loading || code.length !== 6)
            return;
        const result = await post("/api/auth/verify-otp", {
            email,
            code,
            purpose
        });
        if (result?.authenticated) {
            router.push(safeNextPath);
            router.refresh();
        }
    }
    async function submitReset(event) {
        event.preventDefault();
        const result = await post("/api/auth/reset-password", {
            email,
            code: otp,
            newPassword,
            confirmPassword: confirmNewPassword
        });
        if (result?.authenticated) {
            router.push(safeNextPath);
            router.refresh();
        }
    }
    async function resendCode() {
        const result = await post("/api/auth/resend-otp", { email, purpose });
        if (result) {
            setOtp("");
            setCooldown(OTP_COOLDOWN_SECONDS);
        }
    }
    return (<main className="kamal-theme-page kamal-auth-page min-h-screen bg-[#daf8ef] px-4 py-5 text-[#000000] md:px-6">
      <header className="kamal-topbar mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-[#324c4a]/10 bg-white/80 px-4 py-3 shadow-[0_18px_50px_rgba(50,76,74,0.08)] backdrop-blur">
        <Link className="flex items-center gap-2.5" href="/">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#DAF8EF] shadow-[0_10px_24px_rgba(50,76,74,0.12)]">
            <img alt="" className="h-7 w-7" src="/kamal-logo.svg"/>
          </span>
          <span className="text-lg font-extrabold tracking-normal">KAMAL</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link className="touch-target inline-flex items-center justify-center gap-2 rounded-full border border-[#324c4a]/15 bg-white px-4 py-2 text-sm font-extrabold text-[#324c4a] transition hover:border-[#324c4a]" href="/">
            <ArrowLeft aria-hidden="true" className="h-4 w-4"/>
            <span>Home</span>
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 py-6 lg:grid-cols-[.95fr_1.05fr] lg:py-8">
        <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[#324c4a] p-6 text-white shadow-[0_30px_90px_rgba(50,76,74,0.20)] md:p-8 lg:min-h-[720px]">
          <Image alt="A calm forest meditation scene" className="absolute inset-0 h-full w-full object-cover" fill priority sizes="(min-width: 1024px) 45vw, 100vw" src="/pinterest-meditation.png"/>
          <div className="absolute inset-0 bg-gradient-to-t from-[#061413]/78 via-[#324c4a]/62 to-[#324c4a]/18"/>
          <div className="relative z-10 flex h-full flex-col justify-between">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-extrabold text-[#daf8ef] ring-1 ring-white/15">
              <ShieldCheck aria-hidden="true" className="h-4 w-4"/>
              Secure email entry
            </p>
            <div className="pt-28 lg:pt-0">
              <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-normal md:text-6xl">
                Start care with a calm, private sign in.
              </h1>
              <p className="mt-5 max-w-lg text-base font-medium leading-8 text-[#daf8ef] md:text-lg">
                Continue with Google to create a verified KAMAL account, or use email code verification when needed.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <section className="w-full rounded-[2rem] border border-[#324c4a]/10 bg-white/86 p-5 shadow-[0_22px_70px_rgba(50,76,74,0.12)] backdrop-blur md:p-8">
            <div className="mb-6 flex rounded-full bg-[#daf8ef] p-1">
              <button className={`touch-target flex-1 rounded-full px-4 py-3 text-sm font-extrabold transition ${mode === "signin" || mode === "forgot" || mode === "reset"
            ? "bg-[#324c4a] text-white shadow-[0_10px_24px_rgba(50,76,74,0.20)]"
            : "text-[#5b605d]"}`} onClick={() => {
            setMode("signin");
            setError("");
            setMessage("");
        }} type="button">
                Sign in
              </button>
              <button className={`touch-target flex-1 rounded-full px-4 py-3 text-sm font-extrabold transition ${mode === "signup" || mode === "verify"
            ? "bg-[#324c4a] text-white shadow-[0_10px_24px_rgba(50,76,74,0.20)]"
            : "text-[#5b605d]"}`} onClick={() => {
            setMode("signup");
            setError("");
            setMessage("");
        }} type="button">
                Sign up
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm font-extrabold uppercase tracking-normal text-[#609665]">
                Start session
              </p>
              <h2 className="mt-2 text-3xl font-extrabold leading-tight md:text-4xl">
                {title}
              </h2>
              <p className="mt-3 leading-7 text-[#5b605d]">
                Google sign-in is the primary account path. Email code verification remains available and every account record is stored in the local SQLite database.
              </p>
            </div>

            {mode === "signin" || mode === "signup" || mode === "forgot" ? (<>
                <a className="touch-target mb-5 flex w-full items-center justify-center gap-3 rounded-xl bg-[#324c4a] px-5 py-4 text-base font-extrabold text-white shadow-[0_16px_34px_rgba(50,76,74,0.24)] transition hover:bg-black" href={googleAuthHref}>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-base font-extrabold text-[#324c4a]">
                    G
                  </span>
                  <span>Continue with Google</span>
                </a>

                <div className="mb-5 flex items-center gap-3 text-xs font-extrabold uppercase tracking-normal text-[#5b605d]">
                  <span className="h-px flex-1 bg-[#324c4a]/12"/>
                  <span>Email option</span>
                  <span className="h-px flex-1 bg-[#324c4a]/12"/>
                </div>
              </>) : null}

            {message ? (<p className="mb-4 rounded-lg border border-[#609665]/20 bg-[#daf8ef] px-4 py-3 font-semibold text-[#324c4a]">
                {message}
              </p>) : null}
            {error ? (<p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-900">
                {error}
              </p>) : null}

            {mode === "signin" ? (<form className="space-y-4" onSubmit={submitSignIn}>
                {demoEmail ? (<div className="kamal-demo-account-card rounded-2xl border border-[#0ea5e9]/20 bg-[#effcff] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="kamal-demo-account-label text-xs font-extrabold uppercase tracking-normal text-[#0f766e]">Demo account</p>
                        <p className="kamal-demo-account-email mt-1 break-words text-sm font-extrabold text-[#123835]">{demoEmail}</p>
                      </div>
                      <button className="touch-target inline-flex items-center justify-center gap-2 rounded-lg bg-[#0ea5e9] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#0284c7] disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} onClick={signInWithDemo} type="button">
                        <KeyRound aria-hidden="true" className="h-4 w-4"/>
                        <span>{loading ? "Signing in..." : "Use demo account"}</span>
                      </button>
                    </div>
                  </div>) : null}
                <VoiceField autoComplete="email" inputMode="email" label="Email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="patient@example.com" required type="email" value={email}/>
                <VoiceField autoComplete="current-password" label="Password" name="password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required type="password" value={password}/>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <AuthButton disabled={loading} icon={KeyRound} label="Sign in and start"/>
                  <button className="touch-target inline-flex items-center justify-center gap-2 rounded-lg border border-[#324c4a]/15 bg-white px-5 py-3 font-bold text-[#324c4a] transition hover:border-[#324c4a]" onClick={() => {
                setMode("forgot");
                setError("");
                setMessage("");
            }} type="button">
                    <RotateCcw aria-hidden="true" className="h-5 w-5"/>
                    <span>Forgot password</span>
                  </button>
                </div>
              </form>) : null}

            {mode === "signup" ? (<form className="space-y-4" onSubmit={submitSignUp}>
                <VoiceField autoComplete="name" label="Name" name="name" onChange={(event) => setName(event.target.value)} placeholder="Your full name" required value={name}/>
                <VoiceField autoComplete="email" inputMode="email" label="Email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="patient@example.com" required type="email" value={email}/>
                <div className="grid gap-4 sm:grid-cols-2">
                  <VoiceField autoComplete="new-password" label="Password" name="password" onChange={(event) => setPassword(event.target.value)} placeholder="8+ characters" required type="password" value={password}/>
                  <VoiceField autoComplete="new-password" label="Confirm password" name="confirmPassword" onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" required type="password" value={confirmPassword}/>
                </div>
                <AuthButton disabled={loading} icon={UserPlus} label="Create account"/>
              </form>) : null}

            {mode === "verify" ? (<div className="space-y-5">
                <OtpInput disabled={loading} onChange={setOtp} onComplete={(code) => verifyCode(code)} value={otp}/>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <AuthButton disabled={loading || otp.length !== 6} icon={ArrowRight} label="Verify and start" onClick={() => verifyCode()} type="button"/>
                  <ResendButton cooldown={cooldown} loading={loading} onClick={resendCode}/>
                </div>
              </div>) : null}

            {mode === "forgot" ? (<form className="space-y-4" onSubmit={submitForgot}>
                <VoiceField autoComplete="email" inputMode="email" label="Email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="patient@example.com" required type="email" value={email}/>
                <AuthButton disabled={loading} icon={Mail} label="Send reset code"/>
              </form>) : null}

            {mode === "reset" ? (<form className="space-y-5" onSubmit={submitReset}>
                <OtpInput disabled={loading} onChange={setOtp} value={otp}/>
                <div className="grid gap-4 sm:grid-cols-2">
                  <VoiceField autoComplete="new-password" label="New password" name="newPassword" onChange={(event) => setNewPassword(event.target.value)} placeholder="8+ characters" required type="password" value={newPassword}/>
                  <VoiceField autoComplete="new-password" label="Confirm new password" name="confirmNewPassword" onChange={(event) => setConfirmNewPassword(event.target.value)} placeholder="Repeat password" required type="password" value={confirmNewPassword}/>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <AuthButton disabled={loading || otp.length !== 6} icon={LockKeyhole} label="Reset and start"/>
                  <ResendButton cooldown={cooldown} loading={loading} onClick={resendCode}/>
                </div>
              </form>) : null}
          </section>
        </div>
      </section>
    </main>);
}
function AuthButton({ disabled, icon: Icon, label, onClick, type = "submit" }) {
    return (<button className="touch-target inline-flex items-center justify-center gap-2 rounded-lg bg-[#324c4a] px-5 py-3 font-extrabold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60" disabled={disabled} onClick={onClick} type={type}>
      <Icon aria-hidden="true" className="h-5 w-5"/>
      <span>{label}</span>
    </button>);
}
function ResendButton({ cooldown, loading, onClick }) {
    return (<button className="touch-target inline-flex items-center justify-center gap-2 rounded-lg border border-[#324c4a]/15 bg-white px-5 py-3 font-bold text-[#324c4a] transition hover:border-[#324c4a] disabled:cursor-not-allowed disabled:opacity-60" disabled={loading || cooldown > 0} onClick={onClick} type="button">
      <RotateCcw aria-hidden="true" className="h-5 w-5"/>
      <span>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</span>
    </button>);
}
