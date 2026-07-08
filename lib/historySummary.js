function intakeLine(intake) {
    if (!intake) {
        return "No saved patient context is available yet.";
    }
    return [
        `Age: ${intake.age} years`,
        `Gender: ${intake.gender}`,
        `Height: ${intake.heightCm} cm`,
        `Weight: ${intake.weightKg} kg`,
        `Allergies: ${intake.allergies || "None reported"}`,
        `Main concern: ${intake.mainConcern || "Not stated"}`
    ].join("\n");
}

function diagnosisSessionText(diagnosisSessions) {
    if (!diagnosisSessions?.length) {
        return "No completed diagnosis sessions saved yet.";
    }
    return diagnosisSessions
        .map((session, index) => `Diagnosis Session ${diagnosisDisplayNumber(session, index)}\nSaved at: ${session.createdAt}\n\n${session.formattedSummary}`)
        .join("\n\n===\n\n");
}

function diagnosisDisplayNumber(session, index) {
    const number = Number.parseInt(session?.diagnosis?.displayNumber, 10);
    return Number.isInteger(number) && number > 0 ? number : index + 1;
}

export function buildHistorySummary({ patientName, patientEmail, intake, diagnosisSessions = [] }) {
    return {
        title: `KAMAL History Summary - ${patientName}`,
        text: [
            `Patient Name\n${patientName}`,
            `Patient Email\n${patientEmail || "Not available"}`,
            `Pre Text\n${intakeLine(intake)}`,
            `Saved Diagnoses\n${diagnosisSessionText(diagnosisSessions)}`
        ].join("\n\n---\n\n")
    };
}
