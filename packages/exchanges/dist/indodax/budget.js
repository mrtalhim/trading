const DAY_MS = 86_400_000;
export const WIB_OFFSET_MS = 7 * 3_600_000;
export class BudgetTracker {
    config;
    nowFn;
    spentToday = 0;
    currentDay = -1;
    constructor(config, nowFn = Date.now) {
        this.config = config;
        this.nowFn = nowFn;
    }
    dayFor(now) {
        return Math.floor((now + (this.config.timezoneOffsetMs ?? WIB_OFFSET_MS)) / DAY_MS);
    }
    rollover(now) {
        const day = this.dayFor(now);
        if (day !== this.currentDay) {
            this.currentDay = day;
            this.spentToday = 0;
        }
    }
    canSpend(amountIdr) {
        if (!Number.isFinite(amountIdr) || amountIdr < 0)
            return false;
        this.rollover(this.nowFn());
        return this.spentToday + amountIdr <= this.config.dailyBudgetIdr;
    }
    spend(amountIdr) {
        if (!this.canSpend(amountIdr))
            return false;
        this.spentToday += amountIdr;
        return true;
    }
    spent() {
        this.rollover(this.nowFn());
        return this.spentToday;
    }
    remaining() {
        this.rollover(this.nowFn());
        return Math.max(0, this.config.dailyBudgetIdr - this.spentToday);
    }
}
//# sourceMappingURL=budget.js.map