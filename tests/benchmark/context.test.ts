import { describe, expect, it } from 'vitest';
import type { Candle } from '../../packages/core/src/candle.js';
import {
  buildDecisionContext,
  buildDecisionSystemPrompt,
  buildDecisionUserPrompt,
  contextOptionsFor,
} from '../../packages/llm/src/contexts.js';

function candles(n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      timestamp: 1_700_000_000_000 + i * 900_000,
      open: 100 + i,
      high: 103 + i,
      low: 98 + i,
      close: 102 + i,
      volume: 1000,
    });
  }
  return out;
}

describe('context render options', () => {
  it('maps baseline to no extra blocks', () => {
    expect(contextOptionsFor('baseline')).toEqual({});
  });

  it('maps indicators to the indicator block only', () => {
    expect(contextOptionsFor('indicators')).toEqual({ includeIndicators: true });
  });

  it('maps patterns to indicators + patterns', () => {
    expect(contextOptionsFor('patterns')).toEqual({
      includeIndicators: true,
      includePatterns: true,
    });
  });

  it('maps orderflow to indicators + orderflow', () => {
    expect(contextOptionsFor('orderflow')).toEqual({
      includeIndicators: true,
      includeOrderflow: true,
    });
  });
});

describe('buildDecisionUserPrompt blocks', () => {
  it('baseline output is byte-identical to the legacy prompt', () => {
    const cs = candles(20);
    const legacy = buildDecisionUserPrompt(cs, {});
    expect(legacy).toBe(buildDecisionUserPrompt(cs));
    expect(legacy).not.toContain('Indicators:');
    expect(legacy).not.toContain('Patterns:');
    expect(legacy).toContain('Recent candles (oldest first):');
  });

  it('indicators arm adds the indicator block', () => {
    const prompt = buildDecisionUserPrompt(candles(20), contextOptionsFor('indicators'));
    expect(prompt).toContain('Indicators:');
    expect(prompt).toContain('RSI(14)');
    expect(prompt).toContain('VWAP');
    expect(prompt).not.toContain('Patterns:');
  });

  it('patterns arm adds both indicator and pattern blocks', () => {
    const prompt = buildDecisionUserPrompt(candles(20), contextOptionsFor('patterns'));
    expect(prompt).toContain('Indicators:');
    expect(prompt).toContain('Patterns:');
    expect(prompt).toContain('trend: ');
    expect(prompt).toMatch(/version: [0-9a-f]{16}/);
  });

  it('orderflow arm adds indicator and book blocks', () => {
    const book = {
      bids: [
        [100, 2],
        [99, 1],
        [98, 0.5],
        [97, 0.4],
        [96, 0.3],
      ],
      asks: [
        [101, 1],
        [102, 3],
        [103, 0.5],
        [104, 0.4],
        [105, 0.1],
      ],
      timestamp: 1700000000000,
    };
    const prompt = buildDecisionUserPrompt(candles(20), contextOptionsFor('orderflow'), book);
    expect(prompt).toContain('Indicators:');
    expect(prompt).toContain('Orderbook (depth, top 5 levels):');
    expect(prompt).toContain('imbalance:');
    expect(prompt).toMatch(/version: [0-9a-f]{16}/);
  });

  it('renders n/a for insufficient indicator history instead of crashing', () => {
    const prompt = buildDecisionUserPrompt(candles(3), contextOptionsFor('patterns'));
    expect(prompt).toContain('n/a');
  });

  it('is deterministic for identical input', () => {
    const cs = candles(20);
    expect(buildDecisionUserPrompt(cs, contextOptionsFor('patterns'))).toBe(
      buildDecisionUserPrompt(cs, contextOptionsFor('patterns')),
    );
  });
});

describe('buildDecisionSystemPrompt blocks', () => {
  it('baseline has no arm-specific rules', () => {
    const p = buildDecisionSystemPrompt('BTC/USDT', {});
    expect(p).not.toContain('Indicator values');
    expect(p).not.toContain('Candlestick patterns');
  });

  it('patterns arm mentions both rules', () => {
    const p = buildDecisionSystemPrompt('BTC/USDT', contextOptionsFor('patterns'));
    expect(p).toContain('Indicator values are supplied');
    expect(p).toContain('Candlestick patterns are supplied');
  });

  it('orderflow arm mentions the imbalance rule', () => {
    const p = buildDecisionSystemPrompt('BTC/USDT', contextOptionsFor('orderflow'));
    expect(p).toContain('Order book imbalance is supplied');
  });
});

describe('buildDecisionContext forwarding', () => {
  it('passes render options through to both prompts', () => {
    const cs = candles(20);
    const ctx = buildDecisionContext('BTC/USDT', cs, contextOptionsFor('patterns'));
    expect(ctx.systemPrompt).toContain('Candlestick patterns are supplied');
    expect(ctx.userPrompt).toContain('Patterns:');
  });
});
