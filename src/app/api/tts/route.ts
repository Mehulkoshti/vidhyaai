import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Text-to-speech via Sarvam's Bulbul model — natural, native-sounding voices
 * for Indian languages (a big upgrade over the browser's robotic Hindi TTS).
 *
 * CREDIT SAFETY: TTS is billed per character, so it runs only on an explicit
 * user click and the client caches the audio. In MOCK mode (no key) this route
 * returns { mock: true } and the client falls back to the free browser voice.
 */

const apiKey = process.env.SARVAM_API_KEY;
const MOCK = process.env.SARVAM_MOCK === "1" || !apiKey;
const TTS_URL = "https://api.sarvam.ai/text-to-speech";
const MAX_CHARS = 2500; // Bulbul v3 limit per request

// Our UI language names → Sarvam BCP-47 codes.
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
    const { text, lang } = await req.json();
    const clean = (text as string)?.trim();
    if (!clean) {
      return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
    }

    // In mock mode, tell the client to use the free browser voice instead.
    if (MOCK) {
      return NextResponse.json({ mock: true });
    }

    const res = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey as string,
      },
      body: JSON.stringify({
        text: clean.slice(0, MAX_CHARS),
        target_language_code: LANG_CODE[lang as string] || "en-IN",
        model: "bulbul:v3",
        speaker: "shubh",
        pace: 1.0,
        output_audio_codec: "mp3",
        speech_sample_rate: "24000",
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[VidhyaAI] TTS error:", res.status, detail.slice(0, 200));
      // Soft-fail: let the client fall back to the browser voice.
      return NextResponse.json({ mock: true });
    }

    const json = await res.json();
    const audio: string | undefined = json?.audios?.[0];
    if (!audio) return NextResponse.json({ mock: true });

    return NextResponse.json({ audio, mime: "audio/mpeg" });
  } catch (err) {
    console.error("[VidhyaAI] TTS route failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ mock: true });
  }
}
