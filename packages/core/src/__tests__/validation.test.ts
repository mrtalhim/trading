import { describe, it, expect } from 'vitest';
import { parseDecision } from '../validation.js';

describe('parseDecision', () => {
  it('returns success for valid input', () => {
    const result = parseDecision({ action: 'long', confidence: 0.75 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ action: 'long', confidence: 0.75 });
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for invalid action', () => {
    const result = parseDecision({ action: 'buy', confidence: 0.5 });
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns errors for out-of-range confidence', () => {
    const result = parseDecision({ action: 'long', confidence: 2 });
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });

  it('returns errors for NaN confidence', () => {
    const result = parseDecision({ action: 'long', confidence: NaN });
    expect(result.success).toBe(false);
  });

  it('returns errors for missing keys', () => {
    const result = parseDecision({ action: 'long' });
    expect(result.success).toBe(false);
  });

  it('returns errors for extra keys', () => {
    const result = parseDecision({
      action: 'hold',
      confidence: 0,
      extra: true,
    });
    expect(result.success).toBe(false);
  });

  it('handles null gracefully', () => {
    const result = parseDecision(null);
    expect(result.success).toBe(false);
  });

  it('handles undefined gracefully', () => {
    const result = parseDecision(undefined);
    expect(result.success).toBe(false);
  });
});
