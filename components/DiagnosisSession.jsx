"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardCheck, ImagePlus, Loader2, Mic, Send, ShieldAlert, Square, Stethoscope, UserRound, X } from "lucide-react";

function messageLabel(role) {
    return role === "assistant" ? "Doctor AI" : "You";
}

function quickAnswersForQuestion(question) {
    const text = String(question || "").toLowerCase();
    if (!text || !text.includes("?")) {
        return [];
    }
    if (/\b(1\s*[-–]\s*10|one\s*to\s*ten|scale|severity|severe|intensity)\b/.test(text) || /\b(pain|दर्द)\b/.test(text) && /\b(how much|rate|level|कितना)\b/.test(text)) {
        return ["1/10 mild", "3/10", "5/10 moderate", "7/10 severe", "9/10 very severe"];
    }
    if (/\b(how long|how many days|since when|when did|duration|from how much time|कब से|कितने समय)\b/.test(text)) {
        return ["1 day", "3 days", "1 week", "2 weeks", "1 month", "1 year"];
    }
    if (/\b(temperature|fever|high fever|temp|बुखार|तापमान)\b/.test(text)) {
        return ["99°F", "100°F", "101°F", "102°F", "103°F+"];
    }
    if (/\b(medicine|medication|tablet|dose|taken anything|दवा|गोली)\b/.test(text)) {
        return ["No medicine yet", "Paracetamol taken", "Doctor prescribed medicine", "Not sure"];
    }
    if (/^(do|does|did|are|is|was|were|have|has|can|could)\b/.test(text) || /\b(any|किसी|क्या)\b/.test(text)) {
        return ["Yes", "No", "Not sure"];
    }
    return [];
}

function DiagnosisPanel({ diagnosis }) {
    if (!diagnosis) {
        return null;
    }
    const likelyConditions = Array.isArray(diagnosis.likelyConditions) ? diagnosis.likelyConditions : [];
    const nextSteps = Array.isArray(diagnosis.recommendedNextSteps) ? diagnosis.recommendedNextSteps : [];
    const redFlags = Array.isArray(diagnosis.redFlags) ? diagnosis.redFlags : [];
    return (<div className="mt-5 rounded-2xl border border-[#ADF8EF]/30 bg-white/95 p-5 text-[#10231f]">
      <div className="flex items-center gap-2 text-lg font-extrabold">
        <ClipboardCheck aria-hidden="true" className="h-5 w-5 text-[#19C37D]"/>
        <h3>Diagnosis saved to history</h3>
      </div>
      <dl className="mt-4 grid gap-4">
        <div>
          <dt className="text-xs font-extrabold uppercase tracking-normal text-[#324C4A]">Final disease or condition</dt>
          <dd className="mt-1 text-xl font-extrabold">{diagnosis.primaryDisease || likelyConditions[0] || "Not specified"}</dd>
        </div>
        <div>
          <dt className="text-xs font-extrabold uppercase tracking-normal text-[#324C4A]">Likely conditions</dt>
          <dd className="mt-1 font-bold">{likelyConditions.length ? likelyConditions.join(", ") : "Not specified"}</dd>
        </div>
        <div>
          <dt className="text-xs font-extrabold uppercase tracking-normal text-[#324C4A]">Confidence</dt>
          <dd className="mt-1 font-bold">{diagnosis.confidenceLevel || "Not specified"}</dd>
        </div>
        <div>
          <dt className="text-xs font-extrabold uppercase tracking-normal text-[#324C4A]">Reasoning</dt>
          <dd className="mt-1 leading-7">{diagnosis.reasoning || "Not specified"}</dd>
        </div>
      </dl>
      {nextSteps.length ? (<div className="mt-4">
          <p className="text-xs font-extrabold uppercase tracking-normal text-[#324C4A]">Next steps</p>
          <ul className="mt-2 grid gap-2">
            {nextSteps.map((step) => (<li className="rounded-lg bg-[#DAF8EF] px-3 py-2 font-semibold" key={step}>{step}</li>))}
          </ul>
        </div>) : null}
      {redFlags.length ? (<div className="mt-4">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-normal text-emergency">
            <ShieldAlert aria-hidden="true" className="h-4 w-4"/>
            Urgent warning signs
          </p>
          <ul className="mt-2 grid gap-2">
            {redFlags.map((flag) => (<li className="rounded-lg bg-red-50 px-3 py-2 font-semibold text-emergency" key={flag}>{flag}</li>))}
          </ul>
        </div>) : null}
      <Link className="mt-5 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#324C4A] px-5 py-3 font-extrabold text-white transition hover:bg-black" href="/onboarding/history">
        View history
      </Link>
    </div>);
}

function listText(title, items) {
    if (!Array.isArray(items) || !items.length) {
        return `${title}: Not specified`;
    }
    return `${title}:\n- ${items.join("\n- ")}`;
}

function buildImageAnalysisContext(analysis) {
    if (!analysis) {
        return "";
    }
    return [
        "Image analysis from vision model:",
        `Summary: ${analysis.summary || "Not specified"}`,
        `Answer: ${analysis.answer || "Not specified"}`,
        listText("Findings", analysis.findings),
        listText("Possible concerns", analysis.possibleConcerns),
        listText("Recommended next steps", analysis.recommendedNextSteps),
        listText("Red flags", analysis.redFlags),
        listText("Limitations", analysis.limitations),
        `Doctor note: ${analysis.doctorNote || "A clinician should confirm this image interpretation."}`,
        `Caution: ${analysis.caution || "This is AI-assisted image analysis, not a final diagnosis."}`
    ].join("\n");
}

export function DiagnosisSession({ user, intake }) {
    const preConsultationMessage = useMemo(() => ({
        role: "user",
        content: intake.mainConcern
    }), [intake.mainConcern]);
    const [messages, setMessages] = useState([preConsultationMessage]);
    const [reply, setReply] = useState("");
    const [attachment, setAttachment] = useState(null);
    const [status, setStatus] = useState("ready");
    const [voiceStatus, setVoiceStatus] = useState("idle");
    const [error, setError] = useState("");
    const [diagnosis, setDiagnosis] = useState(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioStreamRef = useRef(null);
    const isLoading = status === "loading";
    const isRecording = voiceStatus === "recording";
    const isTranscribing = voiceStatus === "transcribing";
    const isComplete = status === "complete";
    const hasStarted = messages.some((message) => message.role === "assistant");
    const latestAssistantQuestion = useMemo(() => [...messages].reverse().find((message) => message.role === "assistant")?.content || "", [messages]);
    const quickAnswers = useMemo(() => quickAnswersForQuestion(latestAssistantQuestion), [latestAssistantQuestion]);
    const cautionText = diagnosis?.caution || "Caution: This is AI-assisted health guidance, not a final medical diagnosis. Seek urgent medical care for severe, sudden, worsening, or emergency symptoms.";

    async function analyseImageForSession(file, patientReply) {
        const payload = new FormData();
        payload.set("query", [
            "Analyze this uploaded image for the current doctor-style diagnosis session.",
            "Describe only clinically relevant visible findings and limitations.",
            "Do not diagnose with certainty.",
            patientReply ? `Patient reply/context: ${patientReply}` : "The patient attached this image without extra text."
        ].join("\n"));
        payload.set("file", file);

        const response = await fetch("/api/analyser", {
            method: "POST",
            body: payload
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
            throw new Error(result.message || "Image analysis failed.");
        }
        return result.analysis;
    }

    async function askDoctor(nextMessages) {
        setStatus("loading");
        setError("");
        const response = await fetch("/api/diagnosis/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: nextMessages.map((message) => ({
                    role: message.role,
                    content: message.modelContent || message.content
                }))
            })
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
            throw new Error(result.message || "Diagnosis could not continue.");
        }
        const assistantMessage = {
            role: "assistant",
            content: result.message.content
        };
        setMessages([...nextMessages, assistantMessage]);
        if (result.status === "complete") {
            setDiagnosis(result.diagnosis);
            setStatus("complete");
            return;
        }
        setStatus("ready");
        requestAnimationFrame(() => inputRef.current?.focus());
    }

    async function startDiagnosis() {
        try {
            await askDoctor([preConsultationMessage]);
        }
        catch (caughtError) {
            setStatus("ready");
            setError(caughtError instanceof Error ? caughtError.message : "Diagnosis could not start.");
        }
    }

    async function submitReply(event) {
        event.preventDefault();
        const content = reply.trim();
        if ((!content && !attachment) || isLoading || isComplete) {
            return;
        }
        setStatus("loading");
        setError("");
        let imageAnalysis = null;
        let imageAnalysisContext = "";
        try {
            if (attachment?.file) {
                imageAnalysis = await analyseImageForSession(attachment.file, content);
                imageAnalysisContext = buildImageAnalysisContext(imageAnalysis);
            }
        }
        catch (caughtError) {
            setStatus("ready");
            setError(caughtError instanceof Error ? caughtError.message : "Image could not be analysed.");
            return;
        }
        const nextMessages = [...messages, {
            role: "user",
            content: content || "Image attached for this follow-up.",
            modelContent: imageAnalysisContext
                ? [
                    `Patient reply: ${content || "No typed reply; image was attached for this follow-up."}`,
                    "",
                    imageAnalysisContext,
                    "",
                    "Use the image analysis as patient-provided context for the next diagnosis follow-up. Do not claim certainty from the image alone."
                ].join("\n")
                : content,
            attachmentName: attachment?.name || "",
            attachmentUrl: attachment?.url || "",
            imageAnalysisSummary: imageAnalysis?.summary || ""
        }];
        setMessages(nextMessages);
        setReply("");
        setAttachment(null);
        try {
            await askDoctor(nextMessages);
        }
        catch (caughtError) {
            setStatus("ready");
            setError(caughtError instanceof Error ? caughtError.message : "Diagnosis could not continue.");
        }
    }

    function chooseAttachment(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            setError("Please choose an image file.");
            event.target.value = "";
            return;
        }
        if (attachment?.url) {
            URL.revokeObjectURL(attachment.url);
        }
        setAttachment({
            file,
            name: file.name,
            url: URL.createObjectURL(file)
        });
        event.target.value = "";
    }

    function clearAttachment() {
        if (attachment?.url) {
            URL.revokeObjectURL(attachment.url);
        }
        setAttachment(null);
    }

    async function transcribeAudio(audioBlob) {
        setVoiceStatus("transcribing");
        const payload = new FormData();
        payload.set("audio", new File([audioBlob], "voice-message.webm", {
            type: audioBlob.type || "audio/webm"
        }));
        const response = await fetch("/api/transcribe", {
            method: "POST",
            body: payload
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
            throw new Error(result.message || "Voice transcription failed.");
        }
        if (result.text) {
            setReply((current) => [current.trim(), result.text].filter(Boolean).join(" "));
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }

    async function startVoiceRecording() {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            setError("Voice recording is not supported in this browser.");
            return;
        }
        setError("");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioStreamRef.current = stream;
        audioChunksRef.current = [];
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };
        recorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
            audioChunksRef.current = [];
            audioStreamRef.current?.getTracks().forEach((track) => track.stop());
            audioStreamRef.current = null;
            try {
                await transcribeAudio(audioBlob);
                setVoiceStatus("idle");
            }
            catch (caughtError) {
                setVoiceStatus("idle");
                setError(caughtError instanceof Error ? caughtError.message : "Voice transcription failed.");
            }
        };
        recorder.start();
        setVoiceStatus("recording");
    }

    function stopVoiceRecording() {
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
    }

    async function toggleVoiceRecording() {
        if (isRecording) {
            stopVoiceRecording();
            return;
        }
        try {
            await startVoiceRecording();
        }
        catch (caughtError) {
            setVoiceStatus("idle");
            audioStreamRef.current?.getTracks().forEach((track) => track.stop());
            audioStreamRef.current = null;
            setError(caughtError instanceof Error ? caughtError.message : "Microphone access failed.");
        }
    }

    function useQuickAnswer(answer) {
        setReply((current) => current.trim() ? `${current.trim()} ${answer}` : answer);
        requestAnimationFrame(() => inputRef.current?.focus());
    }

    return (<div className="overflow-hidden rounded-3xl border border-[#ADF8EF]/20 bg-[#324C4A] shadow-[0_28px_80px_rgba(0,0,0,0.18)]">
      <section className="flex min-h-[680px] flex-col bg-[#324C4A] p-5 md:p-8">
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#ADF8EF]/18 bg-white/10 p-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xl font-extrabold text-white">
              <Stethoscope aria-hidden="true" className="h-5 w-5 text-[#ADF8EF]"/>
              <h2>Multilingual doctor session</h2>
            </div>
            <p className="mt-2 font-medium leading-7 text-[#ADF8EF]">
              The model asks one focused follow-up at a time, keeps to the health concern, and saves the completed diagnosis to history.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg bg-[#ADF8EF] px-3 py-2 text-sm font-extrabold text-[#10231f] shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
            <UserRound aria-hidden="true" className="h-4 w-4"/>
            {user.name}
          </span>
        </div>

        <div className="flex-1 space-y-5">
          {messages.map((message, index) => (<article className={`max-w-3xl rounded-2xl p-5 shadow-[0_16px_36px_rgba(0,0,0,0.14)] ${message.role === "assistant"
              ? "mr-auto border-l-4 border-l-[#19C37D] bg-[#DAF8EF] text-[#324C4A]"
              : "ml-auto bg-[#DFF4FF] text-[#324C4A]"}`} key={`${message.role}-${index}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold">{messageLabel(message.role)}</p>
                <span className="text-xs font-bold opacity-70">{index === 0 ? "Starting concern" : "Turn " + index}</span>
              </div>
              <p className="whitespace-pre-wrap font-medium leading-7">{message.content}</p>
              {message.attachmentUrl ? (<div className="mt-4 overflow-hidden rounded-xl border border-[#324C4A]/15 bg-white/60">
                  <img alt={message.attachmentName || "Attached image"} className="max-h-64 w-full object-contain" src={message.attachmentUrl}/>
                  <p className="border-t border-[#324C4A]/10 px-3 py-2 text-xs font-bold opacity-70">
                    {message.attachmentName}
                  </p>
                </div>) : null}
              {message.imageAnalysisSummary ? (<div className="mt-3 rounded-xl border border-[#324C4A]/15 bg-white/60 px-3 py-2 text-sm font-semibold leading-6">
                  Vision analysis sent to Doctor AI: {message.imageAnalysisSummary}
                </div>) : null}
            </article>))}
          {isLoading ? (<article className="mr-auto max-w-3xl rounded-2xl border-l-4 border-l-[#19C37D] bg-[#DAF8EF] p-5 text-[#324C4A] shadow-[0_16px_36px_rgba(0,0,0,0.14)]">
              <p className="flex items-center gap-2 font-extrabold">
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>
                Doctor AI is reviewing your answer and any attached image analysis...
              </p>
            </article>) : null}
          <DiagnosisPanel diagnosis={diagnosis}/>
        </div>

        {error ? (<p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-emergency">{error}</p>) : null}
        <p className="mt-5 flex gap-2 rounded-xl bg-white/90 px-4 py-3 text-sm font-bold text-[#324C4A]">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning"/>
          <span>{cautionText}</span>
        </p>

        {!hasStarted ? (<button className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#ADF8EF] px-5 py-3 font-extrabold text-[#10231f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70" disabled={isLoading} onClick={startDiagnosis} type="button">
            {isLoading ? (<Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>) : (<Stethoscope aria-hidden="true" className="h-5 w-5"/>)}
            Start doctor follow-up
          </button>) : (<div className="mt-8 grid gap-3">
            <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={submitReply}>
              <label className="block">
                <span className="mb-2 block font-semibold text-white">Reply by typing</span>
                {quickAnswers.length && !isComplete ? (<div className="mb-3 rounded-xl border border-[#ADF8EF]/25 bg-white/10 p-3">
                    <p className="mb-2 text-sm font-extrabold text-[#ADF8EF]">Quick answer</p>
                    <div className="flex flex-wrap gap-2">
                      {quickAnswers.map((answer) => (<button className="rounded-full border border-[#ADF8EF]/35 bg-white px-3 py-2 text-sm font-extrabold text-[#10231f] transition hover:bg-[#ADF8EF] disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoading || isRecording || isTranscribing} key={answer} onClick={() => useQuickAnswer(answer)} type="button">
                        {answer}
                      </button>))}
                    </div>
                  </div>) : null}
                <textarea className="min-h-24 w-full rounded-lg border border-[#ADF8EF]/30 bg-white px-4 py-3 text-[#10231f] placeholder:text-[#5B605D] focus:border-[#ADF8EF] focus:outline-none" disabled={isLoading || isComplete} onChange={(event) => setReply(event.target.value)} placeholder={isComplete ? "Diagnosis is complete and saved." : "Answer the doctor's one follow-up question..."} ref={inputRef} rows={3} value={reply}/>
                {attachment ? (<div className="mt-3 flex items-center gap-3 rounded-lg border border-[#ADF8EF]/30 bg-white/10 p-3 text-white">
                    <img alt="" className="h-14 w-14 rounded-lg object-cover" src={attachment.url}/>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{attachment.name}</p>
                      <p className="text-xs font-semibold text-[#ADF8EF]">Image ready to attach</p>
                    </div>
                    <button aria-label="Remove image" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20" onClick={clearAttachment} type="button">
                      <X aria-hidden="true" className="h-4 w-4"/>
                    </button>
                  </div>) : null}
                {isRecording || isTranscribing ? (<p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-[#ADF8EF]">
                    {isRecording ? "Listening... click stop when finished." : "Transcribing voice with Whisper..."}
                  </p>) : null}
              </label>
              <div className="flex gap-2 md:self-end">
                <input accept="image/*" className="hidden" disabled={isLoading || isComplete} onChange={chooseAttachment} ref={fileInputRef} type="file"/>
                <button aria-label={isRecording ? "Stop recording" : "Record voice"} className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-[#ADF8EF]/30 transition disabled:cursor-not-allowed disabled:opacity-70 ${isRecording ? "bg-red-50 text-emergency" : "bg-white/10 text-[#ADF8EF] hover:bg-white/20"}`} disabled={isLoading || isComplete || isTranscribing} onClick={toggleVoiceRecording} type="button">
                  {isTranscribing ? (<Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>) : isRecording ? (<Square aria-hidden="true" className="h-5 w-5 fill-current"/>) : (<Mic aria-hidden="true" className="h-5 w-5"/>)}
                </button>
                <button aria-label="Attach image" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-[#ADF8EF]/30 bg-white/10 text-[#ADF8EF] transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70" disabled={isLoading || isComplete} onClick={() => fileInputRef.current?.click()} type="button">
                  <ImagePlus aria-hidden="true" className="h-5 w-5"/>
                </button>
                <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#ADF8EF] px-5 py-3 font-extrabold text-[#10231f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70" disabled={isLoading || isComplete || isRecording || isTranscribing || (!reply.trim() && !attachment)} type="submit">
                  {isLoading ? (<Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>) : (<Send aria-hidden="true" className="h-5 w-5"/>)}
                  Send
                </button>
              </div>
            </form>
          </div>)}
      </section>
    </div>);
}
