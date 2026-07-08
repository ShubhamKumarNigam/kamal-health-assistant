export const patient = {
    id: "patient-demo",
    phoneNumber: "+91 98765 43210",
    email: "patient@example.com",
    preferredLanguage: "hi",
    voiceModeEnabled: true,
    doctorEmail: "doctor@exampleclinic.in",
    notificationChannel: "WhatsApp"
};
export const patientHistory = {
    age: 46,
    sex: "Female",
    chronicConditions: ["Type 2 diabetes", "High blood pressure"],
    medications: ["Metformin 500mg", "Amlodipine 5mg"],
    allergies: ["No known medicine allergy"],
    surgeries: ["None reported"],
    familyHistory: "Father had diabetes."
};
export const dialogueTurns = [
    {
        id: "turn-1",
        role: "assistant",
        sourceLanguage: "hi",
        content: "Namaste. I will ask one question at a time. What problem are you feeling today?"
    },
    {
        id: "turn-2",
        role: "patient",
        sourceLanguage: "hi",
        content: "I have fever and body pain since yesterday evening.",
        extractedClinicalData: "Fever, myalgia, onset yesterday evening"
    },
    {
        id: "turn-3",
        role: "assistant",
        sourceLanguage: "en",
        content: "I understand. How high was your fever when you last checked it?"
    }
];
export const diagnosisResult = {
    likelyConditions: ["Viral fever", "Seasonal flu-like illness"],
    confidenceLevel: "Moderate",
    reasoning: "Your fever, body pain, short duration, and lack of emergency symptoms are most consistent with a viral illness. Your diabetes means fever should be monitored carefully.",
    recommendedNextStep: "Rest, drink fluids, check temperature twice daily, and speak to a doctor within 24-48 hours if fever continues or sugar readings rise.",
    disclaimerText: "This is an AI-assisted assessment, not a final medical diagnosis. A qualified doctor should confirm it."
};
export const reminders = [
    {
        id: "reminder-1",
        type: "Medication",
        title: "Paracetamol 500mg if fever is above 100.4°F",
        schedule: "Today, 8:00 PM",
        channel: "WhatsApp",
        status: "Upcoming"
    },
    {
        id: "reminder-2",
        type: "Medication",
        title: "Metformin 500mg after dinner",
        schedule: "Every evening, 9:00 PM",
        channel: "WhatsApp",
        status: "Taken"
    },
    {
        id: "reminder-3",
        type: "Consultation",
        title: "Consult a doctor if fever continues",
        schedule: "In 2 days",
        channel: "Email",
        status: "Upcoming"
    }
];
export const reportSections = [
    {
        title: "Patient Summary",
        body: "46-year-old female with diabetes and high blood pressure. Current symptoms: fever and body pain since yesterday evening."
    },
    {
        title: "Symptom Timeline",
        body: "Evening onset of fever and body pain. No emergency warning signs reported in this demo session."
    },
    {
        title: "Medication Plan",
        body: "Continue regular chronic-condition medication. Use fever medicine only as directed by a clinician or local health worker."
    },
    {
        title: "Diet Plan",
        body: "Eat light home food such as dal, rice, curd if tolerated, seasonal fruit, and fluids. Avoid very oily food and high-sugar drinks while fever is present."
    }
];
