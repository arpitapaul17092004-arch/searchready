interface ScoreCardProps {
  label: string;
  score: number;
  accent?: "brand" | "green" | "amber" | "red";
}

function colorFor(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 65) return "bg-brand-600";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function ringFor(score: number): string {
  if (score >= 85) return "text-emerald-600";
  if (score >= 65) return "text-brand-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

export default function ScoreCard({ label, score }: ScoreCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
      <div
        className={`text-4xl font-extrabold tabular-nums ${ringFor(score)}`}
        aria-label={`${label}: ${score} out of 100`}
      >
        {score}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${colorFor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="mt-3 text-sm font-medium text-slate-500">{label}</div>
    </div>
  );
}
