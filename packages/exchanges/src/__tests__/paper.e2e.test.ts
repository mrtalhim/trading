import { describe, it, expect } from 'vitest';
import { createPaperExchange } from '../paper/paper-exchange.js';
import { InternalBalanceSchema, InternalOrderSchema } from '@trading/core';

const SYMBOL = 'BTC/IDR';
const PRICE = 100_000_000;

function makeExchange() {
  const ex = createPaperExchange({
    balances: { IDR: 1_000_000_000, BTC: 0 },
    feeRate: 0.001,
  });
  ex.updatePrice(SYMBOL, PRICE, 1000);
  return ex;
}

describe('PaperExchange end-to-end', () => {
  it('fills a market buy, debits cash + fee, credits base, and is queryable', async () => {
    const ex = makeExchange();

    const order = await ex.createOrder({
      symbol: SYMBOL,
      side: 'buy',
      type: 'market',
      quantity: 0.001,
      clientOrderId: 'e2e-buy-1',
    });

    expect(() => InternalOrderSchema.parse(order)).not.toThrow();
    expect(order.status).toBe('filled');
    expect(order.filledQuantity).toBe(0.001);
    expect(order.averagePrice).toBe(PRICE);

    const balances = await ex.fetchBalance();
    for (const b of balances) expect(() => InternalBalanceSchema.parse(b)).not.toThrow();
    const idr = balances.find((b) => b.asset === 'IDR')!;
    const btc = balances.find((b) => b.asset === 'BTC')!;

    const expectedCost = PRICE * 0.001;
    const expectedFee = expectedCost * 0.001;
    expect(btc.free).toBeCloseTo(0.001, 12);
    expect(idr.free).toBeCloseTo(1_000_000_000 - expectedCost - expectedFee, 4);

    const fetched = await ex.fetchOrder('e2e-buy-1');
    expect(fetched.clientOrderId).toBe('e2e-buy-1');
    expect(fetched.status).toBe('filled');
  });

  it('rejects an order with insufficient balance', async () => {
    const ex = makeExchange();
    const order = await ex.createOrder({
      symbol: SYMBOL,
      side: 'buy',
      type: 'market',
      quantity: 100,
      clientOrderId: 'e2e-too-big',
    });
    expect(order.status).toBe('rejected');
    const balances = await ex.fetchBalance();
    const idr = balances.find((b) => b.asset === 'IDR')!;
    expect(idr.free).toBe(1_000_000_000);
  });

  it('rests a limit order and fills it when price crosses', async () => {
    const ex = makeExchange();

    const limit = await ex.createOrder({
      symbol: SYMBOL,
      side: 'buy',
      type: 'limit',
      quantity: 0.002,
      price: 50_000_000,
      clientOrderId: 'e2e-limit-1',
    });
    expect(limit.status).toBe('open');

    const reserved = await ex.fetchBalance();
    const idrReserved = reserved.find((b) => b.asset === 'IDR')!;
    expect(idrReserved.used).toBeGreaterThan(0);

    ex.updatePrice(SYMBOL, 50_000_000, 2000);
    const filled = await ex.fetchOrder('e2e-limit-1');
    expect(filled.status).toBe('filled');
    expect(filled.filledQuantity).toBe(0.002);
  });

  it('cancels an open limit order and releases the reserved balance', async () => {
    const ex = makeExchange();
    await ex.createOrder({
      symbol: SYMBOL,
      side: 'buy',
      type: 'limit',
      quantity: 0.002,
      price: 50_000_000,
      clientOrderId: 'e2e-limit-cancel',
    });
    const canceled = await ex.cancelOrder('e2e-limit-cancel');
    expect(canceled.status).toBe('canceled');

    const balances = await ex.fetchBalance();
    const idr = balances.find((b) => b.asset === 'IDR')!;
    expect(idr.used).toBe(0);
    expect(idr.free).toBe(1_000_000_000);
  });

  it('is deterministic across two identical runs', async () => {
    function run(): Promise<{ btc: number; idr: number }> {
      return (async () => {
        const ex = makeExchange();
        await ex.createOrder({
          symbol: SYMBOL,
          side: 'buy',
          type: 'market',
          quantity: 0.001,
          clientOrderId: 'e2e-det',
        });
        const balances = await ex.fetchBalance();
        return {
          btc: balances.find((b) => b.asset === 'BTC')!.free,
          idr: balances.find((b) => b.asset === 'IDR')!.free,
        };
      })();
    }
    const a = await run();
    const b = await run();
    expect(a).toEqual(b);
  });
});
