"use client";

import { useState, type FormEvent } from "react";

/**
 * Tester / user feedback page (bisect test: plain controlled form,
 * no Netlify Forms markup — that is added back once the build
 * failure is isolated).
 */

const RATINGS = [
  { value: "5", label: "5 — Very easy" },
  { value: "4", label: "4" },
  { value: "3", label: "3" },
  { value: "2", label: "2" },
  { value: "1", label: "1 — Confusing" },
];

export default function FeedbackPage() {
  const [rating, setRating] = useState("");
  const [worked, setWorked] = useState("");
  const [problems, setProblems] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const body = new URLSearchParams({
      "form-name": "feedback",
      rating,
      worked,
      problems,
      email,
    });
    try {
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-900">Thank you! 🎉</h1>
        <p className="mt-4 text-slate-600">
          Your feedback was received and helps make SearchReady better. You can
          close this page — or analyze another URL if you have more to try.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900">Share your feedback</h1>
      <p className="mt-2 text-slate-600">
        You tested SearchReady — now tell us how it went. It takes under a
        minute, and every note is read.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <fieldset>
          <legend className="font-semibold text-slate-900">
            How easy was it to understand your results?
          </legend>
          <div className="mt-3 space-y-2">
            {RATINGS.map((r) => (
              <label key={r.value} className="flex items-center gap-3 text-slate-700">
                <input
                  type="radio"
                  name="rating"
                  value={r.value}
                  required
                  checked={rating === r.value}
                  onChange={() => setRating(r.value)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="worked" className="font-semibold text-slate-900">
            What worked well? (optional)
          </label>
          <textarea
            id="worked"
            name="worked"
            rows={3}
            value={worked}
            onChange={(e) => setWorked(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3"
            placeholder="Anything you liked or found useful…"
          />
        </div>

        <div>
          <label htmlFor="problems" className="font-semibold text-slate-900">
            What was confusing or broken? (optional)
          </label>
          <textarea
            id="problems"
            name="problems"
            rows={3}
            value={problems}
            onChange={(e) => setProblems(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3"
            placeholder="Anything that didn't work, error messages you saw, parts that were unclear…"
          />
        </div>

        <div>
          <label htmlFor="email" className="font-semibold text-slate-900">
            Your email, if you'd like a reply (optional)
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3"
          />
        </div>

        {status === "error" && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Sorry — sending failed. Please try again in a moment.
          </p>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </div>
  );
}
