import { extract } from "../../packages/ai";
import type { HealthDocument } from "../../packages/health-core";
export async function readDocument(
  file: File,
  onProgress: (message: string) => void,
): Promise<HealthDocument> {
  if (file.size > 8 * 1024 * 1024)
    throw new Error("Please choose a file smaller than 8 MB.");
  const allowed = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
  ];
  if (!allowed.includes(file.type))
    throw new Error("Choose a PDF, PNG, JPEG, WebP or plain-text file.");
  const id = crypto.randomUUID();
  let text = "";
  onProgress("Reading your document on this device…");
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/showcase-assets/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const doc = await task.promise;
    if (doc.numPages > 20) {
      await task.destroy();
      throw new Error("Please use a document with 20 pages or fewer.");
    }
    try {
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        text +=
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join("\n") + "\n";
      }
    } finally {
      await task.destroy();
    }
  } else if (file.type.startsWith("image/")) {
    onProgress("Reading image text locally. OCR may take a moment…");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      workerPath: "/showcase-assets/ocr/worker.min.js",
      corePath: "/showcase-assets/ocr",
      langPath: "/showcase-assets/ocr",
      gzip: true,
    });
    try {
      text = (await worker.recognize(file)).data.text;
    } finally {
      await worker.terminate();
    }
  } else text = await file.text();
  const fileData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Could not preserve the original file."));
    reader.readAsDataURL(file);
  });
  const fields = extract(text, id);
  const extractedDate = fields
    .find((f) => f.label === "Document date")
    ?.value.replaceAll("/", "-");
  const date =
    extractedDate && /^\d{4}-\d{2}-\d{2}$/.test(extractedDate)
      ? extractedDate
      : new Date().toISOString().slice(0, 10);
  return {
    id,
    title: file.name,
    date,
    category: /vitamin|glucose|ha?emoglobin/i.test(text)
      ? "Laboratory Reports"
      : /prescription/i.test(text)
        ? "Prescriptions"
        : "Other Documents",
    institution:
      fields.find((f) => f.label === "Organisation")?.value ||
      "Not identified — please verify",
    country: "Not specified",
    summary: fields.length
      ? `${fields.length} possible fields were found. Verify each against the original before using this record.`
      : "No structured fields could be read confidently. Add a manual summary and check the original. Scanned PDFs need image upload for OCR.",
    tags: ["Imported", "Needs review"],
    fields,
    text,
    fileData,
    mime: file.type,
  };
}
export function download(
  name: string,
  data: BlobPart,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
