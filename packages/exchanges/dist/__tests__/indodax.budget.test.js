import { describe, expect, it } from 'vitest';
import { BudgetTracker } from '../indodax/budget.js';
const WIB_OFFSET_MS = 7 * 3_600_000;
describe('BudgetTracker', () => {
    it('allows spends under the daily IDR cap and rejects beyond it', () => {
        const now = 1_700_000_000_000;
        const budget = new BudgetTracker({ dailyBudgetIdr: 1_000_000 }, () => now);
        expect(budget.canSpend(999_999)).toBe(true);
        expect(budget.spend(400_000)).toBe(true);
        expect(budget.spend(600_000)).toBe(true);
        expect(budget.spend(1)).toBe(false);
        expect(budget.spent()).toBe(1_000_000);
        expect(budget.remaining()).toBe(0);
    });
    it('rejects NaN and negative spends without accumulating them', () => {
        const now = 1_700_000_000_000;
        const budget = new BudgetTracker({ dailyBudgetIdr: 1_000_000 }, () => now);
        expect(budget.canSpend(Number.NaN)).toBe(false);
        expect(budget.spend(Number.NaN)).toBe(false);
        expect(budget.spend(-5)).toBe(false);
        expect(budget.spent()).toBe(0);
    });
    it('resets spending at the WIB day boundary', () => {
        let now = 1_700_000_000_000;
        const budget = new BudgetTracker({ dailyBudgetIdr: 1_000_000 }, () => now);
        const wibDate = new Date(now + WIB_OFFSET_MS);
        const wibMidnight = new Date(wibDate.getFullYear(), wibDate.getMonth(), wibDate.getDate()).getTime();
        now = wibMidnight - WIB_OFFSET_MS - 60_000;
        expect(budget.spend(900_000)).toBe(true);
        expect(budget.spent()).toBe(900_000);
        now = wibMidnight - WIB_OFFSET_MS + 60_000;
        expect(budget.spend(900_000)).toBe(true);
        expect(budget.spent()).toBe(900_000);
    });
});
//# sourceMappingURL=indodax.budget.test.js.map