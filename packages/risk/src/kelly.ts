export function kellyFraction(winRate: number, payoffRatio: number, maxPosition: number): number {
  if (winRate <= 0 || winRate >= 1) return 0;
  if (payoffRatio <= 0) return 0;

  const fraction = (winRate * (payoffRatio + 1) - 1) / payoffRatio;
  if (fraction <= 0) return 0;

  return Math.min(fraction, maxPosition);
}
