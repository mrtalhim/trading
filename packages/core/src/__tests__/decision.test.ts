import { describe, it, expect } from 'vitest';
import { DecisionSchema, Action } from '../decision.js';

describe('DecisionSchema', () => {
  it('accepts a well-formed long decision', () => {
    const result = DecisionSchema.safeParse({ action: 'long', confidence: 0.8 });
    expect(result.success).toBe(true);
  });

  it('accepts a well-formed short decision', () => {
    const result = DecisionSchema.safeParse({ action: 'short', confidence: 0.5 });
    expect(result.success).toBe(true);
  });

  it('accepts a well-formed hold decision', () => {
    const result = DecisionSchema.safeParse({ action: 'hold', confidence: 0.0 });
    expect(result.success).toBe(true);
  });

  it('rejects unknown action values', () => {
    const result = DecisionSchema.safeParse({ action: 'buy', confidence: 0.5 });
    expect(result.success).toBe(false);
  });

  it('rejects confidence outside [0,1]', () => {
    const tooHigh = DecisionSchema.safeParse({ action: 'long', confidence: 1.5 });
    expect(tooHigh.success).toBe(false);

    const tooLow = DecisionSchema.safeParse({ action: 'long', confidence: -0.1 });
    expect(tooLow.success).toBe(false);
  });

  it('rejects NaN confidence', () => {
    const result = DecisionSchema.safeParse({ action: 'long', confidence: NaN });
    expect(result.success).toBe(false);
  });

  it('rejects missing required keys', () => {
    const noAction = DecisionSchema.safeParse({ confidence: 0.5 });
    expect(noAction.success).toBe(false);

    const noConfidence = DecisionSchema.safeParse({ action: 'long' });
    expect(noConfidence.success).toBe(false);
  });

  it('rejects extra keys', () => {
    const result = DecisionSchema.safeParse({
      action: 'long',
      confidence: 0.5,
      positionSize: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed JSON equivalent (non-object)', () => {
    const result = DecisionSchema.safeParse('not an object');
    expect(result.success).toBe(false);
  });

  it('infers correct Action type', () => {
    expect(Action.options).toEqual(['long', 'short', 'hold']);
  });
});
