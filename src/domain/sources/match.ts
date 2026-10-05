import type { ModelAlias, ModelEntry } from '../types.js';

export const PROVIDER_SLUG_BY_SOURCE_PROVIDER: Record<string, string> = {
  // LiteLLM provider names
  anthropic: 'anthropic',
  openai: 'openai',
  gemini: 'google',
  xai: 'x-ai',
  deepseek: 'deepseek',
  mistral: 'mistralai',
  moonshot: 'moonshotai',
  zai: 'z-ai',
  dashscope: 'qwen',
  minimax: 'minimax',

  // AA creator names
  Anthropic: 'anthropic',
  OpenAI: 'openai',
  Google: 'google',
  xAI: 'x-ai',
  DeepSeek: 'deepseek',
  Mistral: 'mistralai',
  'Moonshot AI': 'moonshotai',
  'Z AI': 'z-ai',
  Alibaba: 'qwen',
  MiniMax: 'minimax',
  Meta: 'meta-llama',
};

export function normalizeModelKey(s: string): string {
  let key = s.toLowerCase();

  // Drop everything up to the last '/'
  if (key.includes('/')) {
    key = key.slice(key.lastIndexOf('/') + 1);
  }

  // Drop trailing :variant (e.g., :free, :batch, :thinking)
  key = key.replace(/:[a-z0-9_-]+$/i, '');

  // Drop parenthetical parts like " (high)"
  key = key.replace(/\s*\([^)]*\)/g, '');

  // Drop date suffixes -YYYYMMDD or -YYYY-MM-DD
  key = key.replace(/-\d{8}$/, '');
  key = key.replace(/-\d{4}-\d{2}-\d{2}$/, '');

  // Drop a trailing -latest
  key = key.replace(/-latest$/, '');

  // Replace '.', '_' and spaces with '-'
  key = key.replace(/[._\s]+/g, '-');

  // Collapse repeated '-' and trim
  key = key.replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  return key;
}

export function createModelMatcher(
  models: ModelEntry[],
  aliases: ModelAlias[],
  source: ModelAlias['source'],
): (sourceId: string, providerHint?: string) => string | undefined {
  return (sourceId: string, providerHint?: string): string | undefined => {
    // 1. Exact alias for this source
    const alias = aliases.find((a) => a.source === source && a.sourceId === sourceId);
    if (alias) {
      return alias.modelId;
    }

    const normKey = normalizeModelKey(sourceId);
    if (!normKey) {
      return undefined;
    }

    // 2. Same provider (when hint maps to a known provider slug) and equal normalized key
    if (providerHint) {
      const mappedProvider = PROVIDER_SLUG_BY_SOURCE_PROVIDER[providerHint] ?? providerHint;
      const providerMatches = models.filter(
        (m) => m.provider === mappedProvider && normalizeModelKey(m.id) === normKey,
      );
      if (providerMatches.length === 1 && providerMatches[0]) {
        return providerMatches[0].id;
      }
    }

    // 3. Unique model across all providers with an equal normalized key
    const globalMatches = models.filter((m) => normalizeModelKey(m.id) === normKey);
    if (globalMatches.length === 1 && globalMatches[0]) {
      return globalMatches[0].id;
    }

    return undefined;
  };
}
