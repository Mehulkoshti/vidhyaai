/**
 * Tiny shared key-value store for Classroom mode.
 *
 * Uses Netlify Blobs when deployed on Netlify (zero setup, no external account),
 * and falls back to an in-process Map for local `next dev` so the flow still
 * works while developing. Values are JSON.
 */

const memory = new Map<string, string>();

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  // Strong consistency so a read right after a write (e.g. a student opening a
  // class the teacher just created) always sees the latest data.
  return getStore({ name: "vidhyaai-classroom", consistency: "strong" });
}

export async function readJson<T = unknown>(key: string): Promise<T | null> {
  try {
    const store = await blobStore();
    const v = await store.get(key, { type: "json" });
    return (v as T) ?? null;
  } catch {
    const v = memory.get(key);
    return v ? (JSON.parse(v) as T) : null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  const payload = JSON.stringify(value);
  try {
    const store = await blobStore();
    await store.set(key, payload);
  } catch {
    memory.set(key, payload);
  }
}

/** Human-friendly join code (no ambiguous chars like O/0/I/1). */
export function makeCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
