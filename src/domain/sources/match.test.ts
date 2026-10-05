import { describe, expect, it } from 'vitest';
import type { ModelAlias, ModelEntry } from '../types.js';
import {
  createModelMatcher,
  normalizeModelKey,
  PROVIDER_SLUG_BY_SOURCE_PROVIDER,
} from './match.js';

describe('normalizeModelKey', () => {
  it('normalizes model keys according to requirements', () => {
    expect(normalizeModelKey('claude-sonnet-5-5')).toBe('claude-sonnet-5-5');
    expect(normalizeModelKey('anthropic/claude-sonnet-5.5')).toBe('claude-sonnet-5-5');
    expect(normalizeModelKey('openai/gpt-6-sol')).toBe('gpt-6-sol');
    expect(normalizeModelKey('gemini/gemini-3.1-pro-preview')).toBe('gemini-3-1-pro-preview');
    expect(normalizeModelKey('claude-opus-5-5-20260922')).toBe('claude-opus-5-5');
    expect(normalizeModelKey('claude-opus-5.5-2026-09-22')).toBe('claude-opus-5-5');
    expect(normalizeModelKey('mistral-small-2603')).toBe('mistral-small-2603');
    expect(normalizeModelKey('mistral-small')).toBe('mistral-small');
    expect(normalizeModelKey('openai/gpt-4o:free')).toBe('gpt-4o');
    expect(normalizeModelKey('openai/gpt-4o (high)')).toBe('gpt-4o');
    expect(normalizeModelKey('vendor/model-name-latest')).toBe('model-name');
  });
});

describe('createModelMatcher', () => {
  const sampleModels = [
    {
      id: 'anthropic/claude-sonnet-5.5',
      provider: 'anthropic',
    },
    {
      id: 'anthropic/claude-opus-5.5',
      provider: 'anthropic',
    },
    {
      id: 'openai/gpt-6-sol',
      provider: 'openai',
    },
    {
      id: 'google/gemini-3.1-pro-preview',
      provider: 'google',
    },
    {
      id: 'mistralai/mistral-small',
      provider: 'mistralai',
    },
    {
      id: 'mistralai/mistral-small-2603',
      provider: 'mistralai',
    },
    {
      id: 'provider1/ambiguous-model',
      provider: 'provider1',
    },
    {
      id: 'provider2/ambiguous-model',
      provider: 'provider2',
    },
  ] as unknown as ModelEntry[];

  const sampleAliases: ModelAlias[] = [
    {
      source: 'litellm',
      sourceId: 'custom-alias-id',
      modelId: 'anthropic/claude-sonnet-5.5',
    },
  ];

  it('resolves exact match by alias first', () => {
    const matcher = createModelMatcher(sampleModels, sampleAliases, 'litellm');
    expect(matcher('custom-alias-id')).toBe('anthropic/claude-sonnet-5.5');
  });

  it('matches by provider hint and normalized key', () => {
    const matcher = createModelMatcher(sampleModels, [], 'litellm');
    expect(matcher('claude-sonnet-5-5', 'anthropic')).toBe('anthropic/claude-sonnet-5.5');
    expect(matcher('claude-opus-5-5-20260922', 'Anthropic')).toBe('anthropic/claude-opus-5.5');
  });

  it('matches unique model globally when no provider hint or hint does not match', () => {
    const matcher = createModelMatcher(sampleModels, [], 'litellm');
    expect(matcher('gpt-6-sol')).toBe('openai/gpt-6-sol');
    expect(matcher('gemini-3.1-pro-preview')).toBe('google/gemini-3.1-pro-preview');
  });

  it('keeps mistral-small-2603 distinct from mistral-small', () => {
    const matcher = createModelMatcher(sampleModels, [], 'litellm');
    expect(matcher('mistral-small-2603')).toBe('mistralai/mistral-small-2603');
    expect(matcher('mistral-small')).toBe('mistralai/mistral-small');
  });

  it('returns undefined for ambiguous keys across two providers without matching hint', () => {
    const matcher = createModelMatcher(sampleModels, [], 'litellm');
    expect(matcher('ambiguous-model')).toBeUndefined();
  });

  it('exports PROVIDER_SLUG_BY_SOURCE_PROVIDER mapping', () => {
    expect(PROVIDER_SLUG_BY_SOURCE_PROVIDER.anthropic).toBe('anthropic');
    expect(PROVIDER_SLUG_BY_SOURCE_PROVIDER.Anthropic).toBe('anthropic');
    expect(PROVIDER_SLUG_BY_SOURCE_PROVIDER.gemini).toBe('google');
  });
});
