export interface SizingConfig {
  fraction: number;
  minNotional?: number;
}

export function positionSize(portfolioValue: number, cash: number, config: SizingConfig): number {
  if (cash <= 0) return 0;

  const desired = portfolioValue * config.fraction;
  const clamped = Math.min(desired, cash);

  if (config.minNotional !== undefined && clamped < config.minNotional) {
    return config.minNotional;
  }

  return clamped;
}
