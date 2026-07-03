/**
 * Lightweight spaced-repetition scheduler (SM-2 lite) for flashcards.
 * Per-card schedule persisted in localStorage — no backend. The user rates a
 * card Again / Hard / Good / Easy and we compute the next review date.
 */

export interface CardSched {
  ef: number; // ease factor
  interval: number; // days
  reps: number;
  due: number; // epoch ms
}

export type Quality = 1 | 3 | 4 | 5; // Again / Hard / Good / Easy

const KEY = "vidhyaai_srs";
const DAY = 86_400_000;

function readAll(): Record<string, CardSched> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, CardSched>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function cardId(deck: string, index: number): string {
  return `${deck}::${index}`;
}

export function getSched(id: string): CardSched | undefined {
  return readAll()[id];
}

/** Is this card due for review now (or never studied)? */
export function isDue(id: string): boolean {
  const s = readAll()[id];
  return !s || s.due <= Date.now();
}

/** Apply a rating and persist the new schedule. */
export function rate(id: string, quality: Quality): CardSched {
  const map = readAll();
  const prev = map[id] || { ef: 2.5, interval: 0, reps: 0, due: 0 };

  let { ef, interval, reps } = prev;
  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef);
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const next: CardSched = { ef, interval, reps, due: Date.now() + interval * DAY };
  map[id] = next;
  writeAll(map);
  return next;
}
