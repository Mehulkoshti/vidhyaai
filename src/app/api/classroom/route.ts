import { NextRequest, NextResponse } from "next/server";
import { generate } from "@/lib/sarvam";
import { readJson, writeJson, makeCode } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Classroom mode — a teacher turns a topic into a shareable mock test.
 * POST { topic, lang } → generates a 10-question test (Sarvam), stores it under
 * a short join code, and returns the code students use to take it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const topic = ((body.topic as string) || "").trim();
    const lang = (body.lang as string) || "English";
    if (!topic || topic.length < 3) {
      return NextResponse.json({ error: "Enter a topic for the class test." }, { status: 400 });
    }

    const test = await generate("test", topic, lang);

    let code = makeCode();
    if (await readJson(code)) code = makeCode(); // avoid a rare collision

    await writeJson(code, {
      code,
      topic,
      lang,
      test,
      createdAt: Date.now(),
      results: [],
    });

    return NextResponse.json({ code });
  } catch (err) {
    console.error("[VidhyaAI] classroom create error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not create the class. Try again." }, { status: 500 });
  }
}
