import { describe, it, expect } from 'vitest';
import { PRESETS, createEngineFromPreset } from '../providers.js';
import type { CostModel } from '../interfaces.js';

const ZERO: CostModel = { promptPerMillionUsd: 0, completionPerMillionUsd: 0 };
const PAID = {
  gemma431: { promptPerMillionUsd: 0.1, completionPerMillionUsd: 0.34 },
  gptoss120b: { promptPerMillionUsd: 0.037, completionPerMillionUsd: 0.17 },
  lunapro: { promptPerMillionUsd: 0.1, completionPerMillionUsd: 0.6 },
  deepseekv4: { promptPerMillionUsd: 0.0882, completionPerMillionUsd: 0.1764 },
} as const;

const EXPECTED_PRESETS: Array<[string, string, 'openai' | 'gemini', string, CostModel | null]> = [
  ['gemma4', 'Google Gemma 4 26B', 'openai', 'google/gemma-4-26b-a4b-it:free', null],
  ['nemotron', 'NVIDIA Nemotron 3 Nano 30B', 'openai', 'nvidia/nemotron-3-nano-30b-a3b:free', null],
  ['gptoss', 'OpenAI GPT-OSS 20B', 'openai', 'openai/gpt-oss-20b:free', null],
  ['gemini', 'Google Gemini 2.5 Flash', 'gemini', 'gemini-2.5-flash', null],
  ['gemma431', 'Google Gemma 4 31B', 'openai', 'google/gemma-4-31b-it', PAID.gemma431],
  ['gptoss120b', 'OpenAI GPT-OSS 120B', 'openai', 'openai/gpt-oss-120b', PAID.gptoss120b],
  ['lunapro', 'OpenAI GPT-5.6 Luna Pro', 'openai', 'openai/gpt-5.6-luna-pro', PAID.lunapro],
  ['deepseekv4', 'DeepSeek V4 Flash', 'openai', 'deepseek/deepseek-v4-flash', PAID.deepseekv4],
  ['gemini36', 'Google Gemini 3.6 Flash', 'gemini', 'gemini-3.6-flash', null],
  ['gemini35lite', 'Google Gemini 3.5 Flash Lite', 'gemini', 'gemini-3.5-flash-lite', null],
];

describe('PRESETS', () => {
  it('contains every expected preset with correct metadata', () => {
    for (const [name, label, kind, model, costModel] of EXPECTED_PRESETS) {
      const p = PRESETS[name];
      expect(p, `preset ${name}`).toBeDefined();
      expect(p!.name).toBe(label);
      expect(p!.kind).toBe(kind);
      expect(p!.model).toBe(model);
      expect(p!.costModel ?? null, `costModel for ${name}`).toEqual(costModel);
    }
  });

  it('resolves every preset to an engine with matching provider identity', () => {
    for (const [name, , kind, model] of EXPECTED_PRESETS) {
      const engine = createEngineFromPreset(name, 'test-key');
      const prefix = kind === 'gemini' ? 'gemini' : 'openai-compatible';
      expect(engine.provider, `provider for ${name}`).toBe(`${prefix}:${model}`);
    }
  });

  it('exposes the preset costModel on the engine (zero for free)', () => {
    for (const [name, , , , costModel] of EXPECTED_PRESETS) {
      const engine = createEngineFromPreset(name, 'test-key');
      expect(engine.costModel, `costModel for ${name}`).toEqual(costModel ?? ZERO);
    }
  });

  it('throws a clear error for an unknown preset', () => {
    expect(() => createEngineFromPreset('does-not-exist', 'test-key')).toThrow(/unknown preset/);
  });
});
