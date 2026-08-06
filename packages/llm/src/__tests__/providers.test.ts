import { describe, it, expect } from 'vitest';
import { PRESETS, createEngineFromPreset } from '../providers.js';

const EXPECTED_PRESETS: Array<[string, string, 'openai' | 'gemini', string]> = [
  ['gemma4', 'Google Gemma 4 26B', 'openai', 'google/gemma-4-26b-a4b-it:free'],
  ['nemotron', 'NVIDIA Nemotron 3 Nano 30B', 'openai', 'nvidia/nemotron-3-nano-30b-a3b:free'],
  ['gptoss', 'OpenAI GPT-OSS 20B', 'openai', 'openai/gpt-oss-20b:free'],
  ['gemini', 'Google Gemini 2.5 Flash', 'gemini', 'gemini-2.5-flash'],
  ['gemma431', 'Google Gemma 4 31B', 'openai', 'google/gemma-4-31b-it'],
  ['gptoss120b', 'OpenAI GPT-OSS 120B', 'openai', 'openai/gpt-oss-120b'],
  ['lunapro', 'OpenAI GPT-5.6 Luna Pro', 'openai', 'openai/gpt-5.6-luna-pro'],
  ['deepseekv4', 'DeepSeek V4 Flash', 'openai', 'deepseek/deepseek-v4-flash'],
  ['gemini36', 'Google Gemini 3.6 Flash', 'gemini', 'gemini-3.6-flash'],
  ['gemini35lite', 'Google Gemini 3.5 Flash Lite', 'gemini', 'gemini-3.5-flash-lite'],
];

describe('PRESETS', () => {
  it('contains every expected preset with correct metadata', () => {
    for (const [name, label, kind, model] of EXPECTED_PRESETS) {
      const p = PRESETS[name];
      expect(p, `preset ${name}`).toBeDefined();
      expect(p!.name).toBe(label);
      expect(p!.kind).toBe(kind);
      expect(p!.model).toBe(model);
    }
  });

  it('resolves every preset to an engine with matching provider identity', () => {
    for (const [name, , kind, model] of EXPECTED_PRESETS) {
      const engine = createEngineFromPreset(name, 'test-key');
      const prefix = kind === 'gemini' ? 'gemini' : 'openai-compatible';
      expect(engine.provider, `provider for ${name}`).toBe(`${prefix}:${model}`);
    }
  });

  it('throws a clear error for an unknown preset', () => {
    expect(() => createEngineFromPreset('does-not-exist', 'test-key')).toThrow(/unknown preset/);
  });
});
