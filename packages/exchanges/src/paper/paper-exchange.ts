import {
  InternalBalanceSchema,
  InternalOrderSchema,
  type InternalBalance,
  type InternalOrder,
  type OrderParams,
  type Ticker,
} from '@trading/core';
import type { Exchange } from '../interfaces.js';

export interface PaperExchangeConfig {
  balances: Record<string, number>;
  feeRate?: number;
  /**
   * Full bid-ask spread in basis points (1 bps = 0.01%), applied symmetrically
   * around the mid price. Market buys fill at ask, market sells at bid. Default 0.
   */
  spreadBps?: number;
}

interface PricePoint {
  price: number;
  timestamp: number;
}

function baseQuote(symbol: string): [string, string] {
  const [base, quote] = symbol.split('/');
  if (!base || !quote) {
    throw new Error(`Invalid symbol: ${symbol} (expected BASE/QUOTE)`);
  }
  return [base, quote];
}

/**
 * In-memory simulated exchange. No network, no real API. Prices are pushed in
 * via {@link PaperExchange.updatePrice} (typically driven by the replay/backtest
 * price feed) and treated as the mid price. If a `spreadBps` is configured, the
 * ticker exposes a bid/ask around the mid and market orders cross the spread
 * (buys at ask, sells at bid). Limit orders fill when the relevant side of the
 * book crosses them, otherwise rest as open and reserve the required balance.
 */
export class PaperExchange implements Exchange {
  readonly name = 'paper';

  private readonly feeRate: number;
  private readonly halfSpread: number;
  private readonly balances = new Map<string, { free: number; used: number }>();
  private readonly lastPrice = new Map<string, PricePoint>();
  private readonly positions = new Map<string, number>();
  private readonly orders = new Map<string, InternalOrder>();
  private idCounter = 0;

  constructor(config: PaperExchangeConfig) {
    this.feeRate = config.feeRate ?? 0;
    this.halfSpread = (config.spreadBps ?? 0) / 20000;
    for (const [asset, amount] of Object.entries(config.balances)) {
      if (amount < 0) throw new Error(`Negative initial balance for ${asset}`);
      this.balances.set(asset, { free: amount, used: 0 });
    }
  }

  updatePrice(symbol: string, price: number, timestamp: number): void {
    if (price <= 0) throw new Error(`Invalid price for ${symbol}: ${price}`);
    this.lastPrice.set(symbol, { price, timestamp });
    this.matchLimitOrders(symbol);
  }

  private midPrice(symbol: string): number {
    return this.lastPrice.get(symbol)?.price ?? 0;
  }

  private bidPrice(symbol: string): number {
    return this.midPrice(symbol) * (1 - this.halfSpread);
  }

  private askPrice(symbol: string): number {
    return this.midPrice(symbol) * (1 + this.halfSpread);
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    const point = this.lastPrice.get(symbol);
    if (!point) throw new Error(`No price known for ${symbol}`);
    return {
      symbol,
      bid: this.bidPrice(symbol),
      ask: this.askPrice(symbol),
      last: point.price,
      volume24h: 0,
      timestamp: point.timestamp,
    };
  }

  async fetchBalance(): Promise<InternalBalance[]> {
    const result: InternalBalance[] = [];
    for (const [asset, { free, used }] of this.balances) {
      const balance: InternalBalance = {
        asset,
        free,
        used,
        total: free + used,
      };
      result.push(InternalBalanceSchema.parse(balance));
    }
    return result;
  }

  async createOrder(params: OrderParams): Promise<InternalOrder> {
    const [base, quote] = baseQuote(params.symbol);
    const point = this.lastPrice.get(params.symbol);

    const limitPrice = params.type === 'limit' ? (params.price ?? 0) : 0;
    const crosses =
      params.type === 'limit' && point
        ? params.side === 'buy'
          ? this.askPrice(params.symbol) <= limitPrice
          : this.bidPrice(params.symbol) >= limitPrice
        : true;

    const fillPrice =
      params.type === 'limit'
        ? crosses && point
          ? params.side === 'buy'
            ? Math.min(this.askPrice(params.symbol), limitPrice)
            : Math.max(this.bidPrice(params.symbol), limitPrice)
          : limitPrice
        : params.side === 'buy'
          ? this.askPrice(params.symbol)
          : this.bidPrice(params.symbol);

    if (params.type === 'market' && !point) {
      return this.rejected(params);
    }

    const cost = fillPrice * params.quantity;
    const fee = cost * this.feeRate;

    if (params.side === 'buy') {
      const quoteBal = this.balances.get(quote) ?? { free: 0, used: 0 };
      if (quoteBal.free < cost + fee) {
        return this.rejected(params);
      }
    } else {
      const baseBal = this.balances.get(base) ?? { free: 0, used: 0 };
      if (baseBal.free < params.quantity) {
        return this.rejected(params);
      }
    }

    if (params.type === 'limit' && !crosses) {
      this.reserve(params, base, quote, fillPrice);
      return this.store(params, 'open', limitPrice, 0, null);
    }

    this.applyFill(params, base, quote, cost, fee);
    return this.store(params, 'filled', fillPrice, params.quantity, fillPrice);
  }

  async fetchOrder(clientOrderId: string): Promise<InternalOrder> {
    const order = this.orders.get(clientOrderId);
    if (!order) throw new Error(`Unknown clientOrderId: ${clientOrderId}`);
    return order;
  }

  async cancelOrder(clientOrderId: string): Promise<InternalOrder> {
    const order = this.orders.get(clientOrderId);
    if (!order) throw new Error(`Unknown clientOrderId: ${clientOrderId}`);
    if (order.status === 'filled' || order.status === 'rejected') {
      return order;
    }
    this.release(order);
    const canceled: InternalOrder = { ...order, status: 'canceled' };
    this.orders.set(clientOrderId, canceled);
    return canceled;
  }

  private reserve(params: OrderParams, base: string, quote: string, price: number): void {
    if (params.side === 'buy') {
      const need = price * params.quantity * (1 + this.feeRate);
      this.move(quote, need);
    } else {
      this.move(base, params.quantity);
    }
  }

  private release(order: InternalOrder): void {
    const [base, quote] = baseQuote(order.symbol);
    if (order.side === 'buy') {
      const freed = (order.price ?? 0) * order.quantity * (1 + this.feeRate);
      this.unmove(quote, freed);
    } else {
      this.unmove(base, order.quantity);
    }
  }

  private applyFill(
    params: OrderParams,
    base: string,
    quote: string,
    cost: number,
    fee: number,
  ): void {
    if (params.side === 'buy') {
      const quoteBal = this.balances.get(quote)!;
      this.balances.set(quote, {
        free: quoteBal.free - (cost + fee),
        used: quoteBal.used,
      });
      const baseBal = this.balances.get(base) ?? { free: 0, used: 0 };
      this.balances.set(base, { free: baseBal.free + params.quantity, used: baseBal.used });
      this.positions.set(base, (this.positions.get(base) ?? 0) + params.quantity);
    } else {
      const baseBal = this.balances.get(base)!;
      this.balances.set(base, {
        free: baseBal.free - params.quantity,
        used: baseBal.used,
      });
      const quoteBal = this.balances.get(quote) ?? { free: 0, used: 0 };
      this.balances.set(quote, { free: quoteBal.free + cost - fee, used: quoteBal.used });
      this.positions.set(base, (this.positions.get(base) ?? 0) - params.quantity);
    }
  }

  private matchLimitOrders(symbol: string): void {
    for (const order of this.orders.values()) {
      if (order.symbol !== symbol || order.status !== 'open') continue;
      const [base, quote] = baseQuote(symbol);
      const price = order.price!;
      const crosses =
        order.side === 'buy' ? this.askPrice(symbol) <= price : this.bidPrice(symbol) >= price;
      if (!crosses) continue;
      const fillPrice =
        order.side === 'buy'
          ? Math.min(this.askPrice(symbol), price)
          : Math.max(this.bidPrice(symbol), price);
      const cost = fillPrice * order.quantity;
      const fee = cost * this.feeRate;
      this.release(order);
      this.applyFill({ ...order, type: 'limit', price: fillPrice }, base, quote, cost, fee);
      this.orders.set(order.clientOrderId, {
        ...order,
        status: 'filled',
        price: fillPrice,
        filledQuantity: order.quantity,
        averagePrice: fillPrice,
      });
    }
  }

  private move(asset: string, amount: number): void {
    const bal = this.balances.get(asset) ?? { free: 0, used: 0 };
    bal.free -= amount;
    bal.used += amount;
    this.balances.set(asset, bal);
  }

  private unmove(asset: string, amount: number): void {
    const bal = this.balances.get(asset) ?? { free: 0, used: 0 };
    bal.free += amount;
    bal.used -= amount;
    this.balances.set(asset, bal);
  }

  private rejected(params: OrderParams): InternalOrder {
    return this.store(params, 'rejected', params.price ?? null, 0, null);
  }

  private store(
    params: OrderParams,
    status: InternalOrder['status'],
    price: number | null,
    filledQuantity: number,
    averagePrice: number | null,
  ): InternalOrder {
    const id = `paper-${++this.idCounter}`;
    const order: InternalOrder = {
      id,
      clientOrderId: params.clientOrderId,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      price,
      quantity: params.quantity,
      filledQuantity,
      averagePrice,
      status,
      timestamp: this.lastPrice.get(params.symbol)?.timestamp ?? Date.now(),
    };
    const parsed = InternalOrderSchema.parse(order);
    this.orders.set(params.clientOrderId, parsed);
    return parsed;
  }
}

export function createPaperExchange(config: PaperExchangeConfig): PaperExchange {
  return new PaperExchange(config);
}
