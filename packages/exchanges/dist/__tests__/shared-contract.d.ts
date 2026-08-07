import type { Exchange } from '../interfaces.js';
/**
 * Shared Exchange-contract assertions run against every adapter. Verifies the
 * canonical internal shapes and that `clientOrderId` round-trips through
 * create/fetch. Adapter-specific setup (seeding a price, mocking CCXT) is the
 * caller's responsibility; the returned exchange must be ready to trade the
 * symbol `BTC/IDR`.
 */
export declare function runExchangeContract(name: string, makeReady: () => Exchange): void;
//# sourceMappingURL=shared-contract.d.ts.map