import type { DecisionEngine } from './interfaces.js';
import type { CostModel } from './interfaces.js';
import { OpenAICompatibleEngine } from './openai-compatible.js';
import { AnthropicEngine } from './anthropic.js';
import { GeminiEngine } from './gemini.js';

export interface ProviderConfig {
  kind: 'openai' | 'anthropic' | 'gemini';
  model: string;
  baseURL?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  extraHeaders?: Record<string, string>;
  costModel?: CostModel;
}

export interface Preset {
  name: string;
  kind: 'openai' | 'gemini';
  model: string;
  baseURL?: string;
  costModel?: CostModel;
}

export const PRESETS: Record<string, Preset> = {
  gemma4: {
    name: 'Google Gemma 4 26B',
    kind: 'openai',
    model: 'google/gemma-4-26b-a4b-it:free',
    baseURL: 'https://openrouter.ai/api/v1',
  },
  nemotron: {
    name: 'NVIDIA Nemotron 3 Nano 30B',
    kind: 'openai',
    model: 'nvidia/nemotron-3-nano-30b-a3b:free',
    baseURL: 'https://openrouter.ai/api/v1',
  },
  gptoss: {
    name: 'OpenAI GPT-OSS 20B',
    kind: 'openai',
    model: 'openai/gpt-oss-20b:free',
    baseURL: 'https://openrouter.ai/api/v1',
  },
  gemini: {
    name: 'Google Gemini 2.5 Flash',
    kind: 'gemini',
    model: 'gemini-2.5-flash',
  },
  gemma431: {
    name: 'Google Gemma 4 31B',
    kind: 'openai',
    model: 'google/gemma-4-31b-it',
    baseURL: 'https://openrouter.ai/api/v1',
    costModel: { promptPerMillionUsd: 0.1, completionPerMillionUsd: 0.34 },
  },
  gptoss120b: {
    name: 'OpenAI GPT-OSS 120B',
    kind: 'openai',
    model: 'openai/gpt-oss-120b',
    baseURL: 'https://openrouter.ai/api/v1',
    costModel: { promptPerMillionUsd: 0.037, completionPerMillionUsd: 0.17 },
  },
  lunapro: {
    name: 'OpenAI GPT-5.6 Luna Pro',
    kind: 'openai',
    model: 'openai/gpt-5.6-luna-pro',
    baseURL: 'https://openrouter.ai/api/v1',
    costModel: { promptPerMillionUsd: 0.1, completionPerMillionUsd: 0.6 },
  },
  deepseekv4: {
    name: 'DeepSeek V4 Flash',
    kind: 'openai',
    model: 'deepseek/deepseek-v4-flash',
    baseURL: 'https://openrouter.ai/api/v1',
    costModel: { promptPerMillionUsd: 0.0882, completionPerMillionUsd: 0.1764 },
  },
  gemini36: {
    name: 'Google Gemini 3.6 Flash',
    kind: 'gemini',
    model: 'gemini-3.6-flash',
  },
  gemini35lite: {
    name: 'Google Gemini 3.5 Flash Lite',
    kind: 'gemini',
    model: 'gemini-3.5-flash-lite',
  },
  gemini35liteor: {
    name: 'Google Gemini 3.5 Flash Lite (OpenRouter)',
    kind: 'openai',
    model: 'google/gemini-3.5-flash-lite',
    baseURL: 'https://openrouter.ai/api/v1',
    costModel: { promptPerMillionUsd: 0.3, completionPerMillionUsd: 2.5 },
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
  if (preset.kind === 'gemini') {
    return new GeminiEngine({
      apiKey,
      model: preset.model,
      timeoutMs,
      fetchImpl,
      costModel: preset.costModel,
    });
  }
  return new OpenAICompatibleEngine({
    baseURL: preset.baseURL!,
    apiKey,
    model: preset.model,
    timeoutMs,
    fetchImpl,
    costModel: preset.costModel,
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
      costModel: config.costModel,
    });
  }

  if (config.kind === 'gemini') {
    if (!config.apiKey) throw new Error('apiKey is required for gemini');
    return new GeminiEngine({
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
      fetchImpl: config.fetchImpl,
      costModel: config.costModel,
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
    costModel: config.costModel,
  });
}
