export function atrStopLoss(entryPrice: number, atrValue: number, multiplier: number): number {
  return entryPrice - atrValue * multiplier;
}
