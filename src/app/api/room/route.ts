import { NextResponse } from "next/server";
import { writeJson, readJson, makeCode } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Collaborative study rooms — create an empty shared room. Anyone with the code
 * can then add study material that everyone in the room sees (a live feed).
 */
export async function POST() {
  try {
    let code = makeCode();
    if (await readJson(`room:${code}`)) code = makeCode();
    await writeJson(`room:${code}`, { code, createdAt: Date.now(), items: [] });
    return NextResponse.json({ code });
  } catch (err) {
    console.error("[VidhyaAI] room create error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not create the room." }, { status: 500 });
  }
}
