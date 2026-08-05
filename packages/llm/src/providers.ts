import type { DecisionEngine } from './interfaces.js';
import { OpenAICompatibleEngine } from './openai-compatible.js';
import { AnthropicEngine } from './anthropic.js';

export interface ProviderConfig {
  kind: 'openai' | 'anthropic';
  model: string;
  baseURL?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  extraHeaders?: Record<string, string>;
}

export interface Preset {
  name: string;
  model: string;
  baseURL: string;
}

export const PRESETS: Record<string, Preset> = {
  gemma4: {
    name: 'Google Gemma 4 26B',
    model: 'google/gemma-4-26b-a4b-it:free',
    baseURL: 'https://openrouter.ai/api/v1',
  },
  nemotron: {
    name: 'NVIDIA Nemotron 3 Nano 30B',
    model: 'nvidia/nemotron-3-nano-30b-a3b:free',
    baseURL: 'https://openrouter.ai/api/v1',
  },
  gptoss: {
    name: 'OpenAI GPT-OSS 20B',
    model: 'openai/gpt-oss-20b:free',
    baseURL: 'https://openrouter.ai/api/v1',
  },
};

export function createEngineFromPreset(
  presetName: string,
  apiKey: string,
  timeoutMs?: number,
  fetchImpl?: typeof fetch,
): DecisionEngine {
  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(`unknown preset: ${presetName}. available: ${Object.keys(PRESETS).join(', ')}`);
  }
  return new OpenAICompatibleEngine({
    baseURL: preset.baseURL,
    apiKey,
    model: preset.model,
    timeoutMs,
    fetchImpl,
  });
}

const PROVIDER_DEFAULTS: Record<string, { kind: 'openai'; baseURL: string }> = {
  openrouter: { kind: 'openai', baseURL: 'https://openrouter.ai/api/v1' },
  gemini: {
    kind: 'openai',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
  },
  groq: { kind: 'openai', baseURL: 'https://api.groq.com/openai/v1' },
  ollama: { kind: 'openai', baseURL: 'http://localhost:11434/v1' },
  deepseek: { kind: 'openai', baseURL: 'https://api.deepseek.com/v1' },
  nvidia: {
    kind: 'openai',
    baseURL: 'https://integrate.api.nvidia.com/v1',
  },
};

export function createDecisionEngine(config: ProviderConfig): DecisionEngine {
  if (config.kind === 'anthropic') {
    if (!config.apiKey) throw new Error('apiKey is required for anthropic');
    return new AnthropicEngine({
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
      fetchImpl: config.fetchImpl,
    });
  }

  const defaults = PROVIDER_DEFAULTS[config.model.split('/')[0]];
  const baseURL = config.baseURL ?? defaults?.baseURL;
  if (!baseURL) {
    throw new Error(`no baseURL configured and no default for provider: ${config.model}`);
  }

  return new OpenAICompatibleEngine({
    baseURL,
    apiKey: config.apiKey ?? '',
    model: config.model,
    timeoutMs: config.timeoutMs,
    fetchImpl: config.fetchImpl,
    extraHeaders: config.extraHeaders,
  });
}
