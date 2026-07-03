/**
 * A tiny client-side "My Library" — saved study decks persisted in
 * localStorage so they survive tab closes (unlike the in-session chat).
 * No backend, no account, no cost.
 */

import type { StudyMode } from "./sarvam";

export interface SavedItem {
  id: string;
  title: string;
  mode: StudyMode;
  data: unknown;
  lang: string;
  savedAt: number;
}

const KEY = "vidhyaai_library";

export function loadLibrary(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function persist(items: SavedItem[]): SavedItem[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
  return items;
}

export function saveItem(item: SavedItem): SavedItem[] {
  return persist([item, ...loadLibrary()]);
}

export function removeItem(id: string): SavedItem[] {
  return persist(loadLibrary().filter((i) => i.id !== id));
}
