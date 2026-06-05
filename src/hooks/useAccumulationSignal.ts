export type AccumulationSignal = "accumulation" | "distribution" | "neutral";

export function getAccumulationSignal(
  volume: number | null | undefined,
  avgVolume: number | null | undefined,
  dayChangePct: number | null | undefined
): AccumulationSignal {
  if (!volume || !avgVolume || avgVolume === 0) return "neutral";
  const ratio = volume / avgVolume;
  if (ratio > 1.5 && (dayChangePct ?? 0) >= 0.5) return "accumulation";
  if (ratio > 1.5 && (dayChangePct ?? 0) <= -0.5) return "distribution";
  return "neutral";
}
