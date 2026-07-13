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

  async createOrder(params: OrderParams): Promise<InternalOrder> {
    const submit = () =>
      this.api.createOrder(params.symbol, params.type, params.side, params.quantity, params.price, {
        clientOrderId: params.clientOrderId,
      });
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
