import type { InternalBalance, InternalOrder, OrderParams, Ticker } from '@trading/core';
import type { Exchange } from '../interfaces.js';
import {
  type CcxtLike,
  type RetryPolicy,
  type SleepFn,
  defaultRetryPolicy,
  defaultSleep,
  executeCreateWithRecovery,
  executeWithRetry,
  mapBalance,
  mapOrder,
  mapTicker,
} from './mapping.js';

/**
 * Indodax adapter over an injected CCXT client. The real `ccxt.indodax`
 * instance satisfies {@link CcxtLike}; tests inject a mock returning raw
 * CCXT-shaped responses. No network or live credentials are touched here.
 */
export class IndodaxExchange implements Exchange {
  readonly name = 'indodax';

  constructor(
    private readonly api: CcxtLike,
    private readonly policy: RetryPolicy = defaultRetryPolicy,
    private readonly sleep: SleepFn = defaultSleep,
  ) {}

  async fetchTicker(symbol: string): Promise<Ticker> {
    const raw = await executeWithRetry(() => this.api.fetchTicker(symbol), this.policy, this.sleep);
    return mapTicker(raw, symbol);
  }

  async fetchBalance(): Promise<InternalBalance[]> {
    const raw = await executeWithRetry(() => this.api.fetchBalance(), this.policy, this.sleep);
    return mapBalance(raw);
  }

  /**
   * ccxt's indodax wrapper derives the quote cost of a market buy from
   * `amount * price` and throws if no price is supplied. The engine normally
   * passes its reference price; when it doesn't, fall back to the live ticker
   * so a price-less market buy never reaches the wrapper in a broken state.
   */
  private async resolvePrice(params: OrderParams): Promise<number | undefined> {
    if (params.price !== undefined) return params.price;
    if (!(params.type === 'market' && params.side === 'buy')) return undefined;
    const ticker = await this.api.fetchTicker(params.symbol);
    const last = ticker.last ?? ticker.close;
    if (typeof last !== 'number' || last <= 0) {
      throw new Error(
        `createOrder: no reference price for ${params.symbol} market buy (ticker has no usable last/close)`,
      );
    }
    return last;
  }

  async createOrder(params: OrderParams): Promise<InternalOrder> {
    const submit = async () =>
      this.api.createOrder(
        params.symbol,
        params.type,
        params.side,
        params.quantity,
        await this.resolvePrice(params),
        { clientOrderId: params.clientOrderId },
      );
    const lookup = (clientOrderId: string) =>
      this.api.fetchOrder('', params.symbol, { clientOrderId });
    const raw = await executeCreateWithRecovery(
      submit,
      lookup,
      params.clientOrderId,
      this.policy,
      this.sleep,
    );
    return mapOrder(raw, params.clientOrderId);
  }

  async fetchOrder(clientOrderId: string): Promise<InternalOrder> {
    const raw = await executeWithRetry(
      () => this.api.fetchOrder('', undefined, { clientOrderId }),
      this.policy,
      this.sleep,
    );
    return mapOrder(raw, clientOrderId);
  }

  async cancelOrder(clientOrderId: string): Promise<InternalOrder> {
    const raw = await executeWithRetry(
      () => this.api.cancelOrder('', undefined, { clientOrderId }),
      this.policy,
      this.sleep,
    );
    return mapOrder(raw, clientOrderId);
  }
}

export function createIndodaxExchange(
  api: CcxtLike,
  policy?: RetryPolicy,
  sleep?: SleepFn,
): IndodaxExchange {
  return new IndodaxExchange(api, policy, sleep);
}
