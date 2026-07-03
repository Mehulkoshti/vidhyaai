/**
 * Sarvam Vision — document OCR via the Document Intelligence (doc-digitization)
 * job API. Turns an uploaded photo or PDF of notes into plain text, which the
 * study-material prompts then work from.
 *
 * The API is an async job: create → upload → start → poll → download. Images are
 * wrapped into a single-page PDF first (the API accepts only PDF/ZIP input).
 *
 * NOTE: OCR + polling can take several seconds; on serverless hosts with short
 * function timeouts (e.g. Netlify/Vercel free = 10s) large PDFs may time out.
 * Single images and short PDFs complete quickly. Runs only in real (non-mock)
 * mode and is billed per page, so it's gated behind an explicit file upload.
 */

import { PDFDocument } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";
import type { InlineFile } from "./sarvam";

const apiKey = process.env.SARVAM_API_KEY as string;
const BASE = "https://api.sarvam.ai/doc-digitization/job/v1";

function headers() {
  return { "Content-Type": "application/json", "api-subscription-key": apiKey };
}

const LANG_CODE: Record<string, string> = {
  English: "en-IN",
  Hindi: "hi-IN",
  Hinglish: "hi-IN",
  Marathi: "mr-IN",
  Tamil: "ta-IN",
  Bengali: "bn-IN",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

/** Wrap a PNG/JPEG image into a one-page PDF (the OCR API needs PDF/ZIP input). */
async function toPdfBytes(file: InlineFile): Promise<Uint8Array> {
  if (file.mimeType === "application/pdf") return b64ToBytes(file.data);

  const imgBytes = b64ToBytes(file.data);
  const pdf = await PDFDocument.create();
  const img =
    file.mimeType === "image/png"
      ? await pdf.embedPng(imgBytes)
      : await pdf.embedJpg(imgBytes); // image/jpeg
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return pdf.save();
}

/** Recursively collect every `file_url` string from a response object. */
function collectUrls(obj: unknown, out: string[] = []): string[] {
  if (!obj || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    obj.forEach((o) => collectUrls(o, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "file_url" && typeof v === "string") out.push(v);
    else collectUrls(v, out);
  }
  return out;
}

/** Pull readable text out of a downloaded output (zip of md/json/html, or raw). */
function extractText(buf: Uint8Array): string {
  // ZIP magic bytes "PK\x03\x04"
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    try {
      const files = unzipSync(buf);
      let out = "";
      for (const [name, data] of Object.entries(files)) {
        if (/\.(md|txt|json|html?)$/i.test(name)) out += strFromU8(data) + "\n";
      }
      return out;
    } catch {
      return "";
    }
  }
  try {
    return strFromU8(buf);
  } catch {
    return "";
  }
}

export async function ocrDocument(file: InlineFile, lang = "English"): Promise<string> {
  const language = LANG_CODE[lang] || "en-IN";
  const pdfBytes = await toPdfBytes(file);

  // 1. Create job
  const created = await fetch(BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ job_parameters: { language, output_format: "md" } }),
  });
  if (!created.ok) throw new Error(`OCR create-job failed (${created.status})`);
  const createdJson = await created.json();
  const jobId: string | undefined = createdJson?.job_id;
  if (!jobId) throw new Error("OCR: missing job_id");

  // 2. Get a presigned upload URL
  const up = await fetch(`${BASE}/upload-files`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ job_id: jobId, files: ["input.pdf"] }),
  });
  if (!up.ok) throw new Error(`OCR upload-urls failed (${up.status})`);
  const upJson = await up.json();
  const uploadUrl =
    upJson?.upload_urls?.["input.pdf"]?.file_url || collectUrls(upJson?.upload_urls)[0];
  if (!uploadUrl) throw new Error("OCR: missing upload URL");

  // 3. PUT the PDF to blob storage (x-ms-blob-type set for Azure presigned URLs)
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf", "x-ms-blob-type": "BlockBlob" },
    body: new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }),
  });
  if (!put.ok) throw new Error(`OCR file upload failed (${put.status})`);

  // 4. Start processing
  const start = await fetch(`${BASE}/${jobId}/start`, {
    method: "POST",
    headers: headers(),
    body: "{}",
  });
  if (!start.ok) throw new Error(`OCR start failed (${start.status})`);

  // 5. Poll until done (~40s cap)
  let state = "";
  for (let i = 0; i < 28; i++) {
    await sleep(1500);
    const st = await fetch(`${BASE}/${jobId}`, { headers: headers() });
    if (!st.ok) continue;
    const sj = await st.json();
    state = sj?.job_state || sj?.status || "";
    if (["Completed", "PartiallyCompleted", "Failed"].includes(state)) break;
  }
  if (state === "Failed") throw new Error("OCR job failed");
  if (state !== "Completed" && state !== "PartiallyCompleted") {
    throw new Error("OCR timed out — try a smaller / clearer file");
  }

  // 6. Get download URL(s)
  const dl = await fetch(`${BASE}/${jobId}/download-files`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!dl.ok) throw new Error(`OCR download-urls failed (${dl.status})`);
  const dlUrls = collectUrls(await dl.json());
  if (!dlUrls.length) throw new Error("OCR: missing output URL");

  // 7. Fetch outputs and concatenate the extracted text
  let text = "";
  for (const u of dlUrls) {
    const r = await fetch(u);
    if (!r.ok) continue;
    text += extractText(new Uint8Array(await r.arrayBuffer())) + "\n";
  }
  text = text.trim();
  if (!text) throw new Error("OCR produced no readable text");

  return text.slice(0, 12000); // bound the downstream chat input cost
}
