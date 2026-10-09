import { describe, expect, it } from 'vitest';
import { filterModelsByIntent, matchesModelIntent, matchesPlanIntent } from './model-intent';
import type { ModelEntry, SubscriptionPlan } from './types';

const model = (overrides: Partial<ModelEntry>): ModelEntry => ({
  id: 'test/model',
  name: 'Test',
  provider: 'test',
  providerName: 'Test',
  inputModalities: ['text'],
  outputModalities: ['text'],
  capabilities: { tools: false, reasoning: false, structuredOutputs: false, imageInput: false },
  openWeights: false,
  offers: [
    {
      channel: 'direct',
      vendor: 'Test',
      sourceId: 'test',
      inputPerMTok: 1,
      outputPerMTok: 1,
      isFree: false,
    },
  ],
  quality: { source: 'none' },
  ...overrides,
});

describe('model intent', () => {
  it('uses capabilities and modalities instead of model names', () => {
    const coding = model({
      capabilities: { tools: false, reasoning: true, structuredOutputs: false, imageInput: false },
      quality: { source: 'manual', coding: 80 },
    });
    const agent = model({
      capabilities: { tools: true, reasoning: false, structuredOutputs: false, imageInput: false },
      quality: { source: 'manual', agentic: 80 },
    });
    const image = model({ outputModalities: ['image'] });
    const video = model({ outputModalities: ['video'] });
    expect(matchesModelIntent(coding, 'coding')).toBe(true);
    expect(matchesModelIntent(agent, 'agents')).toBe(true);
    expect(matchesModelIntent(image, 'image-generation')).toBe(true);
    expect(matchesModelIntent(video, 'video-generation')).toBe(true);
    expect(filterModelsByIntent([coding, image], 'text-reasoning')).toEqual([coding]);
    expect(
      matchesModelIntent(
        model({
          capabilities: {
            tools: true,
            reasoning: false,
            structuredOutputs: false,
            imageInput: false,
          },
        }),
        'agents',
      ),
    ).toBe(false);
  });

  it('keeps coding-agent plans visible for coding and agent intents', () => {
    const codingAgentPlan = {
      features: { codingAgents: ['copilot'], imageGeneration: false },
    } as SubscriptionPlan;

    expect(matchesPlanIntent(codingAgentPlan, [], 'coding')).toBe(true);
    expect(matchesPlanIntent(codingAgentPlan, [], 'agents')).toBe(true);
  });
});
