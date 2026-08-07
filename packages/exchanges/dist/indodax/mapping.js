import { InternalBalanceSchema, InternalOrderSchema, } from '@trading/core';
const STATUS_MAP = {
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
export function mapTicker(raw, symbol) {
    const last = raw.last ?? raw.close;
    if (typeof last !== 'number')
        throw new Error('ticker missing last price');
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
export function mapBalance(raw) {
    const free = raw.free ?? {};
    const used = raw.used ?? {};
    const total = raw.total ?? {};
    const assets = new Set([...Object.keys(free), ...Object.keys(used), ...Object.keys(total)]);
    const result = [];
    for (const asset of assets) {
        const balance = {
            asset,
            free: free[asset] ?? 0,
            used: used[asset] ?? 0,
            total: total[asset] ?? (free[asset] ?? 0) + (used[asset] ?? 0),
        };
        result.push(InternalBalanceSchema.parse(balance));
    }
    return result;
}
export function mapOrder(raw, clientOrderId) {
    const status = STATUS_MAP[(raw.status ?? 'open').toLowerCase()] ?? 'open';
    const side = (raw.side?.toLowerCase() ?? 'buy');
    const type = (raw.type?.toLowerCase() ?? 'market');
    const quantity = raw.amount ?? 0;
    const order = {
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
export function classifyCcxtError(err) {
    const e = err;
    const status = e?.httpStatus;
    const message = (e?.message ?? '').toLowerCase();
    const code = e?.code ?? '';
    if (status === 401)
        return 'unauthorized';
    if (/signature|invalid sign|sign\s*error/i.test(message))
        return 'signature';
    if (status === 429)
        return 'rate_limit';
    if (typeof status === 'number' && status >= 500)
        return 'server';
    if (/timed out|timeout|etimedout/i.test(message) || code === 'ETIMEDOUT') {
        return 'timeout';
    }
    return 'unknown';
}
export class CcxtFatalError extends Error {
    kind;
    constructor(message, kind) {
        super(message);
        this.kind = kind;
        this.name = 'CcxtFatalError';
    }
}
export const defaultRetryPolicy = {
    maxRetries: 3,
    baseDelayMs: 250,
    maxDelayMs: 8000,
};
export function defaultSleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function delayFor(attempt, policy) {
    const exponential = policy.baseDelayMs * 2 ** attempt;
    return Math.min(exponential, policy.maxDelayMs);
}
/**
 * Retries on rate-limit (429) and server (5xx) errors with exponential
 * backoff. Fatal errors (401, signature) and unknown errors are not retried.
 * A post-submit timeout is surfaced to the caller (who should look the order
 * up by clientOrderId) rather than blindly retried.
 */
export async function executeWithRetry(fn, policy = defaultRetryPolicy, sleep = defaultSleep) {
    let attempt = 0;
    for (;;) {
        try {
            return await fn();
        }
        catch (err) {
            const kind = classifyCcxtError(err);
            if (kind === 'unauthorized') {
                throw new CcxtFatalError(err.message, 'unauthorized');
            }
            if (kind === 'signature') {
                throw new CcxtFatalError(err.message, 'signature');
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
export async function executeCreateWithRecovery(submit, lookup, clientOrderId, policy = defaultRetryPolicy, sleep = defaultSleep) {
    try {
        return await executeWithRetry(submit, policy, sleep);
    }
    catch (err) {
        if (classifyCcxtError(err) === 'timeout') {
            return lookup(clientOrderId);
        }
        throw err;
    }
}
//# sourceMappingURL=mapping.js.map