import { describe, expect, it } from 'vitest';
import { runUpdateHistory, type UpdateHistoryDeps } from './update-history';

describe('scripts/update-history.ts', () => {
  it('reads snapshot, updates history and index using injected deps', async () => {
    const mockFiles: Record<string, string> = {
      'public/data/snapshot.json': JSON.stringify({
        schemaVersion: 1,
        generatedAt: '2026-05-15T08:00:00.000Z',
        sources: [],
        fx: { base: 'USD', date: '2026-05-15', rates: { USD: 1, PLN: 4, EUR: 0.9 } },
        models: [
          {
            id: 'openai/gpt-4o',
            name: 'GPT-4o',
            provider: 'openai',
            providerName: 'OpenAI',
            inputModalities: ['text'],
            outputModalities: ['text'],
            capabilities: {
              tools: true,
              reasoning: false,
              structuredOutputs: true,
              imageInput: false,
            },
            openWeights: false,
            quality: { source: 'none' },
            offers: [
              {
                channel: 'openrouter',
                vendor: 'openai',
                sourceId: 'openai/gpt-4o',
                inputPerMTok: 2.5,
                outputPerMTok: 10.0,
                isFree: false,
              },
            ],
          },
        ],
        subscriptions: [
          {
            id: 'chatgpt-plus',
            provider: 'openai',
            providerName: 'OpenAI',
            name: 'ChatGPT Plus',
            priceUsdMonthly: 20,
            url: 'https://chatgpt.com',
            lastVerified: '2026-05-15',
            confidence: 'official',
            primaryModelId: 'openai/gpt-4o',
            includedModelIds: ['openai/gpt-4o'],
            features: {
              codingAgents: [],
              imageGeneration: true,
              deepResearch: false,
              apiAccess: false,
            },
            limit: { kind: 'unknown' },
            unitLabel: { en: 'units', pl: 'jednostki' },
            referenceUnit: { inputTokens: 1000, outputTokens: 1000, cachedInputShare: 0 },
            notes: { en: 'notes', pl: 'notatki' },
            sources: [{ label: 's', url: 'https://chatgpt.com' }],
          },
        ],
        usageProfiles: [],
        channelFees: [],
        diagnostics: { unmatched: [], warnings: [] },
      }),
    };

    const writtenFiles: Record<string, string> = {};
    const logs: string[] = [];

    const deps: UpdateHistoryDeps = {
      readFile: async (p) => {
        if (writtenFiles[p]) return writtenFiles[p]!;
        if (mockFiles[p]) return mockFiles[p]!;
        throw new Error(`File not found: ${p}`);
      },
      writeFile: async (p, c) => {
        writtenFiles[p] = c;
      },
      exists: async (p) => Boolean(writtenFiles[p] || mockFiles[p]),
      now: new Date('2026-05-15T08:00:00.000Z'),
      log: (msg) => logs.push(msg),
    };

    await runUpdateHistory(deps);

    expect(writtenFiles['public/data/history/2026.json']).toBeDefined();
    expect(writtenFiles['public/data/history/index.json']).toBeDefined();

    const history2026 = JSON.parse(writtenFiles['public/data/history/2026.json']!);
    expect(history2026.year).toBe(2026);
    expect(history2026.models['openai/gpt-4o']).toBeDefined();
    expect(history2026.models['openai/gpt-4o'].points).toEqual([['2026-05-15', 2.5, 10.0]]);
    expect(history2026.subscriptions['chatgpt-plus'].points).toEqual([['2026-05-15', 20]]);

    const index = JSON.parse(writtenFiles['public/data/history/index.json']!);
    expect(index.years).toEqual([2026]);
  });
});
