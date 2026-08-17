import { describe, it, expect, vi } from 'vitest';
import type { CcxtLike, CcxtLikeOrder, CcxtLikeTicker } from '../indodax/mapping.js';
import { IndodaxExchange } from '../indodax/indodax-exchange.js';

const SYMBOL = 'BTC/IDR';

function makeApi(overrides: {
  fetchTicker?: () => Promise<CcxtLikeTicker>;
  createOrder?: (
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price: number | undefined,
  ) => Promise<CcxtLikeOrder>;
}): { api: CcxtLike; calls: { fetchTicker: number; createOrder: number; lastPrice?: number } } {
  const calls = { fetchTicker: 0, createOrder: 0, lastPrice: undefined as number | undefined };
  const api: CcxtLike = {
    fetchTicker: async () => {
      calls.fetchTicker += 1;
      if (overrides.fetchTicker) return overrides.fetchTicker();
      return { symbol: SYMBOL, last: 50_000_000, timestamp: 0 };
    },
    fetchBalance: async () => ({ free: { IDR: 1_000_000_000 }, total: { IDR: 1_000_000_000 } }),
    createOrder: async (symbol, type, side, amount, price, params) => {
      calls.createOrder += 1;
      calls.lastPrice = price;
      if (overrides.createOrder) {
        return overrides.createOrder(symbol, type, side, amount, price);
      }
      return {
        id: 'x',
        clientOrderId: (params?.clientOrderId as string) ?? 'cid',
        symbol,
        type,
        side,
        amount,
        price: price ?? 50_000_000,
        filled: amount,
        status: 'closed',
        timestamp: 0,
        average: price ?? 50_000_000,
      };
    },
    fetchOrder: async () => {
      throw new Error('unexpected fetchOrder');
    },
    cancelOrder: async () => {
      throw new Error('unexpected cancelOrder');
    },
    fetchOpenOrders: async () => [],
    fetchClosedOrders: async () => [],
  };
  return { api, calls };
}

describe('IndodaxExchange market-buy reference price', () => {
  it('derives a reference price from the ticker when none is supplied', async () => {
    const { api, calls } = makeApi({});
    const ex = new IndodaxExchange(api);
    const order = await ex.createOrder({
      symbol: SYMBOL,
      side: 'buy',
      type: 'market',
      quantity: 0.001,
      clientOrderId: 'cid-buy-ticker',
    });
    expect(calls.fetchTicker).toBe(1);
    expect(calls.lastPrice).toBe(50_000_000);
    expect(order.clientOrderId).toBe('cid-buy-ticker');
  });

  it('passes an explicit price straight through without touching the ticker', async () => {
    const { api, calls } = makeApi({});
    const ex = new IndodaxExchange(api);
    await ex.createOrder({
      symbol: SYMBOL,
      side: 'buy',
      type: 'market',
      quantity: 0.001,
      price: 48_000_000,
      clientOrderId: 'cid-buy-price',
    });
    expect(calls.fetchTicker).toBe(0);
    expect(calls.lastPrice).toBe(48_000_000);
  });

  it('does not touch the ticker for market sells', async () => {
    const { api, calls } = makeApi({});
    const ex = new IndodaxExchange(api);
    await ex.createOrder({
      symbol: SYMBOL,
      side: 'sell',
      type: 'market',
      quantity: 0.001,
      clientOrderId: 'cid-sell',
    });
    expect(calls.fetchTicker).toBe(0);
    expect(calls.lastPrice).toBeUndefined();
  });

  it('rejects a market buy when the ticker has no usable price', async () => {
    const { api, calls } = makeApi({
      fetchTicker: async () => ({ symbol: SYMBOL, timestamp: 0 }),
    });
    const ex = new IndodaxExchange(api);
    await expect(
      ex.createOrder({
        symbol: SYMBOL,
        side: 'buy',
        type: 'market',
        quantity: 0.001,
        clientOrderId: 'cid-buy-bad-ticker',
      }),
    ).rejects.toThrow(/no reference price/);
    expect(calls.fetchTicker).toBe(1);
    expect(calls.createOrder).toBe(0);
  });

  it('retries a transient ticker failure before submitting', async () => {
    const rateLimit = Object.assign(new Error('Too Many Requests'), { httpStatus: 429 });
    const { api, calls } = makeApi({
      fetchTicker: vi.fn().mockRejectedValueOnce(rateLimit).mockResolvedValueOnce({
        symbol: SYMBOL,
        last: 51_000_000,
        timestamp: 0,
      }),
    });
    const sleep = vi.fn(async () => {});
    const ex = new IndodaxExchange(api, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 }, sleep);
    await ex.createOrder({
      symbol: SYMBOL,
      side: 'buy',
      type: 'market',
      quantity: 0.001,
      clientOrderId: 'cid-buy-ticker-retry',
    });
    expect(calls.fetchTicker).toBe(2);
    expect(calls.lastPrice).toBe(51_000_000);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
