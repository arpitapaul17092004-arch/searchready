"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadHistory = loadHistory;
exports.saveHistory = saveHistory;
exports.upsertEntry = upsertEntry;
const STORAGE_KEY = "searchready:history";
const MAX_ENTRIES = 50;
function loadHistory() {
    if (typeof window === "undefined")
        return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter((e) => typeof e === "object" &&
            e !== null &&
            typeof e.url === "string" &&
            typeof e.overallScore === "number");
    }
    catch {
        return [];
    }
}
function saveHistory(entries) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    }
    catch {
        // storage full/blocked — non-fatal
    }
}
function upsertEntry(entry) {
    const next = [entry, ...loadHistory().filter((e) => e.url !== entry.url)].slice(0, MAX_ENTRIES);
    saveHistory(next);
    return next;
}
