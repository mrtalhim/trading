import type { CcxtLike, CcxtLikeOrder } from '../indodax/mapping.js';
import { IndodaxExchange } from '../indodax/indodax-exchange.js';
import type { Exchange } from '../interfaces.js';
import { runExchangeContract } from './shared-contract.js';

const SYMBOL = 'BTC/IDR';

export function makeMockApi(orders: Map<string, CcxtLikeOrder> = new Map()): CcxtLike {
  return {
    fetchTicker: async () => ({
      symbol: SYMBOL,
      last: 100_000_000,
      bid: 99_000_000,
      ask: 101_000_000,
      timestamp: 0,
      baseVolume: 1234,
    }),
    fetchBalance: async () => ({
      free: { IDR: 1_000_000_000, BTC: 0 },
      used: {},
      total: { IDR: 1_000_000_000, BTC: 0 },
    }),
    createOrder: async (_symbol, _type, side, amount, price, params) => {
      const clientOrderId = (params?.clientOrderId as string) ?? '';
      const order: CcxtLikeOrder = {
        id: `x-${clientOrderId}`,
        clientOrderId,
        symbol: SYMBOL,
        type: _type,
        side,
        amount,
        price: price ?? 100_000_000,
        filled: amount,
        remaining: 0,
        status: 'closed',
        timestamp: 0,
        average: price ?? 100_000_000,
      };
      orders.set(clientOrderId, order);
      return order;
    },
    fetchOrder: async (_id, _symbol, params) => {
      const clientOrderId = params?.clientOrderId as string;
      const order = orders.get(clientOrderId);
      if (!order) throw new Error('order not found');
      return order;
    },
    cancelOrder: async (_id, _symbol, params) => {
      const clientOrderId = params?.clientOrderId as string;
      const existing = orders.get(clientOrderId);
      if (!existing) throw new Error('order not found');
      const canceled: CcxtLikeOrder = { ...existing, status: 'canceled' };
      orders.set(clientOrderId, canceled);
      return canceled;
    },
    fetchOpenOrders: async () => [],
    fetchClosedOrders: async () => [],
  };
}

runExchangeContract('indodax(mock)', () => {
  const orders = new Map<string, CcxtLikeOrder>();
  return new IndodaxExchange(makeMockApi(orders)) as Exchange;
});
