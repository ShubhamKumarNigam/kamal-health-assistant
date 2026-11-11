"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  FolderHeart,
  Globe2,
  Heart,
  HeartPulse,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  Menu,
  MessageCircle,
  Mic,
  Moon,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
  Volume2,
  Watch,
  X,
} from "lucide-react";
import {
  freshDemo,
  metrics,
  getInsights,
  DEMO_DATE,
} from "../../packages/demo-data";
import {
  timeline,
  reschedule,
  emptyConversation,
  type HealthDocument,
  type HealthStore,
  type Language,
  type Metric,
  type Category,
} from "../../packages/health-core";
import {
  translations,
  direction,
} from "../../packages/internationalization";
import { respond } from "../../packages/ai";
import { sparkline } from "../../packages/charts";
import {
  deleteVault,
  hasVault,
  persist,
  restore,
} from "../../packages/local-db";
import { documentsToFHIR } from "../../packages/fhir";
import { readDocument, download } from "./documents";

type Screen =
  | "snapshot"
  | "home"
  | "vault"
  | "timeline"
  | "ask"
  | "care"
  | "share"
  | "privacy"
  | "family"
  | "connected";
const navItems: [Screen, typeof Heart][] = [
  ["home", LayoutDashboard],
  ["vault", FolderHeart],
  ["timeline", Clock3],
  ["ask", MessageCircle],
  ["care", CalendarDays],
  ["snapshot", HeartPulse],
  ["share", Stethoscope],
  ["connected", Watch],
  ["family", Users],
  ["privacy", ShieldCheck],
];
const categories: Category[] = [
  "Laboratory Reports",
  "Consultations",
  "Prescriptions",
  "Medications",
  "Imaging",
  "Diagnoses / Conditions",
  "Allergies",
  "Vaccinations",
  "Insurance",
  "Hospital Visits",
  "Procedures",
  "Wearable Reports",
  "Other Documents",
];
const prettyDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <Heart size={23} />
        <span />
      </span>
      <span>
        KAMAL<span className="logo-health">HEALTH</span>
      </span>
    </span>
  );
}
function Chart({ metric, period = 7 }: { metric: Metric; period?: number }) {
  const values = period === 7 ? metric.values : metric.month;
  const points = sparkline(values);
  return (
    <svg
      className={`sparkline spark-${metric.id}`}
      viewBox="0 0 200 58"
      role="img"
      aria-label={`${metric.label}, ${period}-day trend: ${values.join(", ")} ${metric.id === "sleep" ? "hours" : metric.unit}`}
    >
      <path d="M0 53H200" stroke="currentColor" opacity=".08" />
      <polygon
        points={`0,58 ${points} 200,58`}
        fill="currentColor"
        opacity=".07"
      />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing">
      <header className="public-nav">
        <Logo />
        <nav>
          <a href="#story">The idea</a>
          <a href="#privacy">Built around you</a>
          <a href="#vision">Our vision</a>
        </nav>
        <a className="button account-entry" href="/workspace">My account</a>
        <button className="button primary" onClick={onEnter}>
          Try Demo <ArrowRight size={16} />
        </button>
      </header>
      <main>
        <section className="hero">
          <div>
            <span className="eyebrow">
              <span className="tiny-dot" /> YOUR HEALTH. YOUR CONTINUITY.
            </span>
            <h1>
              Your health story
              <br />
              should{" "}
              <em>
                travel
                <br />
                with you.
              </em>
            </h1>
            <p>
              KAMAL organises your health records, understands them in your
              language, and helps you notice what matters next.
            </p>
            <div className="hero-actions">
              <button className="button primary large" onClick={onEnter}>
                Explore KAMAL <ArrowRight size={18} />
              </button>
              <a className="text-link" href="#story">
                Discover the story <span>↗</span>
              </a>
            </div>
            <div className="hero-note">
              <ShieldCheck size={16} /> Designed for personal control{" "}
              <span>·</span> Built for life across borders
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Illustration of a connected personal health story"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="center-story">
              <Leaf size={42} />
              <span>Your story.</span>
              <strong>Always with you.</strong>
              <small>REMEMBER · UNDERSTAND · SHARE</small>
            </div>
            <div className="floating-note note-one">
              <span className="soft-icon">
                <FileText />
              </span>
              <div>
                <strong>A record from London</strong>
                <small>Saved in your health story</small>
              </div>
              <Check size={16} />
            </div>
            <div className="floating-note note-two">
              <span className="soft-icon lavender">
                <Globe2 />
              </span>
              <div>
                <strong>In your own words</strong>
                <small>English · العربية · اردو</small>
              </div>
            </div>
            <div className="floating-note note-three">
              <HeartPulse size={23} />
              <div>
                <strong>A clearer picture</strong>
                <small>Patterns, with context</small>
              </div>
              <svg viewBox="0 0 80 30">
                <path
                  d="M0 15h18l8-9 10 20 9-16 8 5h27"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <span className="art-caption">
              A synthetic preview of a more connected future
            </span>
          </div>
        </section>
        <section className="story-strip">
          <span>
            ONE HEALTH STORY.
            <br />
            <strong>WHEREVER LIFE TAKES YOU.</strong>
          </span>
          {["Remember", "Understand", "Monitor", "Anticipate", "Share"].map(
            (x, i) => (
              <div key={x}>
                <small>0{i + 1}</small>
                {x}
                {i < 4 && <ArrowRight size={17} />}
              </div>
            ),
          )}
        </section>
        <section id="story" className="public-section">
          <div className="section-kicker">
            HEALTHCARE CHANGES. YOUR STORY STAYS.
          </div>
          <h2>
            Different countries.
            <br />
            Different doctors.
            <br />
            <em>Still the same you.</em>
          </h2>
          <div className="story-grid">
            <article>
              <FolderHeart />
              <h3>A lifetime, together</h3>
              <p>
                Reports from Dubai. A prescription from London. A consultation
                in India. Organise them in one personal timeline, with the
                original source always close.
              </p>
              <Badge>DEMO · Health Vault</Badge>
            </article>
            <article>
              <Globe2 />
              <h3>Understanding comes first</h3>
              <p>
                Review extracted report fields, prepare questions, and continue
                a structured conversation in English, Arabic or Urdu.
              </p>
              <Badge>DEMO · Multilingual conversation</Badge>
            </article>
            <article>
              <TrendingUp />
              <h3>Notice the bigger picture</h3>
              <p>
                See how synthetic wearable trends compare with your personal
                baseline. Understand why a change was noticed before deciding
                what to discuss.
              </p>
              <Badge>DEMO · Personal insights</Badge>
            </article>
          </div>
        </section>
        <section id="privacy" className="privacy-feature">
          <ShieldCheck size={38} />
          <div>
            <span className="section-kicker">YOUR DATA, YOUR CONTROL</span>
            <h2>
              A personal record.
              <br />A personal choice.
            </h2>
            <p>
              Explore without an account. Choose whether to save an encrypted
              vault on this browser. See exactly which features use external
              services and control what goes into your clinician summary.
            </p>
            <button className="button light" onClick={onEnter}>
              Explore the privacy centre <ArrowRight size={17} />
            </button>
          </div>
          <div className="privacy-diagram">
            <div>
              <LockKeyhole />
              <strong>On your device</strong>
              <span>Records · local extraction · visit notes</span>
            </div>
            <div className="diagram-line" />
            <div>
              <Globe2 />
              <strong>External services</strong>
              <span>Hosting · optional browser speech service</span>
            </div>
          </div>
        </section>
        <section className="public-section handoff-section">
          <span className="section-kicker">ARRIVE WITH YOUR STORY INTACT</span>
          <h2>
            Less explaining the past.
            <br />
            <em>More time for what matters.</em>
          </h2>
          <p>
            A concise, source-linked handoff brings your history, concerns and
            questions together. KAMAL does not replace the doctor. It helps you
            prepare for the conversation.
          </p>
          <button className="button primary" onClick={onEnter}>
            View Demo <ArrowRight size={17} />
          </button>
        </section>
        <section id="vision" className="vision-grid">
          <div>
            <span className="section-kicker">A UAE-FIRST VISION</span>
            <h3>Built for lives that cross borders.</h3>
            <p>
              A showcase prepared for Prototypes for Humanity, Dubai. Our
              ambition is continuity across languages, healthcare providers and
              generations—with selective, consent-controlled family context.
            </p>
          </div>
          <div>
            <span className="section-kicker">RESEARCH & RESPONSIBILITY</span>
            <h3>Credibility starts with clarity.</h3>
            <p>
              This is a research showcase, not a clinically validated or
              regulated medical device. Live functions, synthetic demonstrations
              and planned integrations are clearly distinguished.
            </p>
            <p>
              Project source:{" "}
              <a
                href="https://github.com/ShubhamKumarNigam/kamal-health-assistant"
                target="_blank"
                rel="noreferrer"
              >
                KAMAL Health Assistant
              </a>
              . Team biographies and institutional affiliations await verified
              information.
            </p>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <Logo />
        <span>Health information. Human understanding.</span>
        <small>Synthetic demonstration · No real patient data</small>
      </footer>
    </div>
  );
}

export default function App({ startInDemo = false }: { startInDemo?: boolean }) {
  const [entered, setEntered] = useState(startInDemo),
    [screen, setScreen] = useState<Screen>("home"),
    [lang, setLang] = useState<Language>("en");
  const [data, setData] = useState<HealthStore>(freshDemo),
    [toast, setToast] = useState(""),
    [period, setPeriod] = useState(7),
    [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All records"),
    [view, setView] = useState<"list" | "folders">("list");
  const [upload, setUpload] = useState(false),
    [draft, setDraft] = useState<HealthDocument | null>(null),
    [selected, setSelected] = useState<HealthDocument | null>(null),
    [busy, setBusy] = useState(""),
    [reviewed, setReviewed] = useState(false);
  const [input, setInput] = useState(""),
    [listening, setListening] = useState(false),
    [voiceConsent, setVoiceConsent] = useState(false),
    [pass, setPass] = useState(""),
    [encryptionPass, setEncryptionPass] = useState(""),
    [saved, setSaved] = useState(false),
    [locked, setLocked] = useState(false),
    [auth, setAuth] = useState(false);
  const [showAllMetrics, setShowAllMetrics] = useState(false),
    [showInsight, setShowInsight] = useState<string | null>(null),
    [compare, setCompare] = useState(false),
    [newReminder, setNewReminder] = useState(false),
    [reminderTitle, setReminderTitle] = useState(""),
    [reminderDate, setReminderDate] = useState(DEMO_DATE),
    [reminderType, setReminderType] = useState("Appointment");
  const [reason, setReason] = useState(
      "Follow-up for persistent fatigue and review of recent blood results.",
    ),
    [includeFamily, setIncludeFamily] = useState(false),
    [shareSimulation, setShareSimulation] = useState(false),
    [familyRelation, setFamilyRelation] = useState(""),
    [familyCondition, setFamilyCondition] = useState("");
  const insights = getInsights(data);
  const t = translations[lang];
  const active = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const [persistenceError, setPersistenceError] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = direction(lang);
  }, [lang]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!saved || !encryptionPass || locked) return;
    saveQueue.current = saveQueue.current
      .then(() => persist(data, encryptionPass))
      .then(() => setPersistenceError(false))
      .catch(() => {
        setPersistenceError(true);
        setToast("Could not save changes. Export a backup before leaving.");
      });
  }, [data, encryptionPass, saved, locked]);
  useEffect(() => {
    if (!saved || locked) return;
    let timer: ReturnType<typeof setTimeout>;
    const lock = () => {
      setLocked(true);
      setPass("");
      setEncryptionPass("");
      setData(freshDemo());
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, 5 * 60 * 1000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [saved, locked]);
  function go(next: Screen) {
    window.scrollTo({ top: 0, behavior: "instant" });
    setScreen(next);
    setMenu(false);
    setSearch("");
    setFilter("All records");
  }
  function enter() {
    setEntered(true);
    setSaved(hasVault());
    if (hasVault()) setLocked(true);
  }
  async function handleFile(file?: File) {
    if (!file) return;
    setReviewed(false);
    try {
      setDraft(await readDocument(file, setBusy));
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "Unable to read this file.",
      );
    } finally {
      setBusy("");
    }
  }
  function demoUpload() {
    setReviewed(false);
    setDraft({
      id: "demo-new-" + crypto.randomUUID(),
      title: "November follow-up blood test",
      date: DEMO_DATE,
      category: "Laboratory Reports",
      institution: "Demo Marina Clinic",
      country: "United Arab Emirates",
      summary:
        "Synthetic follow-up result: Vitamin D 24 ng/mL. The previous stored result was 18 ng/mL. These are demonstration values; the treating clinician should interpret the result.",
      tags: ["Vitamin D", "Demo import"],
      text: "SYNTHETIC DEMONSTRATION REPORT\nDate: 2026-11-11\nInstitution: Demo Marina Clinic\nVitamin D: 24 ng/mL\nReference range: 20–50 ng/mL\nFollow-up: Discuss results at scheduled GP visit.",
      fields: [
        {
          label: "Vitamin D",
          value: "24 ng/mL",
          source: "Demo report, line 4",
          confidence: 1,
          verification: "unverified",
        },
      ],
    });
  }
  function saveDraft() {
    if (!draft || !reviewed) return;
    setData((d) => ({
      ...d,
      documents: [
        {
          ...draft,
          fields: draft.fields.map((f) => ({
            ...f,
            verification: "verified" as const,
          })),
          tags: draft.tags.filter((x) => x !== "Needs review"),
        },
        ...d.documents,
      ],
    }));
    setDraft(null);
    setUpload(false);
    setToast("Verified record added to your health story.");
    go("timeline");
  }
  function send() {
    if (!input.trim()) return;
    const response = respond(input.trim(), data.conversation, lang);
    setData((d) => ({
      ...d,
      conversation: response.state,
      messages: [
        ...d.messages,
        { role: "user", text: input.trim() },
        { role: "assistant", text: response.text },
      ],
    }));
    setInput("");
  }
  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      setToast("Read aloud is not supported in this browser.");
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang =
      lang === "ar" ? "ar-AE" : lang === "ur" ? "ur-PK" : "en-GB";
    utterance.onerror = () =>
      setToast("This device could not read the selected language aloud.");
    speechSynthesis.speak(utterance);
  }
  function startVoice() {
    if (!voiceConsent) {
      setToast("Please allow optional browser speech processing below first.");
      return;
    }
    type Recognition = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    };
    const win = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Constructor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Constructor) {
      setToast(
        "Speech recognition is unavailable here. Use typing or the demo transcript.",
      );
      return;
    }
    if (active.current) return;
    const recognition = new Constructor();
    recognition.lang =
      lang === "ar" ? "ar-AE" : lang === "ur" ? "ur-PK" : "en-GB";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      setInput(e.results[0][0].transcript);
      setToast(
        "I understood your words. Review the transcript before sending.",
      );
    };
    recognition.onerror = () =>
      setToast(
        "Microphone unavailable. You can type or use the demo transcript.",
      );
    recognition.onend = () => {
      active.current = false;
      setListening(false);
    };
    try {
      recognition.start();
      active.current = true;
      setListening(true);
    } catch {
      setListening(false);
      active.current = false;
      setToast("Unable to start speech recognition.");
    }
  }
  async function unlock() {
    try {
      const value = await restore(pass);
      setData(value);
      setEncryptionPass(pass);
      setSaved(true);
      setLocked(false);
      setToast("Your local vault is unlocked.");
    } catch {
      setToast("Unable to unlock. Check your passphrase.");
    }
  }
  async function saveVault() {
    try {
      await saveQueue.current;
      await persist(data, pass);
      setEncryptionPass(pass);
      setSaved(true);
      setToast("Vault encrypted and saved on this browser.");
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "Could not save vault.",
      );
    }
  }
  const docs = timeline(data.documents).filter(
    (d) =>
      (filter === "All records" || d.category === filter) &&
      `${d.title} ${d.institution} ${d.country} ${d.tags.join(" ")} ${d.text || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function summaryText() {
    return [
      "KAMAL | Clinician handoff | SYNTHETIC DEMONSTRATION",
      "Aisha Rahman | Age 38 | Dubai | Prepared from stored records",
      "Reason for visit: " + reason,
      "Relevant history: Patient-reported persistent fatigue. No confirmed chronic conditions recorded.",
      "Current medication: Vitamin D supplement; see original prescription (rx-aug). Dose not verified.",
      "Allergies: Not recorded. Confirm with patient; absence of data is not absence of allergy.",
      "Recent observations: Demo resting HR 68 bpm vs 30-day baseline 61 bpm; last three days above baseline. BP 118/76 mmHg (11 November).",
      ...timeline(data.documents)
        .filter((d) => d.category === "Laboratory Reports")
        .map(
          (d) =>
            `Investigation: ${d.date} | ${d.title} | ${d.fields.map((f) => `${f.label}: ${f.value} [${f.verification}]`).join("; ")} | Source ${d.id}`,
        ),
      "Previous consultation: 1 September 2026, fatigue; Demo Marina Clinic (gp-sep).",
      "Patient concerns: " +
        (data.conversation.chiefConcern ||
          "Fatigue and understanding recent test results."),
      "Red flags: " +
        (data.conversation.redFlags.length
          ? data.conversation.redFlags.join("; ")
          : "Not assessed. This summary does not establish absence of urgent symptoms."),
      "Questions requiring clarification: Confirm medication dose, allergies, symptom course and follow-up needs.",
      ...(includeFamily
        ? data.family
            .filter((f) => f.consent)
            .map(
              (f) =>
                `Consented family context: ${f.relationship} - ${f.condition}`,
            )
        : []),
      "Sources: original records remain in My Health Vault; source identifiers above match local records.",
      "KAMAL provides organisation support, not diagnosis. No clinical validation claimed.",
    ].join("\n\n");
  }
  async function pdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFont("helvetica");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(
      summaryText().replaceAll("—", "-").replaceAll("·", "|"),
      176,
    ) as string[];
    let y = 18;
    for (const line of lines) {
      if (y > 278) {
        doc.addPage();
        y = 18;
      }
      doc.text(line, 17, y);
      y += 4.5;
    }
    doc.save("KAMAL-synthetic-clinician-summary.pdf");
    setToast("Clinician summary downloaded.");
  }
  const docCard = (d: HealthDocument) => (
    <button className="document-row" key={d.id} onClick={() => setSelected(d)}>
      <span
        className={`doc-icon ${d.category === "Prescriptions" ? "lavender" : ""}`}
      >
        <FileText size={21} />
      </span>
      <span className="document-text">
        <strong>{d.title}</strong>
        <small>
          {d.institution} <span>·</span> {d.country}
        </small>
      </span>
      <span className="document-date">
        {prettyDate(d.date)}
        <small>{d.category}</small>
      </span>
      <ChevronRight size={17} />
    </button>
  );
  if (!entered)
    return (
      <>
        <Landing onEnter={enter} />
      </>
    );
  if (locked)
    return (
      <main className="lock-page">
        <Logo />
        <section className="card">
          <LockKeyhole size={34} />
          <h1>Your story is safely paused.</h1>
          <p>
            Unlock this browser’s encrypted vault with your passphrase. KAMAL
            cannot recover it.
          </p>
          <label>
            Vault passphrase
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void unlock();
              }}
            />
          </label>
          <button className="button primary" onClick={unlock}>
            Unlock local vault
          </button>
          <button
            className="button"
            onClick={() => {
              setSaved(false);
              setLocked(false);
              setData(freshDemo());
              setPass("");
            }}
          >
            Continue with unsaved demo
          </button>
          <small>The saved vault stays encrypted and unchanged.</small>
        </section>
        {toast && (
          <div role="status" className="toast">
            {toast}
          </div>
        )}
      </main>
    );
  return (
    <div className="app-shell" dir={direction(lang)}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button
          className="brand-button"
          onClick={() => setEntered(false)}
          aria-label="KAMAL public website"
        >
          <Logo />
        </button>
        <span className="workspace-label">YOUR HEALTH, TOGETHER</span>
        <nav aria-label="Main navigation">
          {navItems.map(([key, Icon], i) => (
            <button
              key={key}
              className={`nav-item ${screen === key ? "active" : ""} ${i === 6 ? "nav-separated" : ""}`}
              onClick={() => go(key)}
              aria-current={screen === key ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{t[key]}</span>
              {key === "ask" && <span className="nav-new">DEMO</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><a className="button full account-entry" href="/workspace">Open my account ↗</a>
          <div className="local-status">
            <ShieldCheck size={17} />
            <span>
              {saved
                ? "Encrypted local vault"
                : "Your demo stays in this session"}
              <small>
                {saved
                  ? "Auto-lock after 5 minutes"
                  : "Save encrypted in Privacy centre"}
              </small>
            </span>
          </div>
          <button className="profile-button" onClick={() => go("privacy")}>
            <span className="avatar">AR</span>
            <span>
              <strong>Aisha Rahman</strong>
              <small>My personal health space</small>
            </span>
            <Settings2 size={17} />
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            className="icon-button menu-toggle"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            My workspace <ChevronRight size={13} /> <strong>{t[screen]}</strong>
          </span>
          <div className="topbar-actions">
            <a className="account-top-link" href="/workspace">My account ↗</a><span className="showcase">
              <span className="tiny-dot" /> Showcase mode
            </span>
            <label className="language-select">
              <Globe2 size={16} />
              <select
                aria-label="Interface language"
                value={lang}
                onChange={(e) => setLang(e.target.value as Language)}
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
                <option value="ur">اردو</option>
              </select>
            </label>
            <button
              className="icon-button notification"
              aria-label="Open care reminders"
              onClick={() => go("care")}
            >
              <Bell size={19} />
              <span />
            </button>
            <span className="avatar small">AR</span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <div className="demo-label">
            <span className="tiny-dot" />
            {t.demo} <span>·</span> Exhibition date: 11 November 2026{" "}
            <span>·</span> <b>DEMO</b>
          </div>
          {screen === "home" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">WEDNESDAY, 11 NOVEMBER</div>
                  <h1>
                    {t.greeting}
                    <span className="greeting-sun">☀</span>
                  </h1>
                  <p>{t.subtitle}</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => setUpload(true)}
                >
                  <Plus size={17} />
                  {t.add}
                </button>
              </div>
              <section className="welcome-banner">
                <div>
                  <span className="banner-tag">
                    <Leaf size={15} /> A LITTLE MORE CONNECTED
                  </span>
                  <h2>
                    Your health story.
                    <br />
                    All in one place.
                  </h2>
                  <p>
                    Different doctors, different countries.
                    <br />
                    One continuous story that belongs to you.
                  </p>
                  <button className="text-link" onClick={() => go("timeline")}>
                    Explore your timeline <ArrowRight size={17} />
                  </button>
                </div>
                <div className="continuity-art">
                  <div className="continuity-line" />
                  <span className="place place-london">
                    London<small>2025</small>
                  </span>
                  <span className="place place-mumbai">
                    Mumbai<small>2026</small>
                  </span>
                  <span className="place place-dubai">
                    Dubai<small>TODAY</small>
                  </span>
                  <div className="story-leaf">
                    <Leaf size={45} />
                  </div>
                  <div className="story-card">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>Your story, together</strong>
                      <small>
                        {data.documents.length} records · 3 countries
                      </small>
                    </div>
                    <Check size={16} />
                  </div>
                </div>
              </section>
              <section className="health-section">
                <div className="section-heading">
                  <h2>
                    {t.today}
                    <span className="subtle-label">DEMO READINGS</span>
                  </h2>
                  <div className="segmented" aria-label="Trend period">
                    <button
                      className={period === 7 ? "selected" : ""}
                      onClick={() => setPeriod(7)}
                    >
                      7 days
                    </button>
                    <button
                      className={period === 30 ? "selected" : ""}
                      onClick={() => setPeriod(30)}
                    >
                      30 days
                    </button>
                  </div>
                </div>
                <div className="metrics-grid">
                  {metrics.slice(0, showAllMetrics ? 8 : 4).map((m, i) => (
                    <article className="metric-card" key={m.id}>
                      <div className="metric-title">
                        {i === 0 ? (
                          <Heart size={18} />
                        ) : i === 1 ? (
                          <Moon size={18} />
                        ) : i === 2 ? (
                          <Activity size={18} />
                        ) : (
                          <HeartPulse size={18} />
                        )}
                        <span>{m.label}</span>
                        <span className="metric-dot" />
                      </div>
                      <div className="metric-value" dir="ltr">
                        {m.value}
                        <small>{m.unit}</small>
                      </div>
                      <span className="metric-note">{m.note}</span>
                      <Chart metric={m} period={period} />
                      <small className="metric-baseline">{m.baseline}</small>
                      <div className="metric-footer">
                        <span>{m.source}</span>
                        <span>{m.updated}</span>
                      </div>
                    </article>
                  ))}
                </div>
                <button
                  className="small-link"
                  onClick={() => setShowAllMetrics(!showAllMetrics)}
                >
                  {showAllMetrics
                    ? "Show fewer readings"
                    : "View all health readings"}{" "}
                  <ArrowRight size={13} />
                </button>
              </section>
              <div className="dashboard-columns">
                <section className="card insights-card">
                  <div className="section-heading">
                    <h2>
                      <Sparkles size={19} />
                      {t.insights}
                    </h2>
                    <Badge>2 new</Badge>
                  </div>
                  <p className="section-description">
                    Small patterns. A clearer picture.
                  </p>
                  {insights.map((insight) => (
                    <div className="insight-item" key={insight.id}>
                      <span
                        className={`insight-symbol ${insight.level === "Attention" ? "amber" : ""}`}
                      >
                        {insight.level === "Attention" ? (
                          <TrendingUp size={19} />
                        ) : (
                          <FileText size={19} />
                        )}
                      </span>
                      <div>
                        <span
                          className={`insight-level ${insight.level === "Attention" ? "amber-text" : ""}`}
                        >
                          {insight.level.toUpperCase()}
                        </span>
                        <h3>{insight.title}</h3>
                        <p>
                          {insight.id === "i1"
                            ? "Above your personal baseline for 3 days. A change worth keeping an eye on."
                            : "Your latest blood results are ready to bring to your follow-up."}
                        </p>
                        <button
                          className="small-link"
                          onClick={() => setShowInsight(insight.id)}
                        >
                          Why am I seeing this? <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
                <section className="card care-card">
                  <div className="section-heading">
                    <h2>Your next little steps</h2>
                    <CalendarDays size={19} />
                  </div>
                  <p className="section-description">
                    A little support for your everyday care.
                  </p>
                  {data.reminders.slice(0, 3).map((r) => (
                    <div className="care-row" key={r.id}>
                      <button
                        className={`complete-button ${r.complete ? "checked" : ""}`}
                        aria-label={`Mark ${r.title} ${r.complete ? "incomplete" : "complete"}`}
                        onClick={() =>
                          setData((d) => ({
                            ...d,
                            reminders: d.reminders.map((x) =>
                              x.id === r.id
                                ? { ...x, complete: !x.complete }
                                : x,
                            ),
                          }))
                        }
                      >
                        {r.complete && <Check size={14} />}
                      </button>
                      <div>
                        <strong className={r.complete ? "struck" : ""}>
                          {r.title}
                        </strong>
                        <small>
                          {r.date === DEMO_DATE ? "Today" : prettyDate(r.date)}{" "}
                          · {r.time}
                        </small>
                      </div>
                    </div>
                  ))}
                  <button className="small-link" onClick={() => go("care")}>
                    Open my care plan <ArrowRight size={13} />
                  </button>
                </section>
              </div>
              <section className="card recent-card">
                <div className="section-heading">
                  <h2>Recently added to your story</h2>
                  <button className="small-link" onClick={() => go("vault")}>
                    View health vault <ArrowRight size={14} />
                  </button>
                </div>
                {timeline(data.documents).slice(0, 3).map(docCard)}
              </section>
              <div className="ask-banner">
                <span className="ask-logo">
                  <Sparkles size={23} />
                </span>
                <div>
                  <strong>A question on your mind?</strong>
                  <span>{t.speak}. Let’s make sense of it together.</span>
                </div>
                <button className="button" onClick={() => go("ask")}>
                  {t.ask}
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          {screen === "vault" && (
            <>
              <PageTitle
                title={t.vault}
                subtitle="Healthcare changes. Your health story should not disappear."
                action={
                  <button
                    className="button primary"
                    onClick={() => setUpload(true)}
                  >
                    <Plus size={17} />
                    {t.add}
                  </button>
                }
              />
              <div className="vault-stats">
                <div>
                  <strong>{data.documents.length}</strong>
                  <span>records, together</span>
                </div>
                <div>
                  <strong>3</strong>
                  <span>countries in your story</span>
                </div>
                <div>
                  <ShieldCheck />
                  <span>
                    {saved ? "Encrypted on this browser" : "Session-only demo"}
                  </span>
                </div>
              </div>
              <div className="toolbar">
                <label className="search-box">
                  <Search size={18} />
                  <input
                    aria-label="Search health records"
                    placeholder="Search records, providers, countries…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter document category"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option>All records</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <div className="segmented">
                  <button
                    className={view === "list" ? "selected" : ""}
                    onClick={() => setView("list")}
                  >
                    Timeline
                  </button>
                  <button
                    className={view === "folders" ? "selected" : ""}
                    onClick={() => setView("folders")}
                  >
                    Folders
                  </button>
                </div>
              </div>
              {view === "folders" ? (
                <div className="folder-grid">
                  {categories.map((c) => (
                    <button
                      key={c}
                      className="card folder"
                      onClick={() => {
                        setFilter(c);
                        setView("list");
                      }}
                    >
                      <FolderHeart size={28} />
                      <h3>{c}</h3>
                      <small>
                        {data.documents.filter((d) => d.category === c).length}{" "}
                        records
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <section className="card">
                  {docs.length ? (
                    docs.map(docCard)
                  ) : (
                    <Empty text="No records match your search. Try another term or add a document." />
                  )}
                </section>
              )}
              <p className="muted-note">
                Original files and verified fields stay linked. Uploaded files
                are held in this session until you choose encrypted saving.
              </p>
            </>
          )}
          {screen === "timeline" && (
            <>
              <PageTitle
                title={t.timeline}
                subtitle="The moments that make up your health story."
                action={
                  <button
                    className="button"
                    onClick={() => setCompare(!compare)}
                  >
                    <TrendingUp size={17} />
                    Show me what changed
                  </button>
                }
              />
              <div className="toolbar">
                <select
                  aria-label="Timeline category"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option>All records</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <button
                  className="button primary"
                  onClick={() => setUpload(true)}
                >
                  <Plus size={17} />
                  {t.add}
                </button>
              </div>
              {compare && (
                <div className="comparison card">
                  <Badge>DEMO · PERIOD COMPARISON</Badge>
                  <h3>March → October 2026</h3>
                  <div className="comparison-values">
                    <span>
                      16 <small>ng/mL</small>
                    </span>
                    <ArrowRight />
                    <span>
                      18 <small>ng/mL</small>
                    </span>
                  </div>
                  <p>
                    Vitamin D increased by 2 ng/mL between the stored reports.
                    This comparison does not determine the cause or treatment.
                  </p>
                  <button
                    className="small-link"
                    onClick={() =>
                      setSelected(
                        data.documents.find((d) => d.id === "lab-mar") || null,
                      )
                    }
                  >
                    March source
                  </button>
                  <button
                    className="small-link"
                    onClick={() =>
                      setSelected(
                        data.documents.find((d) => d.id === "lab-oct") || null,
                      )
                    }
                  >
                    October source
                  </button>
                </div>
              )}
              <div className="timeline">
                {docs.map((d, i) => (
                  <article className="timeline-event" key={d.id}>
                    <div className="timeline-date">
                      {(i === 0 ||
                        docs[i - 1].date.slice(0, 4) !==
                          d.date.slice(0, 4)) && (
                        <strong>{d.date.slice(0, 4)}</strong>
                      )}
                      <span>{prettyDate(d.date).slice(0, -5)}</span>
                    </div>
                    <div className="timeline-dot" />
                    <button
                      className="card timeline-card"
                      onClick={() => setSelected(d)}
                    >
                      <Badge tone="neutral">{d.category}</Badge>
                      <h3>{d.title}</h3>
                      <p>{d.summary}</p>
                      <small>
                        {d.institution} · {d.country}
                      </small>
                      <span className="small-link">
                        Open source record <ArrowRight size={13} />
                      </span>
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
          {screen === "ask" && (
            <>
              <PageTitle
                title={t.ask}
                subtitle={t.speak}
                action={<Badge>DEMO · STRUCTURED CONVERSATION</Badge>}
              />
              <div className="chat-layout">
                <section className="chat-panel card">
                  <div className="chat-top">
                    <span className="ask-logo">
                      <Sparkles />
                    </span>
                    <div>
                      <strong>A little understanding goes a long way.</strong>
                      <small>Prepare your story, one question at a time.</small>
                    </div>
                  </div>
                  <div className="chat-messages" aria-live="polite">
                    {!data.messages.length ? (
                      <div className="chat-welcome">
                        <Leaf size={44} />
                        <h2>
                          {lang === "en"
                            ? "What’s on your mind today?"
                            : lang === "ar"
                              ? "كيف يمكنني مساعدتك اليوم؟"
                              : "آج آپ کیا پوچھنا چاہتے ہیں؟"}
                        </h2>
                        <p>
                          Collect the details that matter for your next
                          healthcare conversation. This local demo asks up to 3
                          focused follow-ups.
                        </p>
                        <div className="prompt-chips">
                          {[
                            "Help me prepare for my GP visit",
                            "I have been feeling tired recently",
                          ].map((q) => (
                            <button key={q} onClick={() => setInput(q)}>
                              {q}
                              <ArrowRight size={14} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      data.messages.map((message, i) => (
                        <div className={`message ${message.role}`} key={i}>
                          <small>
                            {message.role === "user" ? "You" : "KAMAL · Demo"}
                          </small>
                          <p>{message.text}</p>
                          {message.role === "assistant" && (
                            <button
                              className="small-link"
                              onClick={() => speak(message.text)}
                            >
                              <Volume2 size={14} />
                              Read aloud
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {data.conversation.stage === "urgent" && (
                    <div role="alert" className="urgent-notice">
                      Urgent assessment may be needed. This is not an emergency
                      response service.
                    </div>
                  )}
                  <div className="composer">
                    <textarea
                      aria-label="Message to KAMAL"
                      placeholder={t.placeholder}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                    />
                    <button
                      className={`icon-button mic ${listening ? "listening" : ""}`}
                      aria-label={listening ? "Listening" : "Start voice input"}
                      onClick={startVoice}
                    >
                      <Mic size={22} />
                    </button>
                    <button
                      className="button primary"
                      onClick={send}
                      disabled={!input.trim()}
                      aria-label={t.send}
                    >
                      <Send size={19} />
                    </button>
                  </div>
                  <div className="voice-options">
                    <label>
                      <input
                        type="checkbox"
                        checked={voiceConsent}
                        onChange={(e) => setVoiceConsent(e.target.checked)}
                      />
                      Allow browser speech service (audio may leave this device)
                    </label>
                    <button
                      className="small-link"
                      onClick={() =>
                        setInput(
                          lang === "ar"
                            ? "أشعر بالتعب منذ ثلاثة أيام"
                            : lang === "ur"
                              ? "مجھے تین دن سے تھکاوٹ محسوس ہو رہی ہے"
                              : "I have been feeling tired for three days.",
                        )
                      }
                    >
                      Use demo transcript
                    </button>
                    {listening && <strong>Listening…</strong>}
                  </div>
                  <p className="chat-safety">
                    <ShieldCheck size={15} />
                    {t.safety}
                  </p>
                </section>
                <aside className="chat-context card">
                  <h3>Your context, your choice</h3>
                  <p>
                    Allow KAMAL to show relevant stored records alongside this
                    conversation.
                  </p>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={data.contextConsent}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          contextConsent: e.target.checked,
                        }))
                      }
                    />
                    Use my health context
                  </label>
                  {data.contextConsent ? (
                    <>
                      <Badge>LOCAL · CONSENTED</Badge>
                      {data.documents
                        .filter((d) =>
                          d.tags.some((tag) => /fatigue|vitamin/i.test(tag)),
                        )
                        .slice(0, 3)
                        .map((d) => (
                          <button
                            key={d.id}
                            className="context-source"
                            onClick={() => setSelected(d)}
                          >
                            <FileText size={15} />
                            {d.title}
                          </button>
                        ))}
                      <p className="muted-note">
                        Records are shown for your review. The demo does not
                        infer diagnoses from them.
                      </p>
                    </>
                  ) : (
                    <div className="context-locked">
                      <LockKeyhole />
                      <small>
                        Your records are not used in this conversation.
                      </small>
                    </div>
                  )}
                  <hr />
                  <h3>Conversation progress</h3>
                  <p>
                    {data.conversation.questionCount} of 3 follow-up questions
                  </p>
                  <button
                    className="small-link"
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        messages: [],
                        conversation: emptyConversation(),
                      }))
                    }
                  >
                    Start a new conversation
                  </button>
                </aside>
              </div>
            </>
          )}
          {screen === "care" && (
            <>
              <PageTitle
                title={t.care}
                subtitle="Small steps, a little less to remember."
                action={
                  <button
                    className="button primary"
                    onClick={() => setNewReminder(true)}
                  >
                    <Plus size={17} />
                    Add reminder
                  </button>
                }
              />
              {["Today", "Upcoming", "Completed"].map((group) => (
                <section className="card care-group" key={group}>
                  <h2>{group}</h2>
                  {data.reminders
                    .filter((r) =>
                      group === "Completed"
                        ? r.complete
                        : !r.complete &&
                          (group === "Today"
                            ? r.date <= DEMO_DATE
                            : r.date > DEMO_DATE),
                    )
                    .map((r) => (
                      <div className="care-row" key={r.id}>
                        <button
                          className={`complete-button ${r.complete ? "checked" : ""}`}
                          aria-label={`Complete ${r.title}`}
                          onClick={() =>
                            setData((d) => ({
                              ...d,
                              reminders: d.reminders.map((x) =>
                                x.id === r.id
                                  ? { ...x, complete: !x.complete }
                                  : x,
                              ),
                            }))
                          }
                        >
                          {r.complete && <Check size={14} />}
                        </button>
                        <div>
                          <strong>{r.title}</strong>
                          <small>
                            {r.type} · {prettyDate(r.date)} · {r.time}
                          </small>
                        </div>
                        {!r.complete && (
                          <button
                            className="button compact"
                            onClick={() =>
                              setData((d) => ({
                                ...d,
                                reminders: d.reminders.map((x) =>
                                  x.id === r.id ? reschedule(x, 1) : x,
                                ),
                              }))
                            }
                          >
                            Snooze 1 day
                          </button>
                        )}
                      </div>
                    ))}
                  {!data.reminders.some((r) =>
                    group === "Completed"
                      ? r.complete
                      : !r.complete &&
                        (group === "Today"
                          ? r.date <= DEMO_DATE
                          : r.date > DEMO_DATE),
                  ) && (
                    <Empty
                      text={
                        group === "Completed"
                          ? "Your completed steps will appear here."
                          : "Nothing scheduled here. A little breathing room."
                      }
                    />
                  )}
                </section>
              ))}
              <div className="notice">
                <Bell size={20} />
                <span>
                  In-app reminders work in this showcase. Background push
                  delivery is <b>ROADMAP</b>; keep using your usual medication
                  reminders.
                </span>
              </div>
            </>
          )}
          {screen === "snapshot" && (
            <>
              <PageTitle
                title={t.snapshot}
                subtitle="The essentials, in your own words."
                action={
                  <button
                    className="button primary"
                    onClick={() => go("share")}
                  >
                    Prepare for my doctor <ArrowRight size={16} />
                  </button>
                }
              />
              <div className="privacy-cards">
                <section className="card">
                  <Badge>DEMO · PATIENT SUMMARY</Badge>
                  <h2>Aisha’s health, at a glance</h2>
                  <p>
                    You have reported feeling tired. Your stored reports and a
                    follow-up appointment can help you explain the story to your
                    clinician.
                  </p>
                  <h3>Medicines</h3>
                  <p>
                    A Vitamin D supplement is recorded. Check the original
                    prescription for instructions; KAMAL does not set doses.
                  </p>
                  <button
                    className="small-link"
                    onClick={() =>
                      setSelected(
                        data.documents.find((d) => d.id === "rx-aug") || null,
                      )
                    }
                  >
                    View prescription source
                  </button>
                  <h3>Allergies & conditions</h3>
                  <p>
                    No allergy list or confirmed chronic conditions have been
                    entered. This means the information is missing, not that you
                    have no allergies or conditions.
                  </p>
                </section>
                <section className="card">
                  <h2>What to bring to your next visit</h2>
                  <p>
                    Your latest laboratory report, a current medication list and
                    any changes you have noticed.
                  </p>
                  {timeline(data.documents)
                    .filter((d) => d.category === "Laboratory Reports")
                    .slice(0, 2)
                    .map((d) => (
                      <div key={d.id}>
                        <h3>{d.title}</h3>
                        <p>{d.summary}</p>
                        <button
                          className="small-link"
                          onClick={() => setSelected(d)}
                        >
                          Explain this simply & view source
                        </button>
                      </div>
                    ))}
                  <h3>Coming up</h3>
                  {data.reminders
                    .filter((r) => !r.complete)
                    .map((r) => (
                      <p key={r.id}>
                        {r.date} · {r.title}
                      </p>
                    ))}
                </section>
              </div>
              <div className="notice">
                <ShieldCheck size={20} />
                <span>
                  This snapshot reflects only the records stored here. Review it
                  with your clinician and correct missing context.
                </span>
              </div>
            </>
          )}
          {screen === "share" && (
            <>
              <PageTitle
                title={t.share}
                subtitle="Arrive with your health story intact."
                action={<Badge>DEMO · SYNTHETIC SUMMARY</Badge>}
              />
              <div className="handoff-layout">
                <section className="card share-controls">
                  <h3>Prepare your visit</h3>
                  <label>
                    Reason for visit
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={includeFamily}
                      onChange={(e) => setIncludeFamily(e.target.checked)}
                    />
                    Include consented family context
                  </label>
                  <p className="muted-note">
                    Only individually consented entries are included.
                  </p>
                  <button className="button primary full" onClick={pdf}>
                    <ArrowDownToLine size={17} />
                    Download clinician PDF
                  </button>
                  <button
                    className="button full"
                    onClick={() => window.print()}
                  >
                    Print summary / Save as PDF
                  </button>
                  <button
                    className="button full"
                    onClick={async () => {
                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: "KAMAL synthetic clinician summary",
                            text: summaryText(),
                          });
                        } catch {
                          setToast("Sharing cancelled or unavailable.");
                        }
                      } else {
                        download(
                          "KAMAL-summary.txt",
                          summaryText(),
                          "text/plain",
                        );
                        setToast(
                          "Native sharing unavailable. Downloaded a text summary.",
                        );
                      }
                    }}
                  >
                    Open device share sheet
                  </button>
                  <button
                    className="small-link"
                    onClick={() => setShareSimulation(!shareSimulation)}
                  >
                    Preview temporary sharing
                  </button>
                  {shareSimulation && (
                    <div className="notice">
                      <span>
                        <b>SIMULATION</b>
                        <br />A 15-minute share grant would appear here. No
                        link, QR access, or patient data is published. Secure
                        temporary sharing needs a backend.
                      </span>
                    </div>
                  )}
                </section>
                <article className="card summary-sheet print-target">
                  <div className="summary-brand">
                    <Logo />
                    <Badge tone="neutral">CLINICIAN HANDOFF</Badge>
                  </div>
                  <h2>Aisha Rahman</h2>
                  <p>38 years · Dubai, UAE · Synthetic demonstration profile</p>
                  <hr />
                  {summaryText()
                    .split("\n\n")
                    .slice(2, -2)
                    .map((line, i) => (
                      <section key={i}>
                        <h3>{line.split(":")[0]}</h3>
                        <p>{line.slice(line.indexOf(":") + 1)}</p>
                      </section>
                    ))}
                  <h3>Supporting source records</h3>
                  {timeline(data.documents)
                    .filter((d) =>
                      [
                        "Laboratory Reports",
                        "Consultations",
                        "Prescriptions",
                      ].includes(d.category),
                    )
                    .map((d) => (
                      <button
                        className="source-link"
                        key={d.id}
                        onClick={() => setSelected(d)}
                      >
                        {d.id} · {d.title}
                        <ChevronRight size={13} />
                      </button>
                    ))}
                  <div className="summary-footer">
                    Prepared from stored information. Please verify original
                    records and patient history. KAMAL does not replace clinical
                    judgement.
                  </div>
                </article>
              </div>
            </>
          )}
          {screen === "privacy" && (
            <>
              <PageTitle
                title="Your Data, Your Control"
                subtitle="A clear view of where your information lives."
                action={<ShieldCheck size={32} />}
              />
              <div className="privacy-cards">
                <section className="card">
                  <span className="soft-icon">
                    <LockKeyhole />
                  </span>
                  <h2>On your device</h2>
                  <p>
                    Records, original uploads, care plans and conversations
                    remain in this tab unless you export or share them.
                  </p>
                  <Badge>
                    {saved
                      ? "AES-GCM ENCRYPTED STORAGE"
                      : "SESSION MEMORY · NOT YET SAVED"}
                  </Badge>
                  <p>
                    Optional encrypted saving uses a passphrase-derived key. The
                    passphrase is never stored. Changes save automatically while
                    unlocked.
                  </p>
                  <label>
                    Local vault passphrase
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      placeholder="At least 10 characters"
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                    />
                  </label>
                  <button className="button primary" onClick={saveVault}>
                    {saved
                      ? "Update encryption passphrase"
                      : "Encrypt & save this vault"}
                  </button>
                  {saved && (
                    <button
                      className="button"
                      onClick={async () => {
                        await saveQueue.current;
                        setLocked(true);
                        setPass("");
                        setEncryptionPass("");
                        setData(freshDemo());
                      }}
                    >
                      Lock now
                    </button>
                  )}
                  <small className="muted-note">
                    No recovery service. Browser storage can be cleared by your
                    browser or device. Export a backup before clearing it.
                  </small>
                </section>
                <section className="card">
                  <span className="soft-icon lavender">
                    <Globe2 />
                  </span>
                  <h2>External services</h2>
                  <p>
                    This synthetic demo runs locally. Your signed-in workspace uses the existing cloud services for account features. No demo health-data
                    analytics is configured. PDF text extraction and image OCR
                    run locally.
                  </p>
                  <div className="permission-row">
                    <span>
                      Browser speech recognition
                      <small>May send audio to your browser vendor</small>
                    </span>
                    <Badge tone="neutral">
                      {voiceConsent ? "CONSENTED" : "OFF"}
                    </Badge>
                  </div>
                  <button
                    className="small-link"
                    onClick={() => {
                      setVoiceConsent(false);
                      setData((d) => ({
                        ...d,
                        contextConsent: false,
                        family: d.family.map((f) => ({ ...f, consent: false })),
                      }));
                      setToast(
                        "Speech, context and family-sharing consents revoked.",
                      );
                    }}
                  >
                    Revoke optional permissions
                  </button>
                  <hr />
                  <div className="permission-row">
                    <span>Biometric unlock</span>
                    <Badge tone="neutral">ROADMAP</Badge>
                  </div>
                  <div className="permission-row">
                    <span>Private on-device language model</span>
                    <Badge tone="neutral">ROADMAP</Badge>
                  </div>
                  <div className="permission-row">
                    <span>Google · Apple · phone OTP</span>
                    <button
                      className="small-link"
                      onClick={() => setAuth(true)}
                    >
                      Integration status
                    </button>
                  </div>
                </section>
              </div>
              <section className="card">
                <h2>Take your story with you</h2>
                <p>
                  Exports contain readable information. Choose a trusted
                  destination. Deleting browser storage cannot guarantee
                  forensic erasure of backups.
                </p>
                <div className="button-row">
                  <button
                    className="button"
                    onClick={() =>
                      download(
                        "kamal-synthetic-records.json",
                        JSON.stringify(data, null, 2),
                      )
                    }
                  >
                    <ArrowDownToLine size={17} />
                    Export readable records
                  </button>
                  <button
                    className="button"
                    onClick={() =>
                      download(
                        "kamal-fhir-bundle.json",
                        JSON.stringify(
                          documentsToFHIR(data.documents),
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    Export FHIR-style bundle
                  </button>
                  <button
                    className="button danger-outline"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Delete the encrypted vault from this browser? This cannot be undone without an export.",
                        )
                      ) {
                        deleteVault();
                        setSaved(false);
                        setPass("");
                        setEncryptionPass("");
                        setToast(
                          "Saved vault deleted. Session data remains until you leave or reset.",
                        );
                      }
                    }}
                  >
                    Delete saved vault
                  </button>
                </div>
              </section>
              <details className="developer-controls">
                <summary>Exhibition controls & capability status</summary>
                <p>
                  Demo clock: 11 November 2026. Reset removes session edits and
                  replaces encrypted saved demo data if saving is enabled.
                </p>
                <button
                  className="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Reset this demonstration and remove all session edits?",
                      )
                    ) {
                      setData(freshDemo());
                      setShareSimulation(false);
                      setIncludeFamily(false);
                      setToast("Demo reset to the original synthetic profile.");
                      go("home");
                    }
                  }}
                >
                  Reset Demo
                </button>
                <p>
                  <b>LIVE:</b> local upload, extraction review, PDF export,
                  encrypted browser save. <b>DEMO:</b> wearable data,
                  visit-preparation conversation. <b>ROADMAP:</b> native device
                  integrations, provider authentication in this showcase,
                  clinical deployment.
                </p>
              </details>
            </>
          )}
          {screen === "connected" && (
            <>
              <PageTitle
                title={t.connected}
                subtitle="A more complete picture, with permission."
              />
              <section className="card connection-feature">
                <Watch size={40} />
                <div>
                  <Badge>DEMO CONNECTION</Badge>
                  <h2>Your daily rhythm, in context</h2>
                  <p>
                    Synthetic wearable readings power the dashboard. No live
                    account or device is connected.
                  </p>
                </div>
              </section>
              <div className="folder-grid">
                {[
                  "Apple Health",
                  "Android Health Connect",
                  "Fitbit",
                  "Garmin",
                  "Oura",
                  "Samsung Health",
                  "Hospital records",
                  "Insurance systems",
                  "Blood-pressure monitors",
                  "Glucose monitors",
                ].map((name) => (
                  <article className="card integration-card" key={name}>
                    <Watch />
                    <h3>{name}</h3>
                    <Badge tone="neutral">PLANNED INTEGRATION</Badge>
                    <p>
                      Not connected. Device permission and integration testing
                      required.
                    </p>
                  </article>
                ))}
              </div>
            </>
          )}
          {screen === "family" && (
            <>
              <PageTitle
                title="Family Health Context"
                subtitle="Useful context, shared only by choice."
              />
              <div className="notice">
                <Users />
                <span>
                  Family history stays separate from your own medical record.
                  Adding an entry does not share it or suggest that you have the
                  same condition.
                </span>
              </div>
              {data.family.map((f) => (
                <section className="card family-card" key={f.id}>
                  <span className="soft-icon">
                    <Users />
                  </span>
                  <div>
                    <h3>{f.relationship}</h3>
                    <p>{f.condition}</p>
                  </div>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={f.consent}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          family: d.family.map((x) =>
                            x.id === f.id
                              ? { ...x, consent: e.target.checked }
                              : x,
                          ),
                        }))
                      }
                    />
                    Allow in clinician summary
                  </label>
                </section>
              ))}
              <form
                className="card family-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!familyRelation.trim() || !familyCondition.trim()) return;
                  setData((d) => ({
                    ...d,
                    family: [
                      ...d.family,
                      {
                        id: crypto.randomUUID(),
                        relationship: familyRelation,
                        condition: familyCondition + " — patient reported",
                        consent: false,
                      },
                    ],
                  }));
                  setFamilyRelation("");
                  setFamilyCondition("");
                }}
              >
                <h3>Add voluntary context</h3>
                <label>
                  Relationship
                  <input
                    required
                    value={familyRelation}
                    onChange={(e) => setFamilyRelation(e.target.value)}
                    placeholder="For example, father"
                  />
                </label>
                <label>
                  Relevant history
                  <input
                    required
                    value={familyCondition}
                    onChange={(e) => setFamilyCondition(e.target.value)}
                    placeholder="Record only information you choose to include"
                  />
                </label>
                <button className="button primary" type="submit">
                  Add family context
                </button>
              </form>
            </>
          )}
          <footer className="app-footer">
            <span>
              <Leaf size={14} /> A little clarity. A lifetime of continuity.
            </span>
            <span>
              KAMAL Health <span>·</span> Made for your journey
            </span>
          </footer>
        </main>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {(["home", "timeline", "ask", "vault", "privacy"] as Screen[]).map(
            (key) => {
              const Icon = navItems.find(([k]) => k === key)![1];
              return (
                <button
                  key={key}
                  className={screen === key ? "active" : ""}
                  onClick={() => go(key)}
                >
                  <Icon size={20} />
                  <span>
                    {key === "privacy"
                      ? "Profile"
                      : key === "home"
                        ? "Home"
                        : key === "ask"
                          ? "Ask KAMAL"
                          : key === "vault"
                            ? "Vault"
                            : "Timeline"}
                  </span>
                </button>
              );
            },
          )}
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={18} />
          {toast}
        </div>
      )}
      {persistenceError && (
        <div role="alert" className="save-warning">
          Changes are not saved. Export a backup.
        </div>
      )}
      {upload && (
        <Modal
          title={draft ? "Review your record" : "Add to your health story"}
          onClose={() => {
            setUpload(false);
            setDraft(null);
          }}
        >
          {!draft ? (
            <>
              <p>
                Import a report, prescription or image. Files are processed on
                this device. Use only synthetic records in this showcase.
              </p>
              <label className="upload-zone">
                <ArrowDownToLine size={30} />
                <strong>Choose a PDF or image</strong>
                <span>PDF, PNG, JPEG, WebP or text · up to 8 MB</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp,text/plain"
                  aria-label="Upload health document"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                  disabled={!!busy}
                />
              </label>
              <label className="button full">
                Photograph a document
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                  disabled={!!busy}
                />
              </label>
              <div className="divider-text">OR EXPLORE A PRELOADED EXAMPLE</div>
              <button
                className="button primary full"
                onClick={demoUpload}
                disabled={!!busy}
              >
                <Sparkles size={17} />
                Use synthetic blood report
              </button>
              <p className="muted-note">
                English image OCR. Text-based PDFs supported; scanned PDFs can
                be uploaded as images. First-time OCR assets need connectivity.
              </p>
              {busy && (
                <p role="status" className="processing">
                  {busy}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="notice">
                <CircleHelp size={21} />
                <span>
                  <strong>Extracted information needs your review.</strong>
                  <br />
                  Automated extraction is not medical verification. Check every
                  field against the original before saving.
                </span>
              </div>
              <div className="form-grid">
                <label>
                  Title
                  <input
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Document date
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                  />
                </label>
                <label>
                  Organisation
                  <input
                    value={draft.institution}
                    onChange={(e) =>
                      setDraft({ ...draft, institution: e.target.value })
                    }
                  />
                </label>
                <label>
                  Country
                  <input
                    value={draft.country}
                    onChange={(e) =>
                      setDraft({ ...draft, country: e.target.value })
                    }
                  />
                </label>
                <label>
                  Document type
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        category: e.target.value as Category,
                      })
                    }
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              {draft.fields.map((f, i) => (
                <label className="extracted-field" key={i}>
                  {f.label}
                  <Badge tone="amber">
                    UNVERIFIED · {Math.round(f.confidence * 100)}% heuristic
                    score
                  </Badge>
                  <input
                    value={f.value}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fields: draft.fields.map((x, j) =>
                          j === i ? { ...x, value: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <small>Source: {f.source}</small>
                </label>
              ))}
              <label>
                Plain-language note
                <textarea
                  value={draft.summary}
                  onChange={(e) =>
                    setDraft({ ...draft, summary: e.target.value })
                  }
                />
              </label>
              <details>
                <summary>Read extracted source text</summary>
                <pre className="source-text">
                  {draft.text ||
                    "No readable text. Please inspect the original."}
                </pre>
              </details>
              {draft.fileData && (
                <a
                  className="small-link"
                  href={draft.fileData}
                  download={draft.title}
                >
                  Download original for verification
                </a>
              )}
              <label className="check-label review-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I checked the date, fields and summary against the original.
              </label>
              <button
                className="button primary full"
                disabled={!reviewed || !draft.title || !draft.date}
                onClick={saveDraft}
              >
                Save verified record <Check size={17} />
              </button>
            </>
          )}
        </Modal>
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <Badge tone="neutral">{selected.category}</Badge>
          <p>
            {prettyDate(selected.date)} · {selected.institution} ·{" "}
            {selected.country}
          </p>
          <div className="simple-summary">
            <Sparkles size={21} />
            <div>
              <h3>In simple terms</h3>
              <p>{selected.summary}</p>
            </div>
          </div>
          {selected.fields.map((f, i) => (
            <div className="record-field" key={i}>
              <strong>{f.label}</strong>
              <span>{f.value}</span>
              <Badge tone={f.verification === "verified" ? "green" : "amber"}>
                {f.verification}
              </Badge>
              <small>Source: {f.source}</small>
            </div>
          ))}
          <details>
            <summary>Original source text</summary>
            <pre className="source-text">
              {selected.text || "Original text not available."}
            </pre>
          </details>
          {selected.fileData ? (
            <a
              className="button"
              href={selected.fileData}
              download={selected.title}
            >
              Download original file
            </a>
          ) : (
            <button
              className="button"
              onClick={() =>
                download(
                  selected.id + ".txt",
                  selected.text || selected.summary,
                  "text/plain",
                )
              }
            >
              Download synthetic source
            </button>
          )}
        </Modal>
      )}
      {showInsight && (
        <Modal
          title="Why KAMAL noticed this"
          onClose={() => setShowInsight(null)}
        >
          {insights
            .filter((i) => i.id === showInsight)
            .map((i) => (
              <div key={i.id}>
                <Badge tone={i.level === "Attention" ? "amber" : "green"}>
                  {i.level}
                </Badge>
                <h3>{i.title}</h3>
                <p>{i.reason}</p>
                {i.id === "i1" && <Chart metric={metrics[4]} />}
                <dl className="insight-details">
                  <dt>Source</dt>
                  <dd>{i.source}</dd>
                  <dt>Time period</dt>
                  <dd>{i.period}</dd>
                  <dt>Uncertainty</dt>
                  <dd>{i.uncertainty}</dd>
                  <dt>A safe next step</dt>
                  <dd>{i.action}</dd>
                </dl>
                <button
                  className="button primary"
                  onClick={() => {
                    setShowInsight(null);
                    go("share");
                  }}
                >
                  Prepare for my clinician
                </button>
              </div>
            ))}
        </Modal>
      )}
      {newReminder && (
        <Modal
          title="A little help remembering"
          onClose={() => setNewReminder(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!reminderTitle.trim()) return;
              setData((d) => ({
                ...d,
                reminders: [
                  ...d.reminders,
                  {
                    id: crypto.randomUUID(),
                    title: reminderTitle,
                    date: reminderDate,
                    time: "09:00",
                    type: reminderType,
                    complete: false,
                  },
                ],
              }));
              setNewReminder(false);
              setReminderTitle("");
              setToast("Reminder added to your care plan.");
            }}
          >
            <label>
              Reminder
              <input
                required
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="For example, prepare for my follow-up"
              />
            </label>
            <label>
              Date
              <input
                type="date"
                required
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
              />
            </label>
            <label>
              Type
              <select
                value={reminderType}
                onChange={(e) => setReminderType(e.target.value)}
              >
                {[
                  "Medication",
                  "Appointment",
                  "Laboratory test",
                  "Vaccination",
                  "Prescription renewal",
                  "Follow-up",
                  "Screening",
                  "Personal",
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <button className="button primary full" type="submit">
              Save reminder
            </button>
          </form>
        </Modal>
      )}
      {auth && (
        <Modal title="Account connection status" onClose={() => setAuth(false)}>
          <p>
            This showcase runs locally with a synthetic demo profile. It is not
            an authenticated patient service.
          </p>
          {[
            "Apple sign-in",
            "Phone OTP",
          ].map((name) => (
            <div className="permission-row" key={name}>
              {name}
              <Badge tone="neutral">ROADMAP IN THIS BUILD</Badge>
            </div>
          ))}
          <p>
            Google and email sign-in are available in your account workspace. Your real records remain separate from this synthetic demonstration.
          </p>
          <a className="button primary" href="/login?next=/workspace">Sign in with Google or email</a><button className="button" onClick={() => setAuth(false)}>
            Continue demonstration
          </button>
        </Modal>
      )}
    </div>
  );
}
function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Leaf size={25} />
      <p>{text}</p>
    </div>
  );
}
