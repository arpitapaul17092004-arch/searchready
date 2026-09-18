"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HistoryEntry } from "@/lib/history";
import { loadHistory, saveHistory, upsertEntry } from "@/lib/history";

interface ServerEntry extends HistoryEntry {
  id: string;
}

type Mode = "loading" | "server" | "local";

export default function DashboardPage() {
  const [entries, setEntries] = useState<(HistoryEntry & { id?: string })[]>([]);
  const [mode, setMode] = useState<Mode>("loading");
  const [reAnalyzing, setReAnalyzing] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/history");
        if (res.ok) {
          const data = (await res.json()) as { entries: ServerEntry[] };
          setEntries(data.entries);
          setMode("server");
          return;
        }
      } catch {
        // fall through to local mode
      }
      setEntries(loadHistory());
      setMode("local");
    })();
  }, []);

  async function reAnalyze(url: string) {
    setReAnalyzing(url);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data: unknown = await res.json();
      if (res.ok) {
        const analysis = data as {
          finalUrl: string;
          url: string;
          analyzedAt: string;
          overallScore: number;
          seoScore: number;
          aiAnswerScore: number;
        };
        const entry = {
          url: analysis.finalUrl || analysis.url,
          analyzedAt: analysis.analyzedAt,
          overallScore: analysis.overallScore,
          seoScore: analysis.seoScore,
          aiAnswerScore: analysis.aiAnswerScore,
        };
        if (mode === "server") {
          await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry),
          }).catch(() => undefined);
          const refreshed = await fetch("/api/history");
          if (refreshed.ok) {
            const data2 = (await refreshed.json()) as { entries: ServerEntry[] };
            setEntries(data2.entries);
          }
        } else {
          setEntries(upsertEntry(entry));
        }
      }
    } finally {
      setReAnalyzing(null);
    }
  }

  async function removeEntry(entry: HistoryEntry & { id?: string }) {
    if (mode === "server" && entry.id) {
      const res = await fetch(`/api/history?id=${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.url !== entry.url));
        return;
      }
    }
    const next = entries.filter((e) => e.url !== entry.url);
    setEntries(next);
    saveHistory(next);
  }

  function exportHistory() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "searchready-history.json";
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-slate-600">
            {mode === "server"
              ? "Your analysis history, synced to your account."
              : mode === "local"
                ? "Your analysis history. Stored in this browser only — log in to sync across devices."
                : "Loading…"}
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={exportHistory}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-600"
          >
            Export JSON
          </button>
        )}
      </div>

      {mode === "local" && (
        <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
          Demo mode: accounts are not configured on this deployment. History is kept in
          your browser only.
        </div>
      )}

      {entries.length === 0 && mode !== "loading" ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">No pages analyzed yet.</p>
          <Link
            href="/analyze"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Analyze your first URL
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Page</th>
                <th className="px-4 py-3 font-medium">Overall</th>
                <th className="px-4 py-3 font-medium">SEO</th>
                <th className="px-4 py-3 font-medium">AI answer</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Last analyzed</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.url} className="border-b border-slate-100 last:border-0">
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-800">
                    {entry.url}
                  </td>
                  <td className="px-4 py-3 font-bold tabular-nums">{entry.overallScore}</td>
                  <td className="px-4 py-3 tabular-nums">{entry.seoScore}</td>
                  <td className="px-4 py-3 tabular-nums">{entry.aiAnswerScore}</td>
                  <td className="px-4 py-3 tabular-nums">{entry.entityScore ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(entry.analyzedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => reAnalyze(entry.url)}
                        disabled={reAnalyzing === entry.url}
                        className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                      >
                        {reAnalyzing === entry.url ? "…" : "Re-analyze"}
                      </button>
                      <button
                        onClick={() => removeEntry(entry)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-red-300 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
