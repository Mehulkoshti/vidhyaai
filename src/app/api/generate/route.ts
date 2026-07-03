import { NextRequest, NextResponse } from "next/server";
import { generate, ask, StudyMode, InlineFile } from "@/lib/sarvam";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_MODES: StudyMode[] = [
  "summary",
  "quiz",
  "flashcards",
  "explain",
  "mindmap",
  "test",
  "planner",
  "course",
];
const ALLOWED_MIME = ["image/png", "image/jpeg", "application/pdf"];

export async function POST(req: NextRequest) {
  try {
    // No key check here: when SARVAM_API_KEY is unset the lib runs in MOCK mode
    // (zero credits) so the app still works for development and previews.
    const body = await req.json();
    const lang = (body.lang as string) || "English";

    /* ---------- Follow-up doubt (chat) ---------- */
    if (body.mode === "ask") {
      const context = (body.context as string)?.trim() || "general studies";
      const question = (body.question as string)?.trim();
      if (!question || question.length < 2) {
        return NextResponse.json({ error: "Please type your question." }, { status: 400 });
      }
      if (question.length > 2000) {
        return NextResponse.json({ error: "Question too long." }, { status: 400 });
      }
      const data = await ask(context, question, lang);
      return NextResponse.json({ data });
    }

    /* ---------- Study material generation ---------- */
    const mode = body.mode as StudyMode;
    const topic = ((body.topic as string) || "").trim();
    const file = body.file as InlineFile | undefined;

    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    if (file) {
      if (!ALLOWED_MIME.includes(file.mimeType)) {
        return NextResponse.json(
          { error: "Unsupported file. Use a PNG/JPG image or a PDF." },
          { status: 400 }
        );
      }
      // base64 is ~1.33x raw size; cap raw at ~7MB.
      if (file.data.length > 9_500_000) {
        return NextResponse.json({ error: "File too large. Keep it under 7 MB." }, { status: 400 });
      }
    } else {
      if (!topic || topic.length < 3) {
        return NextResponse.json(
          { error: "Enter a topic / notes, or attach an image or PDF." },
          { status: 400 }
        );
      }
      if (topic.length > 12000) {
        return NextResponse.json({ error: "Input too long. Keep it under 12,000 characters." }, { status: 400 });
      }
    }

    const data = await generate(mode, topic, lang, file);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    console.error("[VidhyaAI] generate error:", message);
    return NextResponse.json({ error: "AI generation failed. Please try again." }, { status: 500 });
  }
}
