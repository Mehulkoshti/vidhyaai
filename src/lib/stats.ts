/**
 * Simple learning-progress tracking in localStorage: mock-test attempts and a
 * day-streak. Powers the Progress dashboard. No backend, no cost.
 */

export interface Attempt {
  topic: string;
  score: number;
  total: number;
  percent: number;
  at: number;
}

interface StatsStore {
  attempts: Attempt[];
  days: string[]; // "YYYY-MM-DD" strings of days the user studied
}

export interface ProgressSummary {
  attempts: number;
  avgPercent: number;
  bestPercent: number;
  streak: number;
  daysStudied: number;
  recent: Attempt[];
}

const KEY = "vidhyaai_stats";

function read(): StatsStore {
  if (typeof window === "undefined") return { attempts: [], days: [] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { attempts: s.attempts || [], days: s.days || [] };
  } catch {
    return { attempts: [], days: [] };
  }
}

function write(s: StatsStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Mark that the user studied today (for the streak). */
export function recordStudyDay() {
  const s = read();
  const t = todayStr();
  if (!s.days.includes(t)) {
    s.days.push(t);
    write(s);
  }
}

/** Record a completed mock-test attempt. */
export function recordTest(topic: string, score: number, total: number) {
  const s = read();
  s.attempts.push({
    topic,
    score,
    total,
    percent: total ? Math.round((score / total) * 100) : 0,
    at: Date.now(),
  });
  const t = todayStr();
  if (!s.days.includes(t)) s.days.push(t);
  write(s);
}

function computeStreak(days: string[]): number {
  const set = new Set(days);
  const d = new Date();
  // If today isn't studied yet, allow the streak to count up to yesterday.
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function getProgress(): ProgressSummary {
  const { attempts, days } = read();
  const percents = attempts.map((a) => a.percent);
  return {
    attempts: attempts.length,
    avgPercent: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0,
    bestPercent: percents.length ? Math.max(...percents) : 0,
    streak: computeStreak(days),
    daysStudied: new Set(days).size,
    recent: [...attempts].reverse().slice(0, 8),
  };
}
