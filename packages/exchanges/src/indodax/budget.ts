export interface BudgetConfig {
  dailyBudgetIdr: number;
  /** Ms added to UTC to obtain the local day boundary. Defaults to Asia/Bangkok (WIB, +7h). */
  timezoneOffsetMs?: number;
}

export type BudgetNowFn = () => number;

const DAY_MS = 86_400_000;

export const WIB_OFFSET_MS = 7 * 3_600_000;

export class BudgetTracker {
  private spentToday = 0;
  private currentDay = -1;

  constructor(
    private readonly config: BudgetConfig,
    private readonly nowFn: BudgetNowFn = Date.now,
  ) {}

  private dayFor(now: number): number {
    return Math.floor((now + (this.config.timezoneOffsetMs ?? WIB_OFFSET_MS)) / DAY_MS);
  }

  private rollover(now: number): void {
    const day = this.dayFor(now);
    if (day !== this.currentDay) {
      this.currentDay = day;
      this.spentToday = 0;
    }
  }

  canSpend(amountIdr: number): boolean {
    if (!Number.isFinite(amountIdr) || amountIdr < 0) return false;
    this.rollover(this.nowFn());
    return this.spentToday + amountIdr <= this.config.dailyBudgetIdr;
  }

  spend(amountIdr: number): boolean {
    if (!this.canSpend(amountIdr)) return false;
    this.spentToday += amountIdr;
    return true;
  }

  spent(): number {
    this.rollover(this.nowFn());
    return this.spentToday;
  }

  remaining(): number {
    this.rollover(this.nowFn());
    return Math.max(0, this.config.dailyBudgetIdr - this.spentToday);
  }
}
