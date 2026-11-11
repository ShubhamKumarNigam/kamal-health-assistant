import {
  emptyConversation,
  type ConversationState,
  type Language,
  type ExtractedField,
} from "../health-core";
const redFlagPatterns = [
  /chest\s*(pain|pressure).*(breath|breathing)|shortness of breath.*chest/i,
  /sudden.*(weakness|numbness|speech|vision|headache)|face.*droop|cannot speak/i,
  /throat.*(swell|clos)|tongue.*swell|severe allergic/i,
  /suicid|kill myself|end my life|hurt myself/i,
  /overdose|too many (pills|tablets)|extra doses/i,
  /pregnan.*(bleed|severe pain|faint)|heavy bleeding/i,
  /ألم.*صدر|ضيق.*تنفس|انتحار|جرعة زائدة|نزيف.*حمل/,
  /سینے.*درد|سانس.*تکلیف|خودکشی|زیادہ.*گولیاں|حمل.*خون/,
];
export function detectRedFlags(text: string) {
  return redFlagPatterns.some((p) => p.test(text));
}
const urgent = {
  en: "Some of the symptoms you described can require urgent medical assessment. Please seek appropriate medical care now. If you may be in immediate danger, contact local emergency services or ask someone nearby to help. KAMAL cannot contact emergency services.",
  ar: "قد تتطلب الأعراض التي وصفتها تقييماً طبياً عاجلاً. يرجى طلب الرعاية الطبية الآن. إذا كان هناك خطر فوري، اتصل بخدمات الطوارئ المحلية أو اطلب المساعدة من شخص قريب. لا يستطيع كمال الاتصال بالطوارئ.",
  ur: "آپ کی بتائی ہوئی علامات کو فوری طبی معائنے کی ضرورت ہو سکتی ہے۔ براہ کرم ابھی طبی مدد حاصل کریں۔ فوری خطرے میں مقامی ایمرجنسی سروس یا کسی قریبی شخص سے مدد لیں۔ کمال ایمرجنسی سروس سے رابطہ نہیں کر سکتا۔",
};
const questions = {
  en: [
    "How long has this been happening, and did it start suddenly?",
    "How much is it affecting your usual activities?",
    "What would you most like your clinician to help clarify?",
  ],
  ar: [
    "منذ متى يحدث ذلك، وهل بدأ فجأة؟",
    "ما مدى تأثيره على أنشطتك المعتادة؟",
    "ما أهم سؤال ترغب في طرحه على طبيبك؟",
  ],
  ur: [
    "یہ کب سے ہو رہا ہے، اور کیا اچانک شروع ہوا؟",
    "یہ آپ کی روزمرہ سرگرمیوں کو کتنا متاثر کر رہا ہے؟",
    "آپ اپنے ڈاکٹر سے کس بات کی وضاحت چاہتے ہیں؟",
  ],
};
export function respond(
  input: string,
  previous: ConversationState = emptyConversation(),
  lang: Language = "en",
): { text: string; state: ConversationState } {
  const state = structuredClone(previous);
  if (detectRedFlags(input)) {
    state.redFlags.push("Potential urgent concern");
    state.stage = "urgent";
    return { text: urgent[lang], state };
  }
  if (state.stage === "urgent") return { text: urgent[lang], state };
  if (/dose|prescrib|stop.*medic|دواء|خوراک/i.test(input))
    return {
      text:
        lang === "en"
          ? "I cannot prescribe or change medication. Please ask your prescriber or pharmacist and keep the original instructions with your records."
          : lang === "ar"
            ? "لا أستطيع وصف دواء أو تغيير جرعته. يرجى سؤال الطبيب أو الصيدلي."
            : "میں دوا تجویز یا خوراک تبدیل نہیں کر سکتا۔ براہ کرم ڈاکٹر یا فارماسسٹ سے پوچھیں۔",
      state,
    };
  if (!state.chiefConcern) state.chiefConcern = input;
  else if (state.questionCount === 1) state.duration = input;
  else if (state.questionCount === 2) state.severity = input;
  else state.relevantSymptoms.push(input);
  if (state.questionCount < 3) {
    state.stage = "followup";
    const text = questions[lang][state.questionCount];
    state.questionCount++;
    return { text, state };
  }
  state.stage = "summary";
  return {
    state,
    text:
      lang === "en"
        ? `Here is your visit note: “${state.chiefConcern}”. Timing: ${state.duration || "not provided"}. Impact: ${state.severity || "not provided"}. I cannot determine the cause. You can share this account and relevant records with your clinician. This demonstration uses a structured conversation, not a diagnostic AI model.`
        : lang === "ar"
          ? `ملخص لزيارة الطبيب: «${state.chiefConcern}». المدة: ${state.duration}. التأثير: ${state.severity}. لا أستطيع تحديد السبب. يمكنك مشاركة هذا الملخص مع طبيبك. هذه محادثة تجريبية منظمة وليست تشخيصاً.`
          : `ڈاکٹر کے لیے خلاصہ: «${state.chiefConcern}»۔ مدت: ${state.duration}۔ اثر: ${state.severity}۔ میں وجہ کا تعین نہیں کر سکتا۔ یہ خلاصہ ڈاکٹر کے ساتھ شیئر کریں۔ یہ ایک منظم نمائشی گفتگو ہے، تشخیص نہیں۔`,
  };
}
export function extract(text: string, source: string): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const patterns: [string, RegExp][] = [
    ["Document date", /\b(20\d{2}[-/]\d{2}[-/]\d{2})\b/],
    [
      "Vitamin D",
      /vitamin\s*d\s*[:\-]?\s*(\d+(?:\.\d+)?\s*(?:ng\/mL|nmol\/L))/i,
    ],
    ["Haemoglobin", /(?:ha?emoglobin|hgb)\s*[:\-]?\s*(\d+(?:\.\d+)?\s*g\/dL)/i],
    ["Glucose", /glucose\s*[:\-]?\s*(\d+(?:\.\d+)?\s*(?:mg\/dL|mmol\/L))/i],
    [
      "Organisation",
      /(?:organisation|organization|institution|clinic)\s*:\s*([^\n]+)/i,
    ],
    ["Doctor", /(?:doctor|physician)\s*:\s*([^\n]+)/i],
    ["Medication", /medication\s*:\s*([^\n]+)/i],
    ["Allergy", /allerg(?:y|ies)\s*:\s*([^\n]+)/i],
    ["Explicit diagnosis", /diagnosis\s*:\s*([^\n]+)/i],
    ["Follow-up", /follow[- ]?up\s*:\s*([^\n]+)/i],
  ];
  for (const [label, p] of patterns) {
    const m = text.match(p);
    if (m)
      fields.push({
        label,
        value: m[1].trim(),
        source: `${source}: “${m[0].trim()}”`,
        confidence: 0.65,
        verification: "unverified",
      });
  }
  return fields;
}
