import { describe, it, expect, vi } from 'vitest';
import { CcxtFatalError, defaultRetryPolicy, } from '../indodax/mapping.js';
import { IndodaxExchange } from '../indodax/indodax-exchange.js';
function makeProgrammableApi(handlers) {
    const calls = { createOrder: 0, fetchOrder: 0, fetchTicker: 0 };
    const api = {
        fetchTicker: async () => {
            calls.fetchTicker += 1;
            return handlers.fetchTicker ? handlers.fetchTicker() : { last: 100_000_000, timestamp: 0 };
        },
        fetchBalance: async () => ({ free: { IDR: 1 } }),
        createOrder: async () => {
            calls.createOrder += 1;
            if (!handlers.createOrder)
                throw new Error('unexpected createOrder');
            return handlers.createOrder();
        },
        fetchOrder: async () => {
            calls.fetchOrder += 1;
            if (!handlers.fetchOrder)
                throw new Error('unexpected fetchOrder');
            return handlers.fetchOrder();
        },
        cancelOrder: async () => ({ clientOrderId: 'x' }),
    };
    return { api, calls };
}
function rateLimitError() {
    const e = new Error('Too Many Requests');
    e.httpStatus = 429;
    return e;
}
function serverError() {
    const e = new Error('Internal Server Error');
    e.httpStatus = 500;
    return e;
}
function unauthorizedError() {
    const e = new Error('Unauthorized');
    e.httpStatus = 401;
    return e;
}
function signatureError() {
    const e = new Error('Invalid signature');
    return e;
}
function timeoutError() {
    const e = new Error('Request timed out');
    return e;
}
const okOrder = {
    id: 'x',
    clientOrderId: 'retry-cid',
    symbol: 'BTC/IDR',
    status: 'closed',
    filled: 1,
    amount: 1,
};
describe('IndodaxExchange retry policy', () => {
    it('retries on 429 with backoff then succeeds', async () => {
        const { api, calls } = makeProgrammableApi({
            createOrder: vi.fn().mockRejectedValueOnce(rateLimitError()).mockResolvedValueOnce(okOrder),
        });
        const sleep = vi.fn(async () => { });
        const ex = new IndodaxExchange(api, defaultRetryPolicy, sleep);
        const order = await ex.createOrder({
            symbol: 'BTC/IDR',
            side: 'buy',
            type: 'market',
            quantity: 1,
            clientOrderId: 'retry-cid',
        });
        expect(order.clientOrderId).toBe('retry-cid');
        expect(calls.createOrder).toBe(2);
        expect(sleep).toHaveBeenCalledTimes(1);
    });
    it('retries on 5xx with backoff then succeeds', async () => {
        const { api, calls } = makeProgrammableApi({
            createOrder: vi.fn().mockRejectedValueOnce(serverError()).mockResolvedValueOnce(okOrder),
        });
        const sleep = vi.fn(async () => { });
        const ex = new IndodaxExchange(api, defaultRetryPolicy, sleep);
        await ex.createOrder({
            symbol: 'BTC/IDR',
            side: 'buy',
            type: 'market',
            quantity: 1,
            clientOrderId: 'retry-cid',
        });
        expect(calls.createOrder).toBe(2);
        expect(sleep).toHaveBeenCalledTimes(1);
    });
    it('recovers a post-submit timeout by looking up by clientOrderId', async () => {
        const { api, calls } = makeProgrammableApi({
            createOrder: vi.fn().mockRejectedValueOnce(timeoutError()),
            fetchOrder: vi.fn().mockResolvedValueOnce(okOrder),
        });
        const sleep = vi.fn(async () => { });
        const ex = new IndodaxExchange(api, defaultRetryPolicy, sleep);
        const order = await ex.createOrder({
            symbol: 'BTC/IDR',
            side: 'buy',
            type: 'market',
            quantity: 1,
            clientOrderId: 'retry-cid',
        });
        expect(order.clientOrderId).toBe('retry-cid');
        expect(calls.createOrder).toBe(1);
        expect(calls.fetchOrder).toBe(1);
        expect(sleep).not.toHaveBeenCalled();
    });
    it('does not retry a 401 — fatal', async () => {
        const { api, calls } = makeProgrammableApi({
            createOrder: vi.fn().mockRejectedValue(unauthorizedError()),
        });
        const sleep = vi.fn(async () => { });
        const ex = new IndodaxExchange(api, defaultRetryPolicy, sleep);
        await expect(ex.createOrder({
            symbol: 'BTC/IDR',
            side: 'buy',
            type: 'market',
            quantity: 1,
            clientOrderId: 'retry-cid',
        })).rejects.toBeInstanceOf(CcxtFatalError);
        expect(calls.createOrder).toBe(1);
        expect(sleep).not.toHaveBeenCalled();
    });
    it('does not retry a signature error — fatal', async () => {
        const { api, calls } = makeProgrammableApi({
            createOrder: vi.fn().mockRejectedValue(signatureError()),
        });
        const sleep = vi.fn(async () => { });
        const ex = new IndodaxExchange(api, defaultRetryPolicy, sleep);
        await expect(ex.createOrder({
            symbol: 'BTC/IDR',
            side: 'buy',
            type: 'market',
            quantity: 1,
            clientOrderId: 'retry-cid',
        })).rejects.toBeInstanceOf(CcxtFatalError);
        expect(calls.createOrder).toBe(1);
        expect(sleep).not.toHaveBeenCalled();
    });
    it('retries fetchTicker on 429 then succeeds', async () => {
        const { api, calls } = makeProgrammableApi({
            fetchTicker: vi
                .fn()
                .mockRejectedValueOnce(rateLimitError())
                .mockResolvedValueOnce({ last: 100_000_000, timestamp: 0 }),
        });
        const sleep = vi.fn(async () => { });
        const ex = new IndodaxExchange(api, defaultRetryPolicy, sleep);
        const ticker = await ex.fetchTicker('BTC/IDR');
        expect(ticker.last).toBe(100_000_000);
        expect(calls.fetchTicker).toBe(2);
    });
});
//# sourceMappingURL=indodax.retry.test.js.map