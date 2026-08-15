import { describe, it, expect } from 'vitest';
import {
  buildDecisionSystemPrompt,
  buildDecisionUserPrompt,
  buildDecisionContext,
  buildFormationBlock,
  buildOrderFlowBlock,
  computeOrderFlow,
  contextOptionsFor,
} from '../contexts.js';
import type { OrderBook } from '@trading/core';

const CANDLES = [
  { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 5 },
  { timestamp: 2000, open: 11, high: 13, low: 10, close: 12, volume: 7 },
];

const BOOK: OrderBook = {
  bids: [
    [100, 2],
    [99, 1],
    [98, 0.5],
    [97, 0.4],
    [96, 0.3],
    [95, 0.2],
  ],
  asks: [
    [101, 1],
    [102, 3],
    [103, 0.5],
    [104, 0.4],
    [105, 0.1],
    [106, 0.2],
  ],
  timestamp: 1000,
};

describe('shared decision context builders (M8 regression)', () => {
  it('buildDecisionSystemPrompt matches the M7 record prompt byte-for-byte', () => {
    const prompt = buildDecisionSystemPrompt('BTC/USDT');
    expect(prompt).toBe(
      [
        'You are a crypto trading decision engine.',
        'You trade BTC/USDT.',
        '',
        'Rules:',
        '- You must respond with EXACTLY a JSON object: {"action":"long"|"short"|"hold","confidence":0.0-1.0}',
        '- action: "long" = buy, "short" = sell, "hold" = do nothing',
        '- confidence: your certainty in this decision (0.0 to 1.0)',
        '- No other text, no markdown fences, just the raw JSON object.',
        '',
        'Consider the recent price action, volume, and trend.',
      ].join('\n'),
    );
  });

  it('buildDecisionUserPrompt matches the M7 record prompt byte-for-byte', () => {
    const prompt = buildDecisionUserPrompt(CANDLES);
    expect(prompt).toBe(
      [
        'Recent candles (oldest first):',
        't=1000 O=10 H=12 L=9 C=11 V=5',
        't=2000 O=11 H=13 L=10 C=12 V=7',
        '',
        'Based on this price action, what is your decision?',
        'Respond with exactly: {"action":"long"|"short"|"hold","confidence":0.0-1.0}',
      ].join('\n'),
    );
  });

  it('buildDecisionContext returns system + user prompt', () => {
    const ctx = buildDecisionContext('BTC/USDT', CANDLES);
    expect(ctx.systemPrompt).toBe(buildDecisionSystemPrompt('BTC/USDT'));
    expect(ctx.userPrompt).toBe(buildDecisionUserPrompt(CANDLES));
  });
});

describe('orderflow context arm (M3.7)', () => {
  it('computeOrderFlow uses the pre-committed top-5 metric', () => {
    const m = computeOrderFlow(BOOK);
    expect(m.bestBid).toBe(100);
    expect(m.bestAsk).toBe(101);
    expect(m.topBidSize).toBeCloseTo(4.2, 10);
    expect(m.topAskSize).toBeCloseTo(5.0, 10);
    expect(m.imbalance).toBeCloseTo(-0.0869565, 6);
    expect(m.spreadPct).toBeCloseTo(0.990099, 6);
  });

  it('imbalance is normalized to [-1, 1] for one-sided books', () => {
    const allBids = { ...BOOK, asks: [] };
    const allAsks = { ...BOOK, bids: [] };
    expect(computeOrderFlow(allBids).imbalance).toBe(1);
    expect(computeOrderFlow(allAsks).imbalance).toBe(-1);
  });

  it('version is a stable 16-char hex hash that ignores book content', () => {
    const a = computeOrderFlow(BOOK);
    const b = computeOrderFlow({ ...BOOK, bids: [[200, 9]] });
    expect(a.version).toMatch(/^[0-9a-f]{16}$/);
    expect(a.version).toBe(b.version);
  });

  it('renders the orderflow block with version, spread and imbalance', () => {
    const block = buildOrderFlowBlock(BOOK);
    expect(block).toContain('Orderbook (depth, top 5 levels):');
    expect(block).toContain('bestBid: 100.00; bestAsk: 101.00');
    expect(block).toContain('imbalance: -0.087 (asks outweigh bids)');
    expect(block).toMatch(/version: [0-9a-f]{16}/);
  });

  it('renders unavailable for null or empty books instead of crashing', () => {
    expect(buildOrderFlowBlock(null)).toBe('Orderbook: unavailable');
    expect(buildOrderFlowBlock(undefined)).toBe('Orderbook: unavailable');
    expect(buildOrderFlowBlock({ ...BOOK, bids: [] })).toBe('Orderbook: unavailable');
  });

  it('is deterministic for identical input', () => {
    expect(buildOrderFlowBlock(BOOK)).toBe(buildOrderFlowBlock(BOOK));
  });

  it('contextOptionsFor maps orderflow to indicators + orderflow', () => {
    expect(contextOptionsFor('orderflow')).toEqual({
      includeIndicators: true,
      includeOrderflow: true,
    });
  });

  it('orderflow prompt includes indicators, the book block, and no patterns', () => {
    const prompt = buildDecisionUserPrompt(CANDLES, contextOptionsFor('orderflow'), BOOK);
    expect(prompt).toContain('Indicators:');
    expect(prompt).toContain('Orderbook (depth, top 5 levels):');
    expect(prompt).toContain('imbalance:');
    expect(prompt).not.toContain('Patterns:');
  });

  it('orderflow prompt renders unavailable when no snapshot exists (causality-safe)', () => {
    const prompt = buildDecisionUserPrompt(CANDLES, contextOptionsFor('orderflow'), null);
    expect(prompt).toContain('Orderbook: unavailable');
  });

  it('system prompt mentions order book imbalance as evidence', () => {
    expect(buildDecisionSystemPrompt('BTC/USDT', contextOptionsFor('orderflow'))).toContain(
      'Order book imbalance is supplied',
    );
  });

  it('buildDecisionContext forwards the book to the user prompt', () => {
    const ctx = buildDecisionContext('BTC/USDT', CANDLES, contextOptionsFor('orderflow'), BOOK);
    expect(ctx.userPrompt).toContain('Orderbook (depth, top 5 levels):');
  });
});

describe('formations context arm (M3.9)', () => {
  const LONG = Array.from({ length: 60 }, (_, i) => ({
    timestamp: 1700000000000 + i * 900000,
    open: 100 + i * 0.1,
    high: 103 + i * 0.1,
    low: 98 + i * 0.1,
    close: 102 + i * 0.1,
    volume: 1000,
  }));

  it('contextOptionsFor maps formations to indicators + formations', () => {
    expect(contextOptionsFor('formations')).toEqual({
      includeIndicators: true,
      includeFormations: true,
    });
  });

  it('renders the formation block with version, pivot counts, and booleans', () => {
    const block = buildFormationBlock(LONG);
    expect(block).toContain('Formations:');
    expect(block).toMatch(/version: [0-9a-f]{16}/);
    expect(block).toMatch(/pivots: \d+ \(\d+H\/\d+L\) over 60 candles/);
    expect(block).toContain('headAndShoulders: ');
    expect(block).toContain('doubleTop: ');
  });

  it('renders neckline n/a when no formation fired, never crashes', () => {
    const block = buildFormationBlock(LONG);
    expect(block).toContain('neckline: n/a');
  });

  it('renders a real neckline when a formation fires', () => {
    const candles = Array.from({ length: 60 }, (_, i) => {
      let close = 100;
      if (i <= 7) close = 100 + (20 * i) / 7;
      else if (i <= 12) close = 120 - (15 * (i - 7)) / 5;
      else if (i <= 20) close = 105 + (25 * (i - 12)) / 8;
      else if (i <= 26) close = 130 - (26 * (i - 20)) / 6;
      else if (i <= 33) close = 104 + (14 * (i - 26)) / 7;
      else close = 118 - (19 * (i - 33)) / 5;
      return {
        timestamp: 1700000000000 + i * 900000,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1000,
      };
    });
    const block = buildFormationBlock(candles);
    expect(block).toMatch(/neckline: \d+(\.\d+)? \(slope -?\d+\.\d+%\)/);
  });

  it('is deterministic for identical input', () => {
    expect(buildFormationBlock(LONG)).toBe(buildFormationBlock(LONG));
  });

  it('formations prompt includes indicators and the formation block, no patterns', () => {
    const prompt = buildDecisionUserPrompt(LONG, contextOptionsFor('formations'));
    expect(prompt).toContain('Indicators:');
    expect(prompt).toContain('Formations:');
    expect(prompt).toContain('pivots:');
    expect(prompt).not.toContain('Patterns:');
    expect(prompt).not.toContain('Orderbook');
  });

  it('system prompt mentions chart formations as evidence', () => {
    expect(buildDecisionSystemPrompt('BTC/USDT', contextOptionsFor('formations'))).toContain(
      'Chart formations are supplied',
    );
  });

  it('buildDecisionContext forwards the formations arm to both prompts', () => {
    const ctx = buildDecisionContext('BTC/USDT', LONG, contextOptionsFor('formations'));
    expect(ctx.systemPrompt).toContain('Chart formations are supplied');
    expect(ctx.userPrompt).toContain('Formations:');
  });
});
