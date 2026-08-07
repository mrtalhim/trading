import { describe, expect, it } from 'vitest';
import {
  classifyLlmError,
  DecisionError,
  DecisionParseError,
  DecisionTimeoutError,
} from '../interfaces.js';

describe('classifyLlmError', () => {
  it('classifies a timeout', () => {
    expect(classifyLlmError(new DecisionTimeoutError('x', 5000))).toBe('timeout');
  });

  it('classifies a malformed response', () => {
    expect(classifyLlmError(new DecisionParseError('x', 'not json', ['invalid JSON']))).toBe(
      'malformed_json',
    );
  });

  it('classifies HTTP 429 as rate_limited', () => {
    expect(classifyLlmError(new DecisionError('x', 'HTTP 429: slow down'))).toBe('rate_limited');
  });

  it('classifies other HTTP statuses as http_error', () => {
    expect(classifyLlmError(new DecisionError('x', 'HTTP 500: boom'))).toBe('http_error');
    expect(classifyLlmError(new DecisionError('x', 'HTTP 401: unauthorized'))).toBe('http_error');
  });

  it('classifies request-failed wraps as network_error', () => {
    expect(
      classifyLlmError(new DecisionError('x', 'request failed', new Error('fetch failed'))),
    ).toBe('network_error');
  });

  it('classifies raw network errors as network_error', () => {
    expect(classifyLlmError(new TypeError('fetch failed'))).toBe('network_error');
    expect(classifyLlmError(new Error('connect ECONNREFUSED 127.0.0.1:8080'))).toBe(
      'network_error',
    );
  });

  it('classifies raw abort errors as timeout', () => {
    expect(classifyLlmError(new DOMException('aborted', 'AbortError'))).toBe('timeout');
  });

  it('classifies anything unknown as fatal', () => {
    expect(classifyLlmError(new Error('something entirely unexpected'))).toBe('fatal');
    expect(classifyLlmError('not an error at all')).toBe('fatal');
  });

  it('never returns anything other than a stable kind', () => {
    const kinds = [
      'timeout',
      'rate_limited',
      'malformed_json',
      'http_error',
      'network_error',
      'fatal',
    ];
    const inputs = [
      new DecisionTimeoutError('x', 1),
      new DecisionParseError('x', 'x', ['x']),
      new DecisionError('x', 'HTTP 429: x'),
      new DecisionError('x', 'HTTP 502: x'),
      new TypeError('fetch failed'),
      new Error('what'),
      'string',
      null,
    ];
    for (const input of inputs) {
      expect(kinds).toContain(classifyLlmError(input));
    }
  });
});
