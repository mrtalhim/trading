import { describe, it, expect } from 'vitest';
import {
  buildDecisionSystemPrompt,
  buildDecisionUserPrompt,
  buildDecisionContext,
} from '../contexts.js';

const CANDLES = [
  { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 5 },
  { timestamp: 2000, open: 11, high: 13, low: 10, close: 12, volume: 7 },
];

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
