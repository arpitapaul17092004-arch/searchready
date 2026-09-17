"use client";

import { useState, type FormEvent } from "react";
import type { AnalysisResult } from "@/lib/analysis";
import Checklist from "@/components/checklist";
import ScoreCard from "@/components/score-card";
import { upsertEntry } from "@/lib/history";

export default function AnalyzePage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof (data as { error?: unknown })?.error === "string"
            ? (data as { error: string }).error
            : "Analysis failed.";
        throw new Error(message);
      }
      const analysis = data as AnalysisResult;
      setResult(analysis);
      // Local history always…
      upsertEntry({
        url: analysis.finalUrl || analysis.url,
        analyzedAt: analysis.analyzedAt,
        overallScore: analysis.overallScore,
        seoScore: analysis.seoScore,
        aiAnswerScore: analysis.aiAnswerScore,
      });
      // …and best-effort server sync (no-op in demo mode / logged out).
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: analysis.finalUrl || analysis.url,
          overallScore: analysis.overallScore,
          seoScore: analysis.seoScore,
          aiAnswerScore: analysis.aiAnswerScore,
        }),
      }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Analyze a URL</h1>
      <p className="mt-1 text-slate-600">
        Get one readiness score for traditional search and AI answer engines, plus a
        prioritized checklist.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/blog/your-post"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          aria-label="URL to analyze"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-8">
          <div>
            <div className="grid gap-4 sm:grid-cols-3">
              <ScoreCard label="Overall readiness" score={result.overallScore} />
              <ScoreCard label="SEO score" score={result.seoScore} />
              <ScoreCard label="AI-answer score" score={result.aiAnswerScore} />
            </div>
            <p className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
              {result.summary}
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-slate-900">
              Prioritized checklist
            </h2>
            <Checklist items={result.checklist} />
          </div>

          <details className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold text-slate-900">
              Raw signals detected
            </summary>
            <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-700">Title</dt>
                <dd>{result.stats.title ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Meta description</dt>
                <dd>
                  {result.stats.metaDescription
                    ? `${result.stats.metaDescription.slice(0, 120)}…`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Headings</dt>
                <dd>
                  {result.stats.h1Count} H1 / {result.stats.h2Count} H2 ·{" "}
                  {result.stats.questionHeadingCount} question headings
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Body word count</dt>
                <dd>≈ {result.stats.wordCount}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Direct answer block</dt>
                <dd>{result.stats.hasDirectAnswer ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">FAQ section</dt>
                <dd>{result.stats.hasFaq ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Structured data</dt>
                <dd>{result.stats.hasStructuredData ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Images with alt text</dt>
                <dd>
                  {result.stats.imagesWithAlt} / {result.stats.imageCount}
                </dd>
              </div>
            </dl>
          </details>
        </div>
      )}
    </div>
  );
}
