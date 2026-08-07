export interface BudgetConfig {
    dailyBudgetIdr: number;
    /** Ms added to UTC to obtain the local day boundary. Defaults to Asia/Bangkok (WIB, +7h). */
    timezoneOffsetMs?: number;
}
export type BudgetNowFn = () => number;
export declare const WIB_OFFSET_MS: number;
export declare class BudgetTracker {
    private readonly config;
    private readonly nowFn;
    private spentToday;
    private currentDay;
    constructor(config: BudgetConfig, nowFn?: BudgetNowFn);
    private dayFor;
    private rollover;
    canSpend(amountIdr: number): boolean;
    spend(amountIdr: number): boolean;
    spent(): number;
    remaining(): number;
}
//# sourceMappingURL=budget.d.ts.map