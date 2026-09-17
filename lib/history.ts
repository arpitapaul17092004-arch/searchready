"use client";

/**
 * Local analysis history, stored in the browser's localStorage only.
 * No personal data leaves the device in this MVP (no accounts yet).
 */

export interface HistoryEntry {
  url: string;
  analyzedAt: string;
  overallScore: number;
  seoScore: number;
  aiAnswerScore: number;
  note?: string; // visibility log entry
}

const STORAGE_KEY = "searchready:history";
const MAX_ENTRIES = 50;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as HistoryEntry).url === "string" &&
        typeof (e as HistoryEntry).overallScore === "number",
    );
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // storage full/blocked — non-fatal
  }
}

export function upsertEntry(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory().filter((e) => e.url !== entry.url)].slice(
    0,
    MAX_ENTRIES,
  );
  saveHistory(next);
  return next;
}
