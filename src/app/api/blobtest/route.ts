import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** TEMP diagnostic: confirms whether Netlify Blobs actually persists on deploy. */
export async function GET() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "vidhyaai-classroom", consistency: "strong" });
    const key = "_diag";
    const value = `hello-${Date.now()}`;
    await store.set(key, value);
    const read = await store.get(key);
    return NextResponse.json({ ok: true, backend: "netlify-blobs", wrote: value, read });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      backend: "memory-fallback",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
