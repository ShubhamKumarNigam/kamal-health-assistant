import { Resend } from "resend";

function escapeHtml(value) {
    return String(value || "").replace(/[<>&"]/g, (char) => ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "\"": "&quot;"
    })[char]);
}

function otpSubject(purpose) {
    return purpose === "password_reset"
        ? "Your KAMAL password reset code"
        : "Your KAMAL verification code";
}
function otpIntro(purpose) {
    return purpose === "password_reset"
        ? "Use this code to reset your KAMAL password."
        : "Use this code to verify your KAMAL account.";
}
export async function sendOtpEmail({ to, code, purpose }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
        return {
            ok: false,
            status: 503,
            message: "Email OTP is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL."
        };
    }
    const resend = new Resend(apiKey);
    const intro = otpIntro(purpose);
    const subject = otpSubject(purpose);
    const { error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        text: `${intro}\n\nCode: ${code}\n\nThis code expires in 10 minutes.`,
        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h1 style="color: #324C4A;">${subject}</h1>
        <p>${intro}</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #324C4A;">${code}</p>
        <p>This code expires in 10 minutes.</p>
        <p>Hindi: KAMAL code: <strong>${code}</strong></p>
      </div>
    `
    });
    if (error) {
        console.error("Resend OTP email failed", error);
        return {
            ok: false,
            status: 502,
            message: "We could not send the email code. Please try again."
        };
    }
    return { ok: true };
}

function reminderEmailHtml({ name, medicineName, scheduledAt, details }) {
    const formattedTime = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata"
    }).format(new Date(scheduledAt));
    const detailsHtml = details
        ? `<div style="margin-top: 18px; border-radius: 14px; background: #F3F4F6; padding: 14px 16px;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #324C4A;">Details</p>
            <p style="margin: 0; color: #111827; white-space: pre-wrap;">${escapeHtml(details)}</p>
          </div>`
        : "";
    return `
      <div style="margin: 0; padding: 32px 18px; background: #DAF8EF; font-family: Arial, sans-serif; color: #111827;">
        <div style="max-width: 620px; margin: 0 auto; overflow: hidden; border-radius: 22px; background: #ffffff; box-shadow: 0 18px 45px rgba(50, 76, 74, 0.14);">
          <div style="background: #324C4A; padding: 24px 28px; color: #ffffff;">
            <p style="margin: 0; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #ADF8EF;">KAMAL Health Assistant</p>
            <h1 style="margin: 10px 0 0; font-size: 28px; line-height: 1.2;">Reminder due</h1>
          </div>
          <div style="padding: 28px;">
            <p style="margin: 0 0 16px; font-size: 16px;">Hello ${escapeHtml(name)},</p>
            <p style="margin: 0 0 18px; color: #5B605D;">This is your scheduled KAMAL reminder.</p>
            <div style="border: 1px solid rgba(50, 76, 74, 0.16); border-radius: 16px; padding: 18px;">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #324C4A;">Reminder</p>
              <p style="margin: 0; font-size: 24px; font-weight: 800; color: #10231F;">${escapeHtml(medicineName)}</p>
              <p style="margin: 16px 0 0; color: #5B605D;">Scheduled time</p>
              <p style="margin: 4px 0 0; font-size: 18px; font-weight: 800; color: #10231F;">${formattedTime}</p>
            </div>
            ${detailsHtml}
            <div style="margin-top: 20px; border-left: 4px solid #F59E0B; background: #FFF7ED; padding: 12px 14px; border-radius: 12px;">
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #7C2D12;">This reminder is not medical advice. Follow your clinician's instructions for medicines, appointments, and care plans.</p>
            </div>
            <p style="margin: 20px 0 0; color: #5B605D;">Open KAMAL when complete and mark the reminder as taken or done.</p>
          </div>
        </div>
      </div>
    `;
}

function normalizeList(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
        return value
            .split(/\n|,(?=\s*[A-Z])/)
            .map((item) => item.replace(/^[-*\s]+/, "").trim())
            .filter(Boolean);
    }
    return [];
}

function diagnosisListHtml(items, emptyText, itemBackground = "#F3F4F6", itemColor = "#10231F") {
    const list = normalizeList(items);
    if (!list.length) {
        return `<p style="margin: 0; color: #5B605D;">${escapeHtml(emptyText)}</p>`;
    }
    return `<ul style="list-style: none; margin: 0; padding: 0;">
      ${list.map((item) => `<li style="margin: 0 0 10px; border-radius: 12px; background: ${itemBackground}; padding: 12px 14px; color: ${itemColor}; font-weight: 700;">${escapeHtml(item)}</li>`).join("")}
    </ul>`;
}

function emailSection({ title, children, background = "#ffffff" }) {
    return `
      <div style="margin-top: 18px; border: 1px solid rgba(50, 76, 74, 0.16); border-radius: 16px; background: ${background}; padding: 18px;">
        <p style="margin: 0 0 12px; font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #324C4A;">${escapeHtml(title)}</p>
        ${children}
      </div>
    `;
}

function diagnosisEmailHtml({ name, summary, latestSession }) {
    const diagnosis = latestSession?.diagnosis || {};
    const nextSteps = normalizeList(diagnosis.recommendedNextSteps)
        .concat(normalizeList(diagnosis.recommendedNextStep))
        .concat(normalizeList(diagnosis.nextSteps));
    const selfCare = normalizeList(diagnosis.selfCare)
        .concat(normalizeList(diagnosis.selfCareGuidance));
    const redFlags = normalizeList(diagnosis.redFlags)
        .concat(normalizeList(diagnosis.emergencyRedFlags));
    const transcript = Array.isArray(latestSession?.transcript) ? latestSession.transcript : [];
    const savedAt = latestSession?.createdAt
        ? new Intl.DateTimeFormat("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata"
        }).format(new Date(latestSession.createdAt))
        : "Not available";
    const primaryDisease = diagnosis.primaryDisease || normalizeList(diagnosis.likelyConditions)[0] || "Latest diagnosis";
    const patientContext = latestSession?.preConsultationText || summary.text;
    const transcriptHtml = transcript.length
        ? transcript.map((turn) => {
            const speaker = turn.role === "assistant" ? "Doctor AI" : "Patient";
            return `<div style="margin-top: 10px; border-radius: 12px; background: #F9FAFB; padding: 12px 14px;">
              <p style="margin: 0 0 5px; font-size: 12px; font-weight: 800; color: #324C4A;">${speaker}</p>
              <p style="margin: 0; white-space: pre-wrap; color: #111827;">${escapeHtml(turn.content)}</p>
            </div>`;
        }).join("")
        : `<p style="margin: 0; color: #5B605D;">No conversation transcript was saved for this diagnosis.</p>`;

    return `
      <div style="margin: 0; padding: 32px 18px; background: #DAF8EF; font-family: Arial, sans-serif; color: #111827;">
        <div style="max-width: 680px; margin: 0 auto; overflow: hidden; border-radius: 22px; background: #ffffff; box-shadow: 0 18px 45px rgba(50, 76, 74, 0.14);">
          <div style="background: #324C4A; padding: 24px 28px; color: #ffffff;">
            <p style="margin: 0; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #ADF8EF;">KAMAL Health Assistant</p>
            <h1 style="margin: 10px 0 0; font-size: 28px; line-height: 1.2;">Latest diagnosis summary</h1>
          </div>
          <div style="padding: 28px;">
            <p style="margin: 0 0 16px; font-size: 16px;">Hello ${escapeHtml(name)},</p>
            <p style="margin: 0 0 18px; color: #5B605D;">This email includes only your latest saved diagnosis from KAMAL history.</p>
            <div style="border: 1px solid rgba(50, 76, 74, 0.16); border-radius: 16px; padding: 18px;">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #324C4A;">Diagnosis</p>
              <p style="margin: 0; font-size: 24px; font-weight: 800; color: #10231F;">${escapeHtml(primaryDisease)}</p>
              <p style="margin: 16px 0 0; color: #5B605D;">Saved at</p>
              <p style="margin: 4px 0 0; font-size: 18px; font-weight: 800; color: #10231F;">${escapeHtml(savedAt)}</p>
            </div>
            ${emailSection({
                title: "Patient context",
                background: "#F9FAFB",
                children: `<p style="margin: 0; white-space: pre-wrap; color: #111827;">${escapeHtml(patientContext)}</p>`
            })}
            ${diagnosis.reasoning ? emailSection({
                title: "Doctor reasoning",
                children: `<p style="margin: 0; line-height: 1.7; color: #111827;">${escapeHtml(diagnosis.reasoning)}</p>`
            }) : ""}
            ${emailSection({
                title: "Doctor recommendations",
                children: diagnosisListHtml(nextSteps, "No doctor recommendations were saved for this diagnosis.", "#DAF8EF", "#10231F")
            })}
            ${emailSection({
                title: "Self-care guidance",
                children: diagnosisListHtml(selfCare, "No self-care guidance was saved for this diagnosis.", "#F3F4F6", "#10231F")
            })}
            ${emailSection({
                title: "Red flags",
                children: diagnosisListHtml(redFlags, "No urgent red flags were saved for this diagnosis.", "#FEF2F2", "#B91C1C")
            })}
            ${emailSection({
                title: "Conversation transcript",
                background: "#F9FAFB",
                children: transcriptHtml
            })}
            <div style="margin-top: 20px; border-left: 4px solid #F59E0B; background: #FFF7ED; padding: 12px 14px; border-radius: 12px;">
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #7C2D12;">This is AI-assisted health guidance, not a final medical diagnosis. A qualified clinician should confirm important or worsening symptoms.</p>
            </div>
          </div>
        </div>
      </div>
    `;
}

export async function sendMedicationReminderEmail({ to, name, medicineName, scheduledAt, details }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
        return {
            ok: false,
            status: 503,
            message: "Reminder email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL."
        };
    }
    const formattedTime = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata"
    }).format(new Date(scheduledAt));
    const resend = new Resend(apiKey);
    const subject = `KAMAL reminder: ${medicineName}`;
    const detailsText = details ? `\nDetails: ${details}` : "";
    const { error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        text: `KAMAL reminder\n\nHello ${name},\n\nReminder: ${medicineName}\nScheduled time: ${formattedTime}${detailsText}\n\nOpen KAMAL when complete and mark the reminder as taken or done.\n\nThis reminder is not medical advice. Follow your clinician's instructions for medicines, appointments, and care plans.`,
        html: reminderEmailHtml({ name, medicineName, scheduledAt, details })
    });
    if (error) {
        console.error("Resend medication reminder failed", error);
        return {
            ok: false,
            status: 502,
            message: "We could not send the medication reminder email."
        };
    }
    return { ok: true };
}

export async function sendHistorySummaryEmail({ to, name, summary, latestSession }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
        return {
            ok: false,
            status: 503,
            message: "History email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL."
        };
    }
    const resend = new Resend(apiKey);
    const subject = `KAMAL latest diagnosis summary for ${name}`;
    const { error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        text: summary.text,
        html: diagnosisEmailHtml({ name, summary, latestSession })
    });
    if (error) {
        console.error("Resend history summary failed", error);
        return {
            ok: false,
            status: 502,
            message: "We could not email the history summary."
        };
    }
    return { ok: true };
}

function listHtml(items, emptyText, background = "#F3F4F6", color = "#10231F") {
    const list = normalizeList(items);
    if (!list.length) {
        return `<p style="margin: 0; color: #5B605D;">${escapeHtml(emptyText)}</p>`;
    }
    return `<ul style="list-style: none; margin: 0; padding: 0;">
      ${list.map((item) => `<li style="margin: 0 0 10px; border-radius: 12px; background: ${background}; padding: 12px 14px; color: ${color}; font-weight: 700;">${escapeHtml(item)}</li>`).join("")}
    </ul>`;
}

function patientReportEmailHtml({ recipientName, report }) {
    return `
      <div style="margin: 0; padding: 32px 18px; background: #DAF8EF; font-family: Arial, sans-serif; color: #111827;">
        <div style="max-width: 720px; margin: 0 auto; overflow: hidden; border-radius: 22px; background: #ffffff; box-shadow: 0 18px 45px rgba(50, 76, 74, 0.14);">
          <div style="background: #10231F; padding: 24px 28px; color: #ffffff;">
            <p style="margin: 0; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #ADF8EF;">KAMAL Patient Report</p>
            <h1 style="margin: 10px 0 0; font-size: 28px; line-height: 1.2;">Doctor-ready patient report</h1>
          </div>
          <div style="padding: 28px;">
            <p style="margin: 0 0 16px; font-size: 16px;">Hello ${escapeHtml(recipientName)},</p>
            <div style="display: grid; gap: 12px;">
              ${emailSection({
                  title: "Patient name",
                  children: `<p style="margin: 0; font-size: 22px; font-weight: 800; color: #10231F;">${escapeHtml(report.patientName)}</p>`
              })}
              ${emailSection({
                  title: "Patient email",
                  children: `<p style="margin: 0; font-weight: 700; color: #10231F;">${escapeHtml(report.patientEmail)}</p>`
              })}
              ${emailSection({
                  title: "Pre text",
                  background: "#F9FAFB",
                  children: `<p style="margin: 0; white-space: pre-wrap; line-height: 1.7; color: #111827;">${escapeHtml(report.preText)}</p>`
              })}
              ${emailSection({
                  title: "Summary",
                  background: "#DAF8EF",
                  children: `<p style="margin: 0; line-height: 1.7; color: #10231F;">${escapeHtml(report.summary)}</p>`
              })}
              ${emailSection({
                  title: "Doctor recommendations",
                  children: listHtml(report.doctorRecommendations, "No recommendations available.", "#DAF8EF", "#10231F")
              })}
              ${emailSection({
                  title: "Red flags",
                  children: listHtml(report.redFlags, "No red flags available.", "#FEF2F2", "#B91C1C")
              })}
            </div>
            <div style="margin-top: 20px; border-left: 4px solid #F59E0B; background: #FFF7ED; padding: 12px 14px; border-radius: 12px;">
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #7C2D12;">${escapeHtml(report.caution)}</p>
            </div>
          </div>
        </div>
      </div>
    `;
}

export async function sendPatientReportEmail({ to, recipientName, report, text }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
        return {
            ok: false,
            status: 503,
            message: "Report email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL."
        };
    }
    const resend = new Resend(apiKey);
    const subject = `KAMAL patient report for ${report.patientName}`;
    const { error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        text,
        html: patientReportEmailHtml({ recipientName, report })
    });
    if (error) {
        console.error("Resend patient report failed", error);
        return {
            ok: false,
            status: 502,
            message: "We could not email the patient report."
        };
    }
    return { ok: true, message: `Report emailed to ${to}.` };
}
