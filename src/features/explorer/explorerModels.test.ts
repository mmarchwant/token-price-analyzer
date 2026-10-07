import { describe, expect, it } from 'vitest';
import type { ModelEntry } from '../../domain/types';
import { filterExplorerModels, parseExplorerSearch } from './explorerModels';

const models = [
  {
    id: 'anthropic/claude-sonnet',
    name: 'Claude Sonnet',
    provider: 'anthropic',
    providerName: 'Anthropic',
  },
  { id: 'openai/gpt-5', name: 'GPT-5', provider: 'openai', providerName: 'OpenAI' },
] as ModelEntry[];

describe('parseExplorerSearch', () => {
  it('reads and trims the search query parameter', () => {
    expect(parseExplorerSearch('?search=Claude%20Sonnet&source=advisor')).toBe('Claude Sonnet');
    expect(parseExplorerSearch('?search=%20GPT-5%20')).toBe('GPT-5');
    expect(parseExplorerSearch('?other=value')).toBe('');
  });
});

describe('filterExplorerModels', () => {
  it('matches canonical models by name, provider, or canonical id', () => {
    expect(filterExplorerModels(models, 'claude')).toEqual([models[0]]);
    expect(filterExplorerModels(models, 'OPENAI')).toEqual([models[1]]);
    expect(filterExplorerModels(models, 'anthropic/claude')).toEqual([models[0]]);
  });

  it('returns all models for an empty search and none for an unknown search', () => {
    expect(filterExplorerModels(models, '  ')).toEqual(models);
    expect(filterExplorerModels(models, 'does not exist')).toEqual([]);
  });
});
