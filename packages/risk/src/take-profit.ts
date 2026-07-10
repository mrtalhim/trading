export function atrTakeProfit(entryPrice: number, atrValue: number, multiplier: number): number {
  return entryPrice + atrValue * multiplier;
}
