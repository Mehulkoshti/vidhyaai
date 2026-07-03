import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/store";

export const runtime = "nodejs";

interface ClassResult { name: string; score: number; total: number; at: number }
interface ClassRoom {
  code: string;
  topic: string;
  lang: string;
  test: unknown;
  createdAt: number;
  results: ClassResult[];
}

/** GET the class test + current results. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await readJson<ClassRoom>(code.toUpperCase());
  if (!room) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  return NextResponse.json({
    topic: room.topic,
    lang: room.lang,
    test: room.test,
    results: room.results,
  });
}

/** POST a student's result to the leaderboard. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const key = code.toUpperCase();
  const room = await readJson<ClassRoom>(key);
  if (!room) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const body = await req.json();
  const name = ((body.name as string) || "Anonymous").trim().slice(0, 40) || "Anonymous";
  const score = Math.max(0, Math.floor(Number(body.score) || 0));
  const total = Math.max(1, Math.floor(Number(body.total) || 1));

  room.results.push({ name, score, total, at: Date.now() });
  await writeJson(key, room);
  return NextResponse.json({ ok: true, results: room.results });
}
