import html
import os
import zipfile
from datetime import datetime


OUT = "docs/KAMAL-Website-Complete-Documentation.docx"


def esc(value):
    return html.escape(str(value), quote=False)


def run(text, bold=False, italic=False, color=None, size=None):
    props = []
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    if size:
        props.append(f'<w:sz w:val="{size}"/>')
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    preserve = ' xml:space="preserve"' if str(text).startswith(" ") or str(text).endswith(" ") else ""
    return f"<w:r>{rpr}<w:t{preserve}>{esc(text)}</w:t></w:r>"


def paragraph(text="", style=None, bold=False, italic=False, color=None, size=None, jc=None, before=None, after=None, num_id=None, ilvl=0):
    ppr = []
    if style:
        ppr.append(f'<w:pStyle w:val="{style}"/>')
    if num_id is not None:
        ppr.append(f'<w:numPr><w:ilvl w:val="{ilvl}"/><w:numId w:val="{num_id}"/></w:numPr>')
    spacing = []
    if before is not None:
        spacing.append(f'w:before="{before}"')
    if after is not None:
        spacing.append(f'w:after="{after}"')
    if spacing:
        ppr.append(f"<w:spacing {' '.join(spacing)} w:line=\"300\" w:lineRule=\"auto\"/>")
    if jc:
        ppr.append(f'<w:jc w:val="{jc}"/>')
    ppr_xml = f"<w:pPr>{''.join(ppr)}</w:pPr>" if ppr else ""
    return f"<w:p>{ppr_xml}{run(text, bold=bold, italic=italic, color=color, size=size)}</w:p>"


def h1(text):
    return paragraph(text, style="Heading1")


def h2(text):
    return paragraph(text, style="Heading2")


def h3(text):
    return paragraph(text, style="Heading3")


def bullet(text):
    return paragraph(text, num_id=1, after=80)


def number(text):
    return paragraph(text, num_id=2, after=80)


def callout(title, body, tone="info"):
    fill = {"info": "EAF7F2", "warn": "FFF7E6", "risk": "FFF5F5"}.get(tone, "EAF7F2")
    border = {"info": "69C3A0", "warn": "B7791F", "risk": "DC2626"}.get(tone, "69C3A0")
    return (
        f'<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/>'
        f'<w:tblInd w:w="120" w:type="dxa"/><w:tblBorders>'
        f'<w:top w:val="single" w:sz="8" w:color="{border}"/>'
        f'<w:left w:val="single" w:sz="8" w:color="{border}"/>'
        f'<w:bottom w:val="single" w:sz="8" w:color="{border}"/>'
        f'<w:right w:val="single" w:sz="8" w:color="{border}"/>'
        f'<w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
        f'<w:tblCellMar><w:top w:w="140" w:type="dxa"/><w:left w:w="180" w:type="dxa"/>'
        f'<w:bottom w:w="140" w:type="dxa"/><w:right w:w="180" w:type="dxa"/></w:tblCellMar></w:tblPr>'
        f'<w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid><w:tr><w:tc>'
        f'<w:tcPr><w:tcW w:w="9360" w:type="dxa"/><w:shd w:fill="{fill}"/></w:tcPr>'
        f'{paragraph(title, bold=True, color="103C38", size=24, after=60)}'
        f'{paragraph(body, after=60)}'
        f'</w:tc></w:tr></w:tbl>{paragraph("", after=80)}'
    )


def table(headers, rows, widths=None):
    widths = widths or [int(9360 / len(headers))] * len(headers)
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = [
        '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/>',
        '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="9CA3AF"/><w:left w:val="single" w:sz="4" w:color="9CA3AF"/>',
        '<w:bottom w:val="single" w:sz="4" w:color="9CA3AF"/><w:right w:val="single" w:sz="4" w:color="9CA3AF"/>',
        '<w:insideH w:val="single" w:sz="4" w:color="D1D5DB"/><w:insideV w:val="single" w:sz="4" w:color="D1D5DB"/></w:tblBorders>',
        '<w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar>',
        '</w:tblPr>',
        f'<w:tblGrid>{grid}</w:tblGrid>',
    ]
    out.append("<w:tr>")
    for i, head in enumerate(headers):
        out.append(f'<w:tc><w:tcPr><w:tcW w:w="{widths[i]}" w:type="dxa"/><w:shd w:fill="E8EEF5"/></w:tcPr>{paragraph(head, bold=True, color="0B2545", after=40)}</w:tc>')
    out.append("</w:tr>")
    for row in rows:
        out.append("<w:tr>")
        for i, cell in enumerate(row):
            out.append(f'<w:tc><w:tcPr><w:tcW w:w="{widths[i]}" w:type="dxa"/></w:tcPr>{paragraph(cell, after=40)}</w:tc>')
        out.append("</w:tr>")
    out.append("</w:tbl>")
    out.append(paragraph("", after=100))
    return "".join(out)


def page_break():
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def section_properties():
    return (
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
        '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>'
    )


def content():
    parts = []
    parts.append(paragraph("KAMAL Health Assistant", style="Title"))
    parts.append(paragraph("Complete Website Documentation, Architecture Reference, and Product Manual", style="Subtitle"))
    parts.append(paragraph(f"Generated: {datetime.now().strftime('%d %B %Y')}", color="555555", after=160))
    parts.append(callout(
        "Document purpose",
        "This document explains the complete KAMAL health and wellness website in detail: product goals, pages, user journeys, UI behavior, backend APIs, database tables, AI model usage, email delivery, reminder scheduling, safety boundaries, and operational notes.",
    ))
    parts.append(h1("1. Executive Overview"))
    parts.append(paragraph("KAMAL is a focused health and wellness web application built with Next.js, React, and Tailwind CSS. It helps a patient prepare for a doctor visit, describe symptoms, run a doctor-style AI follow-up flow, save diagnosis history, generate doctor-ready reports, set medication reminders, ask medical education questions, upload reports or images for analysis, and generate supportive diet guidance after a diagnosis report exists."))
    parts.append(paragraph("The product is intentionally structured around a practical care workspace rather than a general chatbot. Most pages are framed as workflow tools: session intake, diagnosis conversation, history, reminders, report, analyser, health education search, diet planner, emergency page, and profile. The app uses a calm green clinical visual language, a light/dark theme switch, large touch targets, and simple patient-facing copy."))
    parts.append(h2("Core product promise"))
    for item in [
        "Let patients capture symptoms and medical context before seeing a doctor.",
        "Ask one focused follow-up question at a time instead of overwhelming the patient.",
        "Preserve completed diagnosis sessions in history with transcript, recommendations, red flags, and self-care guidance.",
        "Generate doctor-ready handoff reports and email or download them.",
        "Support reminder workflows with custom schedules and email delivery.",
        "Answer general medical education questions while keeping disclaimers and emergency guidance visible.",
        "Keep data local in SQLite for development and verification."
    ]:
        parts.append(bullet(item))
    parts.append(h2("Technology snapshot"))
    parts.append(table(
        ["Area", "Implementation"],
        [
            ["Frontend framework", "Next.js App Router with React components and Tailwind utility styling."],
            ["Language", "JavaScript JSX only; TypeScript was removed from the active source/config."],
            ["Theme", "Light/dark theme stored in local storage and applied via html[data-theme]."],
            ["Authentication", "Email/password with OTP verification, Google OAuth, session cookies, password reset."],
            ["Database", "Local SQLite database named kamal.db through lib/auth/sqliteStore.js."],
            ["AI model", "Qwen model via Groq OpenAI-compatible chat completions."],
            ["Email service", "Resend for OTP, medication reminders, reports, and history summary email."],
            ["Document/report output", "Text downloads and email body generation; this manual documents the whole site."]
        ],
        [2300, 7060]
    ))

    parts.append(page_break())
    parts.append(h1("2. Site Navigation and Page Map"))
    parts.append(paragraph("The AppShell component defines the logged-in workspace navigation. It provides the sidebar on desktop, mobile topbar/navigation rail, theme toggle, KAMAL logo, and profile link. The navigation items are Home, Session, History, Reminders, Diet, Analyser, Search, and Report. Some extra development or safety routes are also available, such as Emergency and Database viewer."))
    parts.append(table(
        ["Route", "Page role", "Access behavior"],
        [
            ["/", "Landing page describing the KAMAL workflow, concerns, and services.", "Public; profile link depends on login state."],
            ["/login", "Authentication flow for email signup/login, OTP, Google OAuth, and reset password.", "Redirects signed-in users to the safe next path."],
            ["/session", "Patient intake and diagnosis starter.", "Requires signed-in user."],
            ["/session/diagnosis", "Doctor-style AI follow-up session.", "Requires signed-in user, saved intake, and diagnosis session token."],
            ["/onboarding/history", "Patient history summary and completed diagnosis cards.", "Requires signed-in user."],
            ["/reminders", "Medication reminder manager with custom schedules.", "UI page is available; API requires signed-in user."],
            ["/search", "Medical education question search powered by Qwen.", "Public page shell; API uses configured model key."],
            ["/image-upload", "Report/image analyser for PDFs, docs, images, and X-rays.", "Page for care tools."],
            ["/reports/demo", "Doctor-ready patient report generated from intake and diagnosis history.", "Requires signed-in user."],
            ["/diet", "Diet planner generated from latest diagnosis and report context.", "Requires signed-in user."],
            ["/profile", "Patient profile, contact updates, language controls, logout.", "Requires signed-in user."],
            ["/emergency", "Emergency warning and call 112 screen.", "Public safety route."],
            ["/database", "Local SQLite database viewer for development verification.", "Development/diagnostic page."]
        ],
        [2100, 5000, 2260]
    ))
    parts.append(h2("Navigation design"))
    for item in [
        "Desktop uses a persistent left sidebar with KAMAL branding and a care workspace helper panel.",
        "Mobile uses a topbar and horizontal navigation rail to preserve access to main tools.",
        "Theme toggle is visible beside the profile button in the top action area.",
        "Profile and Diagnosis were removed from the left navigation as separate sidebar entries based on user preference.",
        "The app uses large rounded buttons and touch targets for accessibility on mobile and patient use."
    ]:
        parts.append(bullet(item))

    parts.append(h1("3. Landing Page"))
    parts.append(paragraph("The landing page is implemented in components/LandingPage.jsx and rendered from app/page.jsx. Its job is to introduce KAMAL as a calm health and wellness workspace, show the core care areas, and guide the user toward starting a session."))
    parts.append(h2("Landing page sections"))
    for item in [
        "Top navigation: Home, Sleep, Mindfulness, Mental Health anchors plus theme toggle and profile button.",
        "Hero: forest meditation image, dark overlay, KAMAL mental health support badge, headline, description, and Start session CTA.",
        "Concern cards: sleep problems, low energy, weight change, report uploads, aging care, everyday disease.",
        "Deep support section: explains that the app feels like wellness software but has clinical intake structure.",
        "Service cards: language intake, guided session, care reminders, doctor report.",
        "Workflow cards: six numbered actions covering diagnosis session, voice/image support, analyser, history, reminders, and search."
    ]:
        parts.append(bullet(item))
    parts.append(h2("Visual direction"))
    parts.append(paragraph("The landing page uses a calm Leafcare-inspired feel with mint green, deep teal, large imagery, white translucent cards, and rounded sections. The site avoids heavy clinical harshness while still signaling care, safety, and structure."))

    parts.append(h1("4. Authentication and Account Access"))
    parts.append(paragraph("Authentication is centered around app/login/page.jsx and components/AuthFlow.jsx. The backend lives under app/api/auth and lib/auth/sqliteStore.js. The login page initializes the database, validates the next path, checks an existing session cookie, and redirects signed-in users."))
    parts.append(h2("Supported auth paths"))
    for item in [
        "Email signup creates a user account and sends an OTP.",
        "OTP verification marks the email as verified.",
        "Login checks credentials and establishes a secure session cookie.",
        "Resend OTP supports retrying email verification.",
        "Forgot password and reset password support account recovery.",
        "Google OAuth supports sign-in and callback handling.",
        "Logout revokes the active session and sends the user back to login with a signed-out message."
    ]:
        parts.append(bullet(item))
    parts.append(h2("Auth-related API routes"))
    parts.append(table(
        ["API route", "Responsibility"],
        [
            ["/api/auth/signup", "Create account, normalize email, hash password, send OTP."],
            ["/api/auth/verify-otp", "Validate one-time code and mark email verified."],
            ["/api/auth/login", "Authenticate user and set the session cookie."],
            ["/api/auth/logout", "Revoke the current session token."],
            ["/api/auth/me", "Return current user session information."],
            ["/api/auth/resend-otp", "Send another OTP email."],
            ["/api/auth/forgot-password", "Start reset-password flow."],
            ["/api/auth/reset-password", "Complete password reset."],
            ["/api/auth/google", "Start Google OAuth."],
            ["/api/auth/google/callback", "Handle Google OAuth callback and create session."]
        ],
        [3000, 6360]
    ))
    parts.append(callout("Security note", "The application should never expose full API keys or OTP secrets in UI, logs, generated documents, or client-side code. Documentation should mention environment variable names only, not secret values.", "warn"))

    parts.append(page_break())
    parts.append(h1("5. Patient Intake and Session Start"))
    parts.append(paragraph("The /session page is the entry point for a doctor-style diagnosis flow. It requires a signed-in user, loads the latest patient intake from SQLite, and renders PatientIntakeForm with startDiagnosisOnSubmit enabled. The page uses the dark AppShell variant to visually separate the clinical conversation flow from the rest of the workspace."))
    parts.append(h2("Patient intake fields"))
    for item in [
        "Age: numeric patient age used as diagnosis context.",
        "Gender: selected from supported values and later formatted in history.",
        "Height in centimeters and weight in kilograms: saved as numeric context.",
        "Allergies: optional but important for safety and future guidance.",
        "Main concern: the core symptom or issue that starts the diagnosis session."
    ]:
        parts.append(bullet(item))
    parts.append(h2("Session token flow"))
    parts.append(paragraph("After a patient saves the concern and starts diagnosis, /api/diagnosis/session creates a diagnosis-session JWT bound to the current user ID and intake ID. /session/diagnosis verifies this token before allowing the doctor-style chat to run. This prevents directly opening the diagnosis route without a saved concern."))

    parts.append(h1("6. Diagnosis Session"))
    parts.append(paragraph("The diagnosis session is implemented in components/DiagnosisSession.jsx with backend logic in app/api/diagnosis/chat/route.js. It uses Qwen through Groq and follows a controlled clinical intake pattern: ask one focused follow-up at a time, collect enough detail, stop when complete, then save the diagnosis session to history."))
    parts.append(h2("Conversation behavior"))
    for item in [
        "The first user message is the saved main concern from patient intake.",
        "The assistant is labeled Doctor AI and asks one focused question at a time.",
        "The model is instructed to stay within the health concern and avoid irrelevant or informal responses.",
        "The model should reply in the same language as the patient where possible.",
        "Minimum and maximum turn thresholds guide when the model should complete the diagnosis.",
        "If the patient ends the session, the backend returns a cautious final summary from available facts.",
        "If emergency red flags appear, the assistant should advise urgent care and keep the response concise."
    ]:
        parts.append(bullet(item))
    parts.append(h2("Input methods"))
    parts.append(table(
        ["Input method", "Behavior"],
        [
            ["Typing", "Patient enters the answer in a textarea and sends it to the diagnosis API."],
            ["Voice", "Microphone records audio, sends it to /api/transcribe, and appends the transcription to the reply."],
            ["Image attachment", "Patient attaches an image; it is analyzed through /api/analyser and the analysis context is passed into the diagnosis chat."],
            ["Quick answers", "Contextual chips appear only when the latest doctor question matches specific patterns such as duration, pain severity, fever temperature, medicine taken, or yes/no."],
            ["Final diagnosis", "When complete, a DiagnosisPanel shows likely disease/condition, confidence, reasoning, next steps, red flags, and a history link."]
        ],
        [2400, 6960]
    ))
    parts.append(h2("Quick answer logic"))
    parts.append(paragraph("Quick answers are not fixed globally. The code reads the latest assistant question and uses heuristics to decide which chip group should appear. Duration prompts show options such as 1 day, 3 days, 1 week, 2 weeks, 1 month, and 1 year. Pain or severity prompts show 1/10 through 9/10 style options. Fever prompts show common temperature values. Medicine prompts show options such as no medicine yet or paracetamol taken. Yes/no style prompts show Yes, No, and Not sure. The symptom-progress group was removed, so Getting better, Same as before, Getting worse, and Comes and goes no longer appear."))
    parts.append(h2("Diagnosis API output contract"))
    for item in [
        "status: follow_up or complete.",
        "reply: patient-facing response or final assessment.",
        "caution: safety reminder.",
        "diagnosis.primaryDisease: single most likely disease or unclear needs clinician evaluation.",
        "diagnosis.likelyConditions: possible conditions list.",
        "diagnosis.confidenceLevel: Low, Moderate, or High.",
        "diagnosis.reasoning: brief reasoning from provided facts only.",
        "diagnosis.recommendedNextSteps: practical next actions.",
        "diagnosis.redFlags: urgent warning signs.",
        "diagnosis.selfCare: safe supportive care items.",
        "diagnosis.doctorConfirmationNote: reminder that a qualified doctor should confirm."
    ]:
        parts.append(bullet(item))
    parts.append(callout("Clinical boundary", "The app must not claim certainty, replace a doctor, or prescribe restricted medicines. Every diagnosis-related flow carries a caution or doctor-confirmation note.", "risk"))

    parts.append(page_break())
    parts.append(h1("7. History Summary"))
    parts.append(paragraph("The /onboarding/history page is the saved patient history workspace. It requires login, reads the latest intake and diagnosis sessions, builds a history summary, and renders patient details, completed diagnosis cards, history actions, and a disclaimer."))
    parts.append(h2("Visible history layout"))
    for item in [
        "Patient card shows patient name first and email beneath it.",
        "Completed diagnoses section lists saved diagnosis sessions.",
        "Each diagnosis card shows Diagnosis 1, Diagnosis 2, etc., a short summary, an expand/collapse arrow, and formatted date such as 22 June 2026, 12:10.",
        "Expanded diagnosis cards show patient context, doctor recommendations, self-care guidance, red flags, and conversation transcript.",
        "History actions provide Download and Mail me buttons.",
        "The Template order card was replaced with a medical disclaimer."
    ]:
        parts.append(bullet(item))
    parts.append(h2("History email behavior"))
    parts.append(paragraph("The history mail API sends the latest diagnosis summary to the signed-in user email. Earlier override variables were removed so the recipient is no longer hardcoded to a developer address. Actual delivery depends on Resend configuration and verified sender/domain permissions."))

    parts.append(h1("8. Reports"))
    parts.append(paragraph("The report page at /reports/demo creates a doctor-ready handoff from saved diagnosis history and patient pre-text. It uses buildPatientReport in lib/patientReport.js, which can call the Qwen model through Groq or fall back to stable generated content when model configuration is unavailable."))
    parts.append(h2("Report contents"))
    for item in [
        "Header: KAMAL patient report, Doctor-ready handoff, and a light green header background.",
        "Patient facts: patient name and patient email.",
        "Pre text: saved patient context from intake.",
        "Summary: patient-friendly overview of the latest report.",
        "Doctor recommendations: practical clinician-oriented next steps.",
        "Self-care guidance: supportive care that does not replace medical advice.",
        "Red flags: urgent warning signs.",
        "Caution: final medical disclaimer.",
        "Report actions: download and email the report to a single recipient."
    ]:
        parts.append(bullet(item))
    parts.append(paragraph("The Report source card was removed from the sidebar based on UI feedback. The visual contrast was adjusted so the header is greener but not too bold in light mode."))

    parts.append(h1("9. Reminders"))
    parts.append(paragraph("The reminders page centers on medication and follow-up reminders. The user can enter a reminder title, time, channel, repeat rule, details, and optional custom schedule. Reminders are stored in SQLite and processed by lib/reminderScheduler.js."))
    parts.append(h2("Reminder form fields"))
    parts.append(table(
        ["Field", "Details"],
        [
            ["Reminder title", "Medicine, appointment, check-up, or care task name."],
            ["Reminder time", "Datetime-local input for simple non-custom schedules."],
            ["Reminder channel", "Dropdown with WhatsApp and Email; users do not type channel names."],
            ["Repeat", "Does not repeat, daily, weekly, monthly, annually, weekdays, or custom date range."],
            ["Custom schedule", "Start date, end date, reminder time, every N days/weeks/months, and weekday selection for weekly schedules."],
            ["Details", "Dose, location, doctor name, fasting instruction, or other note."]
        ],
        [2500, 6860]
    ))
    parts.append(h2("Scheduler behavior"))
    for item in [
        "GET /api/reminders processes due reminders before returning active reminders.",
        "POST /api/reminders validates input and schedules future reminders immediately.",
        "PATCH /api/reminders/[id] cancels active reminders.",
        "Expired non-recurring reminders are sent and removed from active display.",
        "Recurring reminders are rescheduled to the next valid date.",
        "Custom reminders stop after the selected end date.",
        "Due reminders email the signed-in user address through Resend when Resend is correctly configured."
    ]:
        parts.append(bullet(item))

    parts.append(h1("10. Health Education Search"))
    parts.append(paragraph("The /search page was changed from a record-search and quick-search area into a medical education question tool. The user asks any general health education question and the app calls /api/health-education, which uses qwen/qwen3-32b through Groq."))
    parts.append(h2("Answer sections"))
    for item in [
        "Summary: direct patient-friendly answer.",
        "Key points: concise explanation bullets.",
        "General self-care: safe supportive ideas.",
        "Ask a doctor: suggested clinician questions or triggers for booking care.",
        "Urgent warning signs: red flags for emergency or urgent care.",
        "Disclaimer: the result is general education, not a diagnosis."
    ]:
        parts.append(bullet(item))
    parts.append(paragraph("The UI no longer displays Answered with qwen/qwen3-32b. The loading state says Searching, and the submit button says Ask. Dark-mode contrast was fixed by using explicit dark text on light answer cards and example chips."))

    parts.append(page_break())
    parts.append(h1("11. Analyser"))
    parts.append(paragraph("The analyser page at /image-upload allows a patient to upload a report, PDF, document, JPEG, or X-ray image, add a query, and receive a cautious explanation. The component is components/AnalyserForm.jsx, and the server route is app/api/analyser/route.js."))
    parts.append(h2("Analyser output"))
    for item in [
        "Summary of the uploaded content.",
        "Answer to the user's query.",
        "Key findings from the document or image.",
        "Possible concerns, clearly framed as non-final.",
        "Recommended next steps.",
        "Red flags.",
        "Limitations of the analysis.",
        "Doctor confirmation note.",
        "Downloadable analyser report."
    ]:
        parts.append(bullet(item))
    parts.append(callout("Image limitation", "Image analysis is supportive. The app should describe visible findings and limitations, but it should not claim certainty from an image alone.", "warn"))

    parts.append(h1("12. Diet Planner"))
    parts.append(paragraph("The diet planner at /diet is intentionally downstream from diagnosis. It requires a signed-in user, reads the latest intake and diagnosis session, builds or retrieves a patient report, and generates supportive diet guidance. If no diagnosis session exists, it tells the user to complete diagnosis and open the patient report first."))
    parts.append(h2("Diet plan structure"))
    for item in [
        "Meal cards for Breakfast, Lunch, Evening, and Hydration.",
        "Personal diet summary generated from latest completed diagnosis and patient report.",
        "Avoid or limit list.",
        "Diet caution covering high-risk groups and clinical constraints.",
        "Fallback warning if the model call fails and stable local guidance is generated."
    ]:
        parts.append(bullet(item))

    parts.append(h1("13. Emergency Screen"))
    parts.append(paragraph("The emergency page is a direct red warning screen for urgent symptoms. It intentionally bypasses the normal diagnosis flow and tells the user to call emergency services or ask someone nearby for help. The page includes a tel:112 link and short instructions for what to do while help is coming."))
    parts.append(h2("Emergency message"))
    for item in [
        "These symptoms may need urgent medical help now.",
        "Call 112 emergency services.",
        "Do not wait for the normal diagnosis flow.",
        "Sit upright if breathing is difficult.",
        "Keep the phone nearby.",
        "Share symptoms and timing with the helper or responder."
    ]:
        parts.append(bullet(item))

    parts.append(h1("14. Profile and Language"))
    parts.append(paragraph("The profile page lets a signed-in patient view and update account-facing information. It shows the signed-in name, email, initials avatar, contact form, account controls, logout button, and language controls."))
    parts.append(h2("Profile responsibilities"))
    for item in [
        "Display signed-in account details.",
        "Update name, email, or phone through ProfileContactForm.",
        "Switch preferred language with ProfileLanguageButtons.",
        "Log out from profile only using ProfileLogoutButton.",
        "Keep theme toggle available through AppShell top actions."
    ]:
        parts.append(bullet(item))

    parts.append(h1("15. Database and Data Model"))
    parts.append(paragraph("The local SQLite store in lib/auth/sqliteStore.js is the persistence center for users, sessions, patient intakes, diagnosis sessions, medication reminders, OTPs, and reset flows. The database viewer at /database reads a snapshot and displays tables and views for development verification."))
    parts.append(h2("Primary data tables"))
    parts.append(table(
        ["Table / view", "Purpose"],
        [
            ["users", "Stores account identity, auth provider, email verification, Google subject, avatar, phone, timestamps."],
            ["sessions", "Stores hashed session tokens, expiry, revocation status, and user association."],
            ["patient_intakes", "Stores age, gender, height, weight, allergies, main concern, timestamps."],
            ["diagnosis_sessions", "Stores patient name/email, pre-consultation text, transcript JSON, diagnosis JSON, formatted summary, creation date."],
            ["medication_reminders", "Stores title, scheduled time, channel, status, repeat rule, custom schedule metadata, details, email sent/error state."],
            ["login_info", "View exposing safe login/account information."]
        ],
        [2600, 6760]
    ))
    parts.append(h2("Database migration pattern"))
    parts.append(paragraph("The database initializer creates tables if missing and uses addColumnIfMissing for reminder-related fields such as repeat_rule, details, schedule_start_date, schedule_end_date, custom_interval, custom_unit, and custom_weekdays_json. This lets existing local databases migrate without manual reset."))

    parts.append(page_break())
    parts.append(h1("16. API Surface"))
    parts.append(paragraph("The app's API routes are colocated under app/api. They use Next.js route handlers with nodejs runtime where required. The backend responsibilities include auth, patient intake, diagnosis session control, AI chat, image/report analysis, translation/transcription, reminders, profile, search, and outbound email."))
    parts.append(table(
        ["Category", "Routes"],
        [
            ["Auth", "/api/auth/signup, /api/auth/login, /api/auth/logout, /api/auth/me, /api/auth/verify-otp, /api/auth/resend-otp, /api/auth/forgot-password, /api/auth/reset-password, /api/auth/google, /api/auth/google/callback"],
            ["Diagnosis", "/api/diagnosis/session creates the session token; /api/diagnosis/chat calls Qwen and saves completed diagnosis sessions."],
            ["Patient data", "/api/patient-intake saves or updates patient context; /api/profile updates user profile fields."],
            ["Education and search", "/api/health-education answers health questions; /api/search still exists for app/page/patient lookup support."],
            ["Reports and history", "/api/reports/mail sends patient report; /api/history/mail mails latest history summary."],
            ["Reminders", "/api/reminders lists and creates reminders; /api/reminders/[id] cancels active reminders."],
            ["Media and language", "/api/analyser handles uploads; /api/transcribe transcribes audio; /api/translate translates interface text."]
        ],
        [2300, 7060]
    ))

    parts.append(h1("17. AI Model Usage"))
    parts.append(paragraph("The site uses Qwen through Groq's OpenAI-compatible chat completions endpoint. The same broad model family powers diagnosis chat, diet planning, patient report generation, analyser responses, translations, and health education answers. Model calls are wrapped with JSON output contracts and fallback behavior where appropriate."))
    parts.append(h2("Model usage by feature"))
    parts.append(table(
        ["Feature", "Model role", "Fallback behavior"],
        [
            ["Diagnosis chat", "Ask follow-up questions and return structured diagnosis JSON.", "Fallback follow-up or cautious final diagnosis when parsing fails."],
            ["Health education", "Answer general medical education questions as structured JSON.", "If JSON parsing fails, the raw content becomes the summary."],
            ["Diet planner", "Generate supportive diet guidance after report context exists.", "Stable fallback meal guidance is generated from saved diagnosis data."],
            ["Patient report", "Build doctor-ready report from diagnosis history and intake.", "Fallback report uses saved diagnosis fields and cautious defaults."],
            ["Analyser", "Interpret uploaded documents/images and answer user query.", "Returns model error if the configured API call fails."],
            ["Translation", "Translate requested UI strings.", "Returns empty translation object if not configured or no inputs."]
        ],
        [2200, 3900, 3260]
    ))
    parts.append(callout("Model safety", "Prompts repeatedly instruct the model to avoid hidden chain-of-thought, avoid certainty, avoid replacing a clinician, and return structured JSON only where the API expects structured data.", "warn"))

    parts.append(h1("18. Email and Notifications"))
    parts.append(paragraph("Resend is used for multiple email paths: OTP email, medication reminder email, patient report email, and history summary email. The final code sends user-related emails to the signed-in user's email unless a specific recipient input is part of the workflow, such as report email."))
    parts.append(h2("Important Resend behavior"))
    for item in [
        "RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.",
        "In Resend test mode, delivery may be restricted to verified recipient addresses.",
        "A verified sender domain is required for reliable mail to arbitrary patient emails.",
        "Hardcoded override recipients were removed from reminder and history flows.",
        "If email fails, the UI or reminder status should surface the failure instead of claiming success."
    ]:
        parts.append(bullet(item))

    parts.append(h1("19. Theme, Styling, and Responsiveness"))
    parts.append(paragraph("The site uses Tailwind utility classes, CSS variables, and theme overrides in app/globals.css. The ThemeToggle component stores the selected theme in localStorage and sets html[data-theme]."))
    parts.append(h2("Visual system"))
    for item in [
        "Primary palette: deep clinical teal, mint green, white, muted text gray, and emergency red.",
        "AppShell controls desktop sidebar, mobile topbar, mobile nav rail, content frame, and profile/theme actions.",
        "Dark mode overrides text, borders, surfaces, topbar, and controls.",
        "Some light result panels intentionally keep white or pale green backgrounds and explicit dark text for readability in dark mode.",
        "Cards use rounded corners, soft shadows, and clear spacing.",
        "The project avoids TypeScript and uses JavaScript JSX components."
    ]:
        parts.append(bullet(item))
    parts.append(h2("Recent visual fixes"))
    for item in [
        "Session about column removed.",
        "Profile and diagnosis removed from sidebar.",
        "Report header made lighter and greener.",
        "Report source card removed.",
        "Search health education result fixed for dark mode.",
        "Diagnosis card title size reduced and summary text increased.",
        "History template order replaced with disclaimer.",
        "Generated build folders separated to prevent dev crashes."
    ]:
        parts.append(bullet(item))

    parts.append(page_break())
    parts.append(h1("20. Runtime Stability and Build Configuration"))
    parts.append(paragraph("The website previously crashed because next dev and next build both wrote into .next. While the dev server was running, production builds replaced chunks that the dev server still referenced. The server then reported errors such as Cannot find module './1331.js'."))
    parts.append(h2("Fix applied"))
    for item in [
        "next.config.mjs now uses .next-dev for the development server.",
        "next.config.mjs uses .next-build for production builds.",
        "package.json clean script removes .next, .next-dev, and .next-build.",
        "eslint.config.mjs ignores .next-dev and .next-build so lint does not scan generated webpack files.",
        "Build was tested while the dev server was active, and /search continued to return 200."
    ]:
        parts.append(bullet(item))
    parts.append(callout("Operational rule", "Do not manually delete the dev output folder while the dev server is running. If the app behaves stale, restart npm run dev cleanly instead.", "warn"))

    parts.append(h1("21. Environment and Configuration"))
    parts.append(paragraph("The application relies on environment variables for database path, email delivery, OAuth, and AI providers. Documentation should name variables but never include secret values."))
    parts.append(table(
        ["Variable", "Purpose"],
        [
            ["KAMAL_DB_PATH", "Path to local SQLite database file."],
            ["GROQ_API_KEY", "API key for Groq OpenAI-compatible Qwen model calls."],
            ["RESEND_API_KEY", "API key for Resend email delivery."],
            ["RESEND_FROM_EMAIL", "Verified sender address for Resend."],
            ["GOOGLE_CLIENT_ID", "Google OAuth client ID."],
            ["GOOGLE_CLIENT_SECRET", "Google OAuth client secret."],
            ["GOOGLE_REDIRECT_URI", "OAuth callback redirect URI where applicable."]
        ],
        [2700, 6660]
    ))

    parts.append(h1("22. Contributor and Maintenance Notes"))
    parts.append(h2("Coding expectations"))
    for item in [
        "Use Next.js, React, and Tailwind only; do not reintroduce TypeScript.",
        "Keep UI changes consistent with the existing clinical/mint-green design language.",
        "Use existing helpers in lib/auth/sqliteStore.js, lib/patientReport.js, lib/dietPlan.js, and lib/reminderScheduler.js instead of duplicating logic.",
        "Run npm run lint after code edits.",
        "Run npm run build after server-side, routing, API, or configuration changes.",
        "Use a fresh dev server restart when Next config or build output behavior changes.",
        "Do not hardcode patient email recipients for reminders or history mail."
    ]:
        parts.append(bullet(item))
    parts.append(h2("Potential future improvements"))
    for item in [
        "Add automated tests for reminder custom recurrence calculations.",
        "Add database seed fixtures for demo diagnosis, reminder, and report states.",
        "Add stronger server-side validation for all model response schemas.",
        "Add a first-class report/history PDF export path.",
        "Add admin-only protection for the database viewer.",
        "Add accessibility checks for every dark-mode fixed-light panel.",
        "Add retry handling and visible delivery status for Resend failures.",
        "Add browser-based visual regression snapshots for core pages."
    ]:
        parts.append(bullet(item))

    parts.append(h1("23. End-to-End User Journey"))
    journey = [
        "A visitor opens the landing page and sees the KAMAL mental health support hero.",
        "The visitor signs up or logs in with email/OTP or Google OAuth.",
        "The patient opens Session and enters age, gender, height, weight, allergies, and main concern.",
        "The patient starts diagnosis, which creates a diagnosis-session token.",
        "Doctor AI asks one focused follow-up at a time.",
        "The patient answers by typing, voice, quick answer chips, or image attachment.",
        "If an image is attached, the analyser summarizes image context for the diagnosis flow.",
        "When enough information is available, the model completes the diagnosis.",
        "The diagnosis is saved to history with transcript, red flags, self-care, and next steps.",
        "The patient can open History, expand diagnosis cards, download the summary, or mail the latest diagnosis.",
        "The patient can open Report to generate a doctor-ready handoff and email/download it.",
        "The patient can set medication reminders with simple or custom schedules.",
        "The patient can ask general medical education questions in Search.",
        "The patient can open Diet after diagnosis to get supportive meal guidance.",
        "If urgent signs appear, the emergency page directs the patient to call 112."
    ]
    for step in journey:
        parts.append(number(step))

    parts.append(h1("24. Safety, Privacy, and Medical Scope"))
    parts.append(paragraph("KAMAL is best understood as a health conversation and preparation assistant, not a clinical authority. It helps structure information, education, reminders, reports, and care context. The UI and API prompts repeatedly reinforce that AI outputs need qualified medical review."))
    parts.append(h2("Safety principles"))
    for item in [
        "Use emergency escalation for severe, sudden, worsening, or red-flag symptoms.",
        "Avoid final certainty in diagnosis or image interpretation.",
        "Keep doctor confirmation notes visible in diagnosis, analyser, report, history, and education flows.",
        "Avoid prescribing restricted medication.",
        "Protect patient email and medical data from accidental hardcoding or wrong-recipient mail.",
        "Do not expose local secrets or provider API keys."
    ]:
        parts.append(bullet(item))
    parts.append(callout("Final disclaimer", "This website documentation describes product behavior and technical design. It is not medical advice. KAMAL outputs should be reviewed by a qualified doctor before treatment decisions.", "risk"))

    return "".join(parts)


def styles_xml():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="52"/><w:color w:val="103C38"/></w:rPr><w:pPr><w:spacing w:before="0" w:after="160"/><w:jc w:val="center"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="28"/><w:color w:val="324C4A"/></w:rPr><w:pPr><w:spacing w:after="220"/><w:jc w:val="center"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2E74B5"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="200"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="2E74B5"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1F4D78"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/></w:pPr></w:style>
</w:styles>"""


def numbering_xml():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
  <w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>"""


def document_xml():
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" mc:Ignorable="w14 w15 wp14">
  <w:body>{content()}{section_properties()}</w:body>
</w:document>"""


def content_types():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""


def rels():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""


def document_rels():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>"""


def core_xml():
    now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>KAMAL Health Assistant Complete Website Documentation</dc:title>
  <dc:subject>Website documentation, architecture, product manual</dc:subject>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>"""


def app_xml():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex OOXML Builder</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
</Properties>"""


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types())
        z.writestr("_rels/.rels", rels())
        z.writestr("word/_rels/document.xml.rels", document_rels())
        z.writestr("word/document.xml", document_xml())
        z.writestr("word/styles.xml", styles_xml())
        z.writestr("word/numbering.xml", numbering_xml())
        z.writestr("docProps/core.xml", core_xml())
        z.writestr("docProps/app.xml", app_xml())
    print(OUT)


if __name__ == "__main__":
    main()
