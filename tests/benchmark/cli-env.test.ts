import { describe, expect, it } from 'vitest';
import {
  envNameForPreset,
  parseArgs as parseBenchmarkArgs,
} from '../../apps/benchmark/src/index.js';
import { parseArgs as parseBacktestArgs } from '../../apps/backtest/src/index.js';

describe('envNameForPreset', () => {
  it('routes OpenRouter presets to OPENROUTER_API_KEY', () => {
    for (const preset of [
      'gemma4',
      'nemotron',
      'gptoss',
      'gemma431',
      'gptoss120b',
      'lunapro',
      'deepseekv4',
      'gemini35liteor',
    ]) {
      expect(envNameForPreset(preset), preset).toBe('OPENROUTER_API_KEY');
    }
  });

  it('routes every native Gemini preset to GEMINI_API_KEY', () => {
    for (const preset of ['gemini', 'gemini36', 'gemini35lite']) {
      expect(envNameForPreset(preset), preset).toBe('GEMINI_API_KEY');
    }
  });
});

describe('benchmark CLI --context', () => {
  it('parses every supported context kind', () => {
    for (const ctx of ['baseline', 'indicators', 'patterns', 'orderflow', 'formations']) {
      const a = parseBenchmarkArgs([
        'probe',
        '--context',
        ctx,
        '--dataset',
        'd',
        '--decisions',
        'x',
      ]);
      expect(a.context).toBe(ctx);
    }
  });

  it('defaults to baseline when --context is absent', () => {
    expect(parseBenchmarkArgs(['run', '--dataset', 'd']).context).toBe('baseline');
  });

  it('rejects an invalid --context value', () => {
    expect(() => parseBenchmarkArgs(['probe', '--context', 'bogus'])).toThrow(
      /invalid --context 'bogus'/,
    );
  });

  it('routes the abtest subcommand with control/treatment', () => {
    const a = parseBenchmarkArgs([
      'abtest',
      '--control',
      'c.jsonl',
      '--treatment',
      't.jsonl',
      '--dataset',
      'd',
      '--block-size',
      '50',
    ]);
    expect(a.command).toBe('abtest');
    expect(a.control).toBe('c.jsonl');
    expect(a.treatment).toBe('t.jsonl');
    expect(a.blockSize).toBe(50);
  });
});

describe('backtest CLI --context', () => {
  it('parses --context for --record', () => {
    const a = parseBacktestArgs(['--record', '--context', 'patterns', '--dataset', 'd']);
    expect(a.context).toBe('patterns');
  });

  it('parses --context=orderflow for --record', () => {
    const a = parseBacktestArgs(['--record', '--context', 'orderflow', '--dataset', 'd']);
    expect(a.context).toBe('orderflow');
  });

  it('parses --context=formations for --record', () => {
    const a = parseBacktestArgs(['--record', '--context', 'formations', '--dataset', 'd']);
    expect(a.context).toBe('formations');
  });

  it('rejects an invalid --context value', () => {
    expect(() => parseBacktestArgs(['--record', '--context', 'bogus', '--dataset', 'd'])).toThrow(
      /invalid --context 'bogus'/,
    );
  });
});
