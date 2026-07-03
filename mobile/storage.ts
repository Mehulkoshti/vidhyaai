import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persistent storage for the mobile app (AsyncStorage): a saved-deck library
 * and simple learning-progress stats. Mirrors the web app's localStorage
 * features. No backend, no cost.
 */

export interface SavedItem {
  id: string;
  title: string;
  mode: string;
  data: any;
  lang: string;
  savedAt: number;
}

const LIB = "vidhyaai_library";

export async function loadLibrary(): Promise<SavedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(LIB);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveItem(item: SavedItem): Promise<SavedItem[]> {
  const next = [item, ...(await loadLibrary())];
  await AsyncStorage.setItem(LIB, JSON.stringify(next));
  return next;
}

export async function removeItem(id: string): Promise<SavedItem[]> {
  const next = (await loadLibrary()).filter((i) => i.id !== id);
  await AsyncStorage.setItem(LIB, JSON.stringify(next));
  return next;
}

/* ---------- Progress stats ---------- */
export interface Attempt {
  topic: string;
  score: number;
  total: number;
  percent: number;
  at: number;
}

export interface Progress {
  attempts: number;
  avg: number;
  best: number;
  streak: number;
  days: number;
  recent: Attempt[];
}

const STATS = "vidhyaai_stats";

async function readStats(): Promise<{ attempts: Attempt[]; days: string[] }> {
  try {
    const raw = await AsyncStorage.getItem(STATS);
    const s = raw ? JSON.parse(raw) : {};
    return { attempts: s.attempts || [], days: s.days || [] };
  } catch {
    return { attempts: [], days: [] };
  }
}

async function writeStats(s: { attempts: Attempt[]; days: string[] }) {
  await AsyncStorage.setItem(STATS, JSON.stringify(s));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function recordStudyDay() {
  const s = await readStats();
  const t = today();
  if (!s.days.includes(t)) {
    s.days.push(t);
    await writeStats(s);
  }
}

export async function recordTest(topic: string, score: number, total: number) {
  const s = await readStats();
  s.attempts.push({ topic, score, total, percent: total ? Math.round((score / total) * 100) : 0, at: Date.now() });
  const t = today();
  if (!s.days.includes(t)) s.days.push(t);
  await writeStats(s);
}

function computeStreak(days: string[]): number {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export async function getProgress(): Promise<Progress> {
  const { attempts, days } = await readStats();
  const p = attempts.map((a) => a.percent);
  return {
    attempts: attempts.length,
    avg: p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : 0,
    best: p.length ? Math.max(...p) : 0,
    streak: computeStreak(days),
    days: new Set(days).size,
    recent: [...attempts].reverse().slice(0, 8),
  };
}
