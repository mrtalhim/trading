import {
  InternalBalanceSchema,
  InternalOrderSchema,
  type InternalBalance,
  type InternalOrder,
  type OrderSide,
  type OrderStatus,
  type OrderType,
  type Ticker,
} from '@trading/core';

/** Minimal subset of a CCXT exchange client we depend on. Real `ccxt.indodax`
 *  satisfies this; tests inject a mock returning raw CCXT-shaped responses. */
export interface CcxtLikeTicker {
  symbol?: string;
  bid?: number;
  ask?: number;
  last?: number;
  close?: number;
  timestamp?: number;
  baseVolume?: number;
  quoteVolume?: number;
}

export interface CcxtLikeBalance {
  free?: Record<string, number>;
  used?: Record<string, number>;
  total?: Record<string, number>;
  info?: unknown;
}

export interface CcxtLikeOrder {
  id?: string;
  clientOrderId?: string;
  symbol?: string;
  type?: string;
  side?: string;
  price?: number;
  amount?: number;
  filled?: number;
  remaining?: number;
  status?: string;
  timestamp?: number;
  average?: number;
  info?: unknown;
}

export interface CcxtLike {
  fetchTicker(symbol: string): Promise<CcxtLikeTicker>;
  fetchBalance(): Promise<CcxtLikeBalance>;
  createOrder(
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price?: number,
    params?: Record<string, unknown>,
  ): Promise<CcxtLikeOrder>;
  fetchOrder(id: string, symbol?: string, params?: Record<string, unknown>): Promise<CcxtLikeOrder>;
  cancelOrder(
    id: string,
    symbol?: string,
    params?: Record<string, unknown>,
  ): Promise<CcxtLikeOrder>;
}

const STATUS_MAP: Record<string, OrderStatus> = {
  open: 'open',
  closed: 'filled',
  filled: 'filled',
  canceled: 'canceled',
  cancelled: 'canceled',
  partial: 'partially_filled',
  partially_filled: 'partially_filled',
  rejected: 'rejected',
  expired: 'rejected',
};

export function mapTicker(raw: CcxtLikeTicker, symbol: string): Ticker {
  const last = raw.last ?? raw.close;
  if (typeof last !== 'number') throw new Error('ticker missing last price');
  const bid = typeof raw.bid === 'number' ? raw.bid : last;
  const ask = typeof raw.ask === 'number' ? raw.ask : last;
  return {
    symbol,
    bid,
    ask,
    last,
    volume24h: raw.baseVolume ?? 0,
    timestamp: raw.timestamp ?? 0,
  };
}

export function mapBalance(raw: CcxtLikeBalance): InternalBalance[] {
  const free = raw.free ?? {};
  const used = raw.used ?? {};
  const total = raw.total ?? {};
  const assets = new Set([...Object.keys(free), ...Object.keys(used), ...Object.keys(total)]);
  const result: InternalBalance[] = [];
  for (const asset of assets) {
    const balance: InternalBalance = {
      asset,
      free: free[asset] ?? 0,
      used: used[asset] ?? 0,
      total: total[asset] ?? free[asset] ?? 0 + (used[asset] ?? 0),
    };
    result.push(InternalBalanceSchema.parse(balance));
  }
  return result;
}

export function mapOrder(raw: CcxtLikeOrder, clientOrderId: string): InternalOrder {
  const status = STATUS_MAP[(raw.status ?? 'open').toLowerCase()] ?? 'open';
  const side = (raw.side?.toLowerCase() ?? 'buy') as OrderSide;
  const type = (raw.type?.toLowerCase() ?? 'market') as OrderType;
  const quantity = raw.amount ?? 0;
  const order: InternalOrder = {
    id: raw.id ?? clientOrderId,
    clientOrderId: raw.clientOrderId ?? clientOrderId,
    symbol: raw.symbol ?? '',
    side,
    type,
    price: typeof raw.price === 'number' && raw.price > 0 ? raw.price : null,
    quantity,
    filledQuantity: raw.filled ?? 0,
    averagePrice: typeof raw.average === 'number' && raw.average > 0 ? raw.average : null,
    status,
    timestamp: raw.timestamp ?? 0,
  };
  return InternalOrderSchema.parse(order);
}

export type CcxtErrorKind =
  'rate_limit' | 'server' | 'unauthorized' | 'signature' | 'timeout' | 'unknown';

export interface CcxtError extends Error {
  httpStatus?: number;
  code?: string;
}

export function classifyCcxtError(err: unknown): CcxtErrorKind {
  const e = err as CcxtError;
  const status = e?.httpStatus;
  const message = (e?.message ?? '').toLowerCase();
  const code = e?.code ?? '';

  if (status === 401) return 'unauthorized';
  if (/signature|invalid sign|sign\s*error/i.test(message)) return 'signature';
  if (status === 429) return 'rate_limit';
  if (typeof status === 'number' && status >= 500) return 'server';
  if (/timed out|timeout|etimedout/i.test(message) || code === 'ETIMEDOUT') {
    return 'timeout';
  }
  return 'unknown';
}

export class CcxtFatalError extends Error {
  constructor(
    message: string,
    public readonly kind: Extract<CcxtErrorKind, 'unauthorized' | 'signature'>,
  ) {
    super(message);
    this.name = 'CcxtFatalError';
  }
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const defaultRetryPolicy: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 250,
  maxDelayMs: 8000,
};

export type SleepFn = (ms: number) => Promise<void>;

export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delayFor(attempt: number, policy: RetryPolicy): number {
  const exponential = policy.baseDelayMs * 2 ** attempt;
  return Math.min(exponential, policy.maxDelayMs);
}

/**
 * Retries on rate-limit (429) and server (5xx) errors with exponential
 * backoff. Fatal errors (401, signature) and unknown errors are not retried.
 * A post-submit timeout is surfaced to the caller (who should look the order
 * up by clientOrderId) rather than blindly retried.
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = defaultRetryPolicy,
  sleep: SleepFn = defaultSleep,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const kind = classifyCcxtError(err);
      if (kind === 'unauthorized') {
        throw new CcxtFatalError((err as Error).message, 'unauthorized');
      }
      if (kind === 'signature') {
        throw new CcxtFatalError((err as Error).message, 'signature');
      }
      if (kind === 'unknown' || kind === 'timeout') {
        throw err;
      }
      if (attempt >= policy.maxRetries) {
        throw err;
      }
      await sleep(delayFor(attempt, policy));
      attempt += 1;
    }
  }
}

/**
 * Submits a create-order call, recovering from a post-submit timeout by looking
 * the order up via its clientOrderId instead of blind-retrying the submit.
 */
export async function executeCreateWithRecovery<T>(
  submit: () => Promise<T>,
  lookup: (clientOrderId: string) => Promise<T>,
  clientOrderId: string,
  policy: RetryPolicy = defaultRetryPolicy,
  sleep: SleepFn = defaultSleep,
): Promise<T> {
  try {
    return await executeWithRetry(submit, policy, sleep);
  } catch (err) {
    if (classifyCcxtError(err) === 'timeout') {
      return lookup(clientOrderId);
    }
    throw err;
  }
}
