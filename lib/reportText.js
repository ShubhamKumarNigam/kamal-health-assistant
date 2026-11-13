export const MAX_REPORT_CHARS = 80000;
export const MAX_REPORT_BYTES = 8 * 1024 * 1024;

export function validateReportText(text) {
    if (!String(text || "").trim()) throw new Error("No readable text was found. Please upload a clearer report or paste its text.");
    if (text.length > MAX_REPORT_CHARS) throw new Error("This report is too long. Please split it into smaller documents; no pages have been sent for analysis.");
    return text.trim();
}

// PDF decoding and scanned-page OCR run on the user's device. Only extracted text is sent.
export async function readReportText(file, progress = () => {}) {
    if (file.size > MAX_REPORT_BYTES) throw new Error("Please choose a report smaller than 8 MB.");
    let worker;
    let usedOcr = false;
    async function recognize(image) {
        usedOcr = true;
        if (!worker) {
            const { createWorker } = await import("tesseract.js");
            worker = await createWorker("eng", 1, {
                workerPath: "/showcase-assets/ocr/worker.min.js",
                corePath: "/showcase-assets/ocr", langPath: "/showcase-assets/ocr", gzip: true
            });
        }
        return (await worker.recognize(image)).data.text;
    }
    try {
        let text = "";
        if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
            const pdfjs = await import("pdfjs-dist");
            pdfjs.GlobalWorkerOptions.workerSrc = "/showcase-assets/pdf.worker.min.mjs";
            const task = pdfjs.getDocument({data: await file.arrayBuffer(), isEvalSupported: false});
            try {
                const doc = await task.promise;
                if (doc.numPages > 30) throw new Error("Please split this report into documents of 30 pages or fewer.");
                for (let n = 1; n <= doc.numPages; n++) {
                    progress(`Reading page ${n} of ${doc.numPages}…`);
                    const page = await doc.getPage(n);
                    const content = await page.getTextContent();
                    let pageText = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
                    if (pageText.replace(/\s/g, "").length < 40) {
                        progress(`Reading scanned page ${n} of ${doc.numPages}…`);
                        const base = page.getViewport({scale: 1});
                        const viewport = page.getViewport({scale: Math.min(2, 2400 / Math.max(base.width, base.height))});
                        const canvas = document.createElement("canvas");
                        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
                        await page.render({canvas, viewport}).promise;
                        pageText = await recognize(canvas);
                        canvas.width = 0; canvas.height = 0;
                    }
                    if (pageText.trim().length < 10) throw new Error(`Page ${n} could not be read. Please upload a clearer copy; no partial report has been sent.`);
                    text += `\n--- Page ${n} ---\n${pageText}\n`;
                    if (text.length > MAX_REPORT_CHARS) validateReportText(text);
                    page.cleanup();
                }
            } finally { await task.destroy(); }
        } else if (/^image\/(png|jpeg|webp)$/.test(file.type)) {
            progress("Reading report image text on your device…");
            text = await recognize(file);
        } else if (file.type.startsWith("text/") || /\.(txt|csv|md)$/i.test(file.name)) {
            text = await file.text();
        } else throw new Error("Please choose a PDF, PNG, JPEG, WebP, TXT or CSV report.");
        return {text: validateReportText(text), usedOcr};
    } finally { if (worker) await worker.terminate(); }
}
