import { NextRequest, NextResponse } from "next/server";
import { generate, StudyMode } from "@/lib/sarvam";
import { readJson, writeJson, makeCode } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROOM_MODES: StudyMode[] = ["summary", "explain", "quiz", "flashcards", "mindmap"];

interface RoomItem { id: string; by: string; mode: StudyMode; topic: string; data: unknown; at: number }
interface Room { code: string; createdAt: number; items: RoomItem[] }

/** GET the shared feed for a room. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await readJson<Room>(`room:${code.toUpperCase()}`);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  return NextResponse.json({ items: room.items });
}

/** POST new study material into the shared feed. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const key = `room:${code.toUpperCase()}`;
  const room = await readJson<Room>(key);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const body = await req.json();
  const mode = body.mode as StudyMode;
  const topic = ((body.topic as string) || "").trim();
  const by = ((body.by as string) || "Someone").trim().slice(0, 40) || "Someone";
  const lang = (body.lang as string) || "English";

  if (!ROOM_MODES.includes(mode)) return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  if (topic.length < 3) return NextResponse.json({ error: "Enter a topic." }, { status: 400 });

  const data = await generate(mode, topic, lang);
  const item: RoomItem = { id: `${makeCode()}${Date.now()}`, by, mode, topic, data, at: Date.now() };

  room.items.push(item);
  if (room.items.length > 30) room.items = room.items.slice(-30); // bound size
  await writeJson(key, room);

  return NextResponse.json({ items: room.items });
}
