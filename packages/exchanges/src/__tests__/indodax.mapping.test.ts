import { describe, it, expect } from 'vitest';
import { mapBalance, mapOrder, mapTicker } from '../indodax/mapping.js';
import type { CcxtLikeOrder } from '../indodax/mapping.js';
import { InternalBalanceSchema, InternalOrderSchema, TickerSchema } from '@trading/core';

describe('mapTicker', () => {
  it('maps a raw CCXT ticker into a valid Ticker', () => {
    const raw = {
      symbol: 'BTC/IDR',
      last: 100_000_000,
      bid: 99_000_000,
      ask: 101_000_000,
      timestamp: 123,
      baseVolume: 55,
    };
    const ticker = mapTicker(raw, 'BTC/IDR');
    expect(() => TickerSchema.parse(ticker)).not.toThrow();
    expect(ticker).toMatchObject({
      symbol: 'BTC/IDR',
      last: 100_000_000,
      bid: 99_000_000,
      ask: 101_000_000,
      timestamp: 123,
      volume24h: 55,
    });
  });

  it('falls back to close when last is missing', () => {
    const ticker = mapTicker({ close: 42, timestamp: 1 } as never, 'ETH/IDR');
    expect(ticker.last).toBe(42);
  });
});

describe('mapBalance', () => {
  it('maps raw CCXT balances into valid InternalBalance[]', () => {
    const raw = {
      free: { IDR: 1_000_000, BTC: 0.5 },
      used: { IDR: 0, BTC: 0.1 },
      total: { IDR: 1_000_000, BTC: 0.6 },
    };
    const balances = mapBalance(raw);
    expect(Array.isArray(balances)).toBe(true);
    for (const b of balances) expect(() => InternalBalanceSchema.parse(b)).not.toThrow();
    const btc = balances.find((b) => b.asset === 'BTC');
    expect(btc).toMatchObject({ free: 0.5, used: 0.1, total: 0.6 });
  });

  it('sums free + used when total is missing', () => {
    const raw = {
      free: { IDR: 800_000, BTC: 0.5 },
      used: { BTC: 0.2 },
    };
    const balances = mapBalance(raw);
    const btc = balances.find((b) => b.asset === 'BTC');
    const idr = balances.find((b) => b.asset === 'IDR');
    expect(btc).toMatchObject({ free: 0.5, used: 0.2, total: 0.7 });
    expect(idr).toMatchObject({ free: 800_000, used: 0, total: 800_000 });
  });
});

describe('mapOrder', () => {
  it('maps a closed order and round-trips clientOrderId', () => {
    const raw: CcxtLikeOrder = {
      id: 'exchange-1',
      clientOrderId: 'my-cid',
      symbol: 'BTC/IDR',
      type: 'market',
      side: 'buy',
      amount: 0.002,
      price: 100_000_000,
      filled: 0.002,
      remaining: 0,
      status: 'closed',
      timestamp: 9,
      average: 100_000_000,
    };
    const order = mapOrder(raw, 'my-cid');
    expect(() => InternalOrderSchema.parse(order)).not.toThrow();
    expect(order.clientOrderId).toBe('my-cid');
    expect(order.status).toBe('filled');
    expect(order.filledQuantity).toBe(0.002);
  });

  it('maps a partial fill status', () => {
    const raw: CcxtLikeOrder = {
      clientOrderId: 'cid-partial',
      symbol: 'BTC/IDR',
      type: 'limit',
      side: 'sell',
      amount: 0.01,
      price: 110_000_000,
      filled: 0.004,
      remaining: 0.006,
      status: 'partial',
      timestamp: 1,
      average: 110_000_000,
    };
    const order = mapOrder(raw, 'cid-partial');
    expect(order.status).toBe('partially_filled');
    expect(order.filledQuantity).toBe(0.004);
  });

  it('maps a canceled order', () => {
    const raw: CcxtLikeOrder = {
      clientOrderId: 'cid-cancel',
      symbol: 'BTC/IDR',
      amount: 1,
      status: 'canceled',
    };
    const order = mapOrder(raw, 'cid-cancel');
    expect(order.status).toBe('canceled');
  });
});
