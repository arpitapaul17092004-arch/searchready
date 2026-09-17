"use client";

import { useState, type FormEvent } from "react";
import type { ContentTemplate } from "@/lib/templates";

export default function TemplatesPage() {
  const [topic, setTopic] = useState("");
  const [template, setTemplate] = useState<ContentTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setTemplate(null);
    setLoading(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof (data as { error?: unknown })?.error === "string"
            ? (data as { error: string }).error
            : "Template generation failed.";
        throw new Error(message);
      }
      setTemplate(data as ContentTemplate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Content template generator</h1>
      <p className="mt-1 text-slate-600">
        Enter a topic and get a ready-to-use outline with question-based headings and
        short direct-answer blocks — built for both classic search and AI citation.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          required
          maxLength={120}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. email marketing for small businesses"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          aria-label="Topic"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate outline"}
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {template && (
        <article className="mt-8 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">{template.title}</h2>
            <p className="mt-2 text-sm text-slate-500">
              <span className="font-semibold">Meta description: </span>
              {template.metaDescription}
            </p>
            <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4">
              <p className="font-semibold text-violet-900">Direct answer block (place right after the H1)</p>
              <p className="mt-1 text-sm text-violet-800">{template.introAnswerBlock}</p>
            </div>
          </div>

          <div className="space-y-4">
            {template.sections.map((section) => (
              <section key={section.heading} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-slate-900">H2 — {section.heading}</h3>
                <p className="mt-1 text-sm text-slate-500">{section.purpose}</p>
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <span className="font-semibold">Write: </span>
                  {section.directAnswerPrompt}
                </p>
                <ul className="mt-3 list-inside list-disc text-sm text-slate-600">
                  {section.bulletPoints.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">FAQ section (mark up with FAQPage JSON-LD)</h3>
            <dl className="mt-3 space-y-3">
              {template.faq.map((f) => (
                <div key={f.question} className="rounded-lg bg-slate-50 p-3">
                  <dt className="font-medium text-slate-800">H3 — {f.question}</dt>
                  <dd className="text-sm text-slate-600">{f.answerHint}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Entity clarity checklist</h3>
            <ul className="mt-3 list-inside list-disc text-sm text-slate-600">
              {template.keyEntities.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <h3 className="font-semibold text-emerald-900">Pro tips</h3>
            <ul className="mt-2 list-inside list-disc text-sm text-emerald-800">
              {template.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        </article>
      )}
    </div>
  );
}
