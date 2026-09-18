import Link from "next/link";

const features = [
  {
    title: "URL Analyzer",
    description:
      "Paste a URL and get an overall readiness score, separate SEO and AI-Answer scores, and a prioritized checklist of fixes.",
  },
  {
    title: "Structure & content checks",
    description:
      "Heading structure, direct short-answer blocks (40–80 words), FAQ sections, and core on-page signals.",
  },
  {
    title: "Entity SEO",
    description:
      "A dedicated Entity score: typed schema.org entities, named authors, sameAs identity links, brand-name consistency, and about/mentions relationships — the signals knowledge graphs use.",
  },
  {
    title: "Content templates",
    description:
      "Generate ready-to-use outlines with question-based headings and direct-answer blocks that work for both Google and AI answers.",
  },
  {
    title: "Dashboard & history",
    description:
      "Every page you analyze is saved locally so you can re-analyze and track progress over time.",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="py-16 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Make your content visible in both{" "}
          <span className="text-brand-600">Google and AI answers</span> — with one clear
          system.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Most content ranks on Google but never appears in ChatGPT, Perplexity, or AI
          Overviews. SearchReady shows exactly how ready your pages are for both — and
          tells you what to fix.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/analyze"
            className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Analyze a URL — free
          </Link>
          <Link
            href="/templates"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-600"
          >
            Generate a template
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">{f.title}</h2>
            <p className="mt-2 text-slate-600">{f.description}</p>
          </div>
        ))}
      </section>

      <section className="mt-16 rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-xl font-bold text-slate-900">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          <li className="rounded-lg bg-slate-50 p-4">
            <span className="font-bold text-brand-600">1.</span> Paste any public URL.
          </li>
          <li className="rounded-lg bg-slate-50 p-4">
            <span className="font-bold text-brand-600">2.</span> Get a unified readiness
            score in seconds — transparent, rule-based logic, no black-box scoring.
          </li>
          <li className="rounded-lg bg-slate-50 p-4">
            <span className="font-bold text-brand-600">3.</span> Work through the
            prioritized checklist, then re-analyze to measure progress.
          </li>
        </ol>
      </section>
    </div>
  );
}
