import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../interfaces.js';

describe('estimateTokens', () => {
  it('is deterministic', () => {
    const text = 'You are a crypto trading decision engine. You trade BTC/USDT.';
    expect(estimateTokens(text)).toBe(estimateTokens(text));
  });

  it('treats chars/4 as the rule of thumb', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a'.repeat(4))).toBe(1);
    expect(estimateTokens('a'.repeat(5))).toBe(2);
  });

  it('monotonic in length', () => {
    const short = estimateTokens('short system prompt');
    const long = estimateTokens('a significantly longer system prompt with much more text in it');
    expect(long).toBeGreaterThan(short);
  });
});
