import { describe, expect, it } from 'vitest';
import { buildClientOrderId, isOwnedOrder } from '../indodax/ownership.js';
describe('order ownership', () => {
    it('builds an AG-prefixed clientOrderId that round-trips', () => {
        const id = buildClientOrderId('abc123', 7);
        expect(id).toBe('AG-abc123-7');
        expect(isOwnedOrder(id, 'abc123')).toBe(true);
    });
    it('rejects ids from other owners and random ids', () => {
        expect(isOwnedOrder(buildClientOrderId('other', 1), 'abc123')).toBe(false);
        expect(isOwnedOrder('bt-1', 'abc123')).toBe(false);
        expect(isOwnedOrder('AG-abc123', 'abc123')).toBe(false);
        expect(isOwnedOrder('', 'abc123')).toBe(false);
    });
});
//# sourceMappingURL=indodax.ownership.test.js.map