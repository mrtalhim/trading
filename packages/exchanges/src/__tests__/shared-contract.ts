import { describe, it, expect } from 'vitest';
import { InternalBalanceSchema, InternalOrderSchema, TickerSchema } from '@trading/core';
import type { Exchange } from '../interfaces.js';

/**
 * Shared Exchange-contract assertions run against every adapter. Verifies the
 * canonical internal shapes and that `clientOrderId` round-trips through
 * create/fetch. Adapter-specific setup (seeding a price, mocking CCXT) is the
 * caller's responsibility; the returned exchange must be ready to trade the
 * symbol `BTC/IDR`.
 */
export function runExchangeContract(name: string, makeReady: () => Exchange): void {
  const symbol = 'BTC/IDR';

  describe(`${name} satisfies the Exchange contract`, () => {
    it('fetchTicker returns a valid Ticker', async () => {
      const ex = makeReady();
      const ticker = await ex.fetchTicker(symbol);
      expect(() => TickerSchema.parse(ticker)).not.toThrow();
      expect(ticker.symbol).toBe(symbol);
      expect(ticker.last).toBeGreaterThan(0);
      expect(ticker.bid).toBeGreaterThan(0);
      expect(ticker.ask).toBeGreaterThan(0);
    });

    it('fetchBalance returns valid InternalBalance[]', async () => {
      const ex = makeReady();
      const balances = await ex.fetchBalance();
      expect(Array.isArray(balances)).toBe(true);
      for (const b of balances) {
        expect(() => InternalBalanceSchema.parse(b)).not.toThrow();
      }
    });

    it('createOrder returns a valid InternalOrder with clientOrderId round-trip', async () => {
      const ex = makeReady();
      const order = await ex.createOrder({
        symbol,
        side: 'buy',
        type: 'market',
        quantity: 0.001,
        clientOrderId: 'cid-contract-1',
      });
      expect(() => InternalOrderSchema.parse(order)).not.toThrow();
      expect(order.clientOrderId).toBe('cid-contract-1');
    });

    it('fetchOrder returns the same order by clientOrderId', async () => {
      const ex = makeReady();
      const created = await ex.createOrder({
        symbol,
        side: 'buy',
        type: 'market',
        quantity: 0.001,
        clientOrderId: 'cid-contract-2',
      });
      const fetched = await ex.fetchOrder(created.clientOrderId);
      expect(fetched.clientOrderId).toBe(created.clientOrderId);
    });
  });
}
