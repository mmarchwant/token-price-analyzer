import { describe, it, expect } from 'vitest';
import { profileSummary, referenceModels } from './profilePreview';
import type { ModelEntry, UsageProfile } from '../../domain/types';

describe('profilePreview', () => {
  const profile: UsageProfile = {
    id: 'coding-agent',
    name: { en: 'Coding Agent', pl: 'Agent Programistyczny' },
    description: { en: 'Test profile', pl: 'Profil testowy' },
    inputTokensPerTask: 80000,
    outputTokensPerTask: 2500,
    cachedInputShare: 0.9,
    tasksPerDay: 250,
    workDaysPerMonth: 22,
    qualityDimension: 'coding',
    allowBatch: false,
    isPreset: true,
  };

  const sampleModels: ModelEntry[] = [
    {
      id: 'provider/cheap-model',
      name: 'Cheap Model',
      provider: 'provider',
      providerName: 'Provider',
      inputModalities: ['text'],
      outputModalities: ['text'],
      capabilities: { tools: true, reasoning: false, structuredOutputs: false, imageInput: false },
      openWeights: false,
      quality: { intelligence: 60, coding: 50, agentic: 40, source: 'manual', tier: 'C' },
      offers: [
        {
          channel: 'direct',
          vendor: 'provider',
          sourceId: 'src1',
          inputPerMTok: 0.1,
          outputPerMTok: 0.4,
          isFree: false,
        },
      ],
    },
    {
      id: 'provider/best-model',
      name: 'Best Model',
      provider: 'provider',
      providerName: 'Provider',
      inputModalities: ['text'],
      outputModalities: ['text'],
      capabilities: { tools: true, reasoning: true, structuredOutputs: true, imageInput: false },
      openWeights: false,
      quality: { intelligence: 95, coding: 92, agentic: 90, source: 'manual', tier: 'S' },
      offers: [
        {
          channel: 'direct',
          vendor: 'provider',
          sourceId: 'src2',
          inputPerMTok: 3.0,
          outputPerMTok: 15.0,
          isFree: false,
        },
      ],
    },
    {
      id: 'provider/good-value-model',
      name: 'Good Value Model',
      provider: 'provider',
      providerName: 'Provider',
      inputModalities: ['text'],
      outputModalities: ['text'],
      capabilities: { tools: true, reasoning: true, structuredOutputs: false, imageInput: false },
      openWeights: false,
      quality: { intelligence: 85, coding: 80, agentic: 75, source: 'manual', tier: 'A' },
      offers: [
        {
          channel: 'direct',
          vendor: 'provider',
          sourceId: 'src3',
          inputPerMTok: 0.5,
          outputPerMTok: 1.5,
          isFree: false,
        },
      ],
    },
    {
      id: 'provider/free-model',
      name: 'Free Model',
      provider: 'provider',
      providerName: 'Provider',
      inputModalities: ['text'],
      outputModalities: ['text'],
      capabilities: { tools: true, reasoning: false, structuredOutputs: false, imageInput: false },
      openWeights: false,
      quality: { intelligence: 50, coding: 40, agentic: 30, source: 'manual', tier: 'D' },
      offers: [
        {
          channel: 'openrouter-free',
          vendor: 'provider',
          sourceId: 'src4',
          inputPerMTok: 0,
          outputPerMTok: 0,
          isFree: true,
        },
      ],
    },
  ];

  it('formats profileSummary correctly', () => {
    const summary = profileSummary(profile);
    expect(summary).toBe('80k in / 2.5k out · 90% cached · 250×/day');
  });

  it('selects reference models correctly', () => {
    const result = referenceModels(sampleModels, profile);

    expect(result.bestQuality?.model.id).toBe('provider/best-model');
    expect(result.bestQuality?.qualityScore).toBe(92);

    expect(result.bestValue?.model.id).toBe('provider/good-value-model');
    expect(result.cheapestPaid?.model.id).toBe('provider/cheap-model');
  });
});
