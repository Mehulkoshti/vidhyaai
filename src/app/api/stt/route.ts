import { NextRequest, NextResponse } from "next/server";
import { geminiTranscribe, GEMINI_AVAILABLE } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Speech-to-text — lets students speak their doubt instead of typing.
 *
 * Sarvam's Saaras model is the primary STT engine, but it only accepts WAV/MP3,
 * whereas the browser records WebM and the mobile app records M4A (which Saaras
 * rejects with "Invalid audio file"). So we try Saaras first and, if it can't
 * handle the format, fall back to Gemini's audio transcription — which reads
 * those formats directly — so voice input works everywhere.
 *
 * In MOCK mode (no key) we return a canned transcript so the flow works in dev.
 */

const apiKey = process.env.SARVAM_API_KEY;
const MOCK = process.env.SARVAM_MOCK === "1" || !apiKey;
const STT_URL = "https://api.sarvam.ai/speech-to-text";

const LANG_CODE: Record<string, string> = {
  English: "en-IN",
  Hindi: "hi-IN",
  Hinglish: "hi-IN",
  Marathi: "mr-IN",
  Tamil: "ta-IN",
  Bengali: "bn-IN",
  Telugu: "te-IN",
  Kannada: "kn-IN",
  Gujarati: "gu-IN",
  Malayalam: "ml-IN",
  Punjabi: "pa-IN",
  Odia: "od-IN",
};

/** Try Sarvam Saaras (needs WAV/MP3). Returns the transcript, or null on any failure. */
async function sarvamTranscribe(
  buf: ArrayBuffer,
  filename: string,
  type: string,
  lang: string
): Promise<string | null> {
  try {
    const out = new FormData();
    out.append("file", new Blob([buf], { type: type || "audio/wav" }), filename || "audio.wav");
    out.append("model", "saaras:v3");
    const code = LANG_CODE[lang];
    if (code) out.append("language_code", code);

    const res = await fetch(STT_URL, {
      method: "POST",
      headers: { "api-subscription-key": apiKey as string },
      body: out,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn("[VidhyaAI] Saaras STT rejected audio:", res.status, detail.slice(0, 150));
      return null;
    }
    const json = await res.json();
    return json?.transcript || null;
  } catch (e) {
    console.warn("[VidhyaAI] Saaras STT error:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (MOCK) {
      return NextResponse.json({ transcript: "Explain this topic in simple terms (mock voice input)" });
    }

    const form = (await req.formData()) as unknown as { get(name: string): unknown };
    const file = form.get("file");
    const lang = (form.get("lang") as string) || "";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No audio received." }, { status: 400 });
    }

    const ab = await file.arrayBuffer();

    // 1) Sarvam Saaras first (native STT — works when the audio is WAV/MP3).
    let transcript = await sarvamTranscribe(ab, file.name, file.type, lang);

    // 2) Fallback to Gemini for the formats Saaras rejects (WebM from the web,
    //    M4A from the mobile app) so voice input works everywhere.
    if (!transcript && GEMINI_AVAILABLE) {
      try {
        transcript = await geminiTranscribe(Buffer.from(ab).toString("base64"), file.type, lang);
      } catch (e) {
        console.error("[VidhyaAI] Gemini STT fallback failed:", e instanceof Error ? e.message : e);
      }
    }

    if (!transcript) {
      return NextResponse.json({ error: "Could not transcribe audio." }, { status: 502 });
    }
    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("[VidhyaAI] STT route failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Voice input failed." }, { status: 500 });
  }
}
