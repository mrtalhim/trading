import { describe, expect, it } from 'vitest';
import { envNameForPreset } from '../../apps/benchmark/src/index.js';

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
