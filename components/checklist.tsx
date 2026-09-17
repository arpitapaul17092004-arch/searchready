import type { ChecklistItem } from "@/lib/analysis";

const impactStyles: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const categoryStyles: Record<string, string> = {
  seo: "bg-brand-50 text-brand-700",
  ai: "bg-violet-50 text-violet-700",
};

export default function Checklist({ items }: { items: ChecklistItem[] }) {
  const ordered = [...items].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    if (a.passed !== b.passed) return a.passed ? 1 : -1;
    return rank[a.impact] - rank[b.impact];
  });

  return (
    <ul className="space-y-3">
      {ordered.map((item) => (
        <li
          key={item.id}
          className={`rounded-xl border p-4 ${
            item.passed ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span aria-hidden className="text-lg">
              {item.passed ? "✅" : "⬜"}
            </span>
            <h3 className="font-semibold text-slate-900">{item.title}</h3>
            {!item.passed && (
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${impactStyles[item.impact]}`}
              >
                {item.impact} impact
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryStyles[item.category]}`}>
              {item.category === "seo" ? "SEO" : "AI answer"}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          {!item.passed && (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Fix: </span>
              {item.fix}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
