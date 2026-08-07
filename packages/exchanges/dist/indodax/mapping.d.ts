import { type InternalBalance, type InternalOrder, type Ticker } from '@trading/core';
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
    createOrder(symbol: string, type: string, side: string, amount: number, price?: number, params?: Record<string, unknown>): Promise<CcxtLikeOrder>;
    fetchOrder(id: string, symbol?: string, params?: Record<string, unknown>): Promise<CcxtLikeOrder>;
    cancelOrder(id: string, symbol?: string, params?: Record<string, unknown>): Promise<CcxtLikeOrder>;
}
export declare function mapTicker(raw: CcxtLikeTicker, symbol: string): Ticker;
export declare function mapBalance(raw: CcxtLikeBalance): InternalBalance[];
export declare function mapOrder(raw: CcxtLikeOrder, clientOrderId: string): InternalOrder;
export type CcxtErrorKind = 'rate_limit' | 'server' | 'unauthorized' | 'signature' | 'timeout' | 'unknown';
export interface CcxtError extends Error {
    httpStatus?: number;
    code?: string;
}
export declare function classifyCcxtError(err: unknown): CcxtErrorKind;
export declare class CcxtFatalError extends Error {
    readonly kind: Extract<CcxtErrorKind, 'unauthorized' | 'signature'>;
    constructor(message: string, kind: Extract<CcxtErrorKind, 'unauthorized' | 'signature'>);
}
export interface RetryPolicy {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
}
export declare const defaultRetryPolicy: RetryPolicy;
export type SleepFn = (ms: number) => Promise<void>;
export declare function defaultSleep(ms: number): Promise<void>;
/**
 * Retries on rate-limit (429) and server (5xx) errors with exponential
 * backoff. Fatal errors (401, signature) and unknown errors are not retried.
 * A post-submit timeout is surfaced to the caller (who should look the order
 * up by clientOrderId) rather than blindly retried.
 */
export declare function executeWithRetry<T>(fn: () => Promise<T>, policy?: RetryPolicy, sleep?: SleepFn): Promise<T>;
/**
 * Submits a create-order call, recovering from a post-submit timeout by looking
 * the order up via its clientOrderId instead of blind-retrying the submit.
 */
export declare function executeCreateWithRecovery<T>(submit: () => Promise<T>, lookup: (clientOrderId: string) => Promise<T>, clientOrderId: string, policy?: RetryPolicy, sleep?: SleepFn): Promise<T>;
//# sourceMappingURL=mapping.d.ts.map