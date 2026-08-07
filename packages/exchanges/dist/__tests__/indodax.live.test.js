import { describe, expect, it } from 'vitest';
import { createLiveIndodax } from '../indodax/live.js';
describe('createLiveIndodax (no network on construction)', () => {
    it('builds an adapter over a real ccxt.indodax client with dummy creds', () => {
        const live = createLiveIndodax({ apiKey: 'dummy', secret: 'dummy' });
        expect(live.exchange.name).toBe('indodax');
        expect(typeof live.fetchServerTime).toBe('function');
    });
});
//# sourceMappingURL=indodax.live.test.js.map