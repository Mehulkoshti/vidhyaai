import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Speech-to-text via Sarvam's Saaras model — lets students speak their doubt
 * instead of typing (great for regional languages and on-the-go revision).
 *
 * The browser records audio (MediaRecorder → WebM/MP4) and posts it here as
 * multipart form-data; we forward it to Sarvam and return the transcript.
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

export async function POST(req: NextRequest) {
  try {
    if (MOCK) {
      return NextResponse.json({ transcript: "Explain this topic in simple terms (mock voice input)" });
    }

    const form = (await req.formData()) as unknown as {
      get(name: string): unknown;
    };
    const file = form.get("file");
    const lang = (form.get("lang") as string) || "";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No audio received." }, { status: 400 });
    }

    const out = new FormData();
    // Preserve the uploaded file's real name so Sarvam sees the correct format:
    // web records WebM, the mobile app records M4A. (File carries its own type.)
    out.append("file", file, file.name || "audio.webm");
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
      console.error("[VidhyaAI] STT error:", res.status, detail.slice(0, 200));
      return NextResponse.json({ error: "Could not transcribe audio." }, { status: 502 });
    }

    const json = await res.json();
    return NextResponse.json({ transcript: json?.transcript || "" });
  } catch (err) {
    console.error("[VidhyaAI] STT route failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Voice input failed." }, { status: 500 });
  }
}
