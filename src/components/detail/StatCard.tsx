interface Props {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "gain" | "loss";
}

export function StatCard({ label, value, hint, tone = "default" }: Props) {
  const toneClass =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 creative:gradient-card creative:shadow-soft minimal:rounded-none minimal:border-0 minimal:border-b minimal:bg-transparent minimal:p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-base font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
