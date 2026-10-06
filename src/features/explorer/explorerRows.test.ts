import { describe, expect, it } from 'vitest';
import type { ModelEntry, UsageProfile } from '../../domain/types';
import { buildExplorerRows } from './explorerRows';

const mockProfile: UsageProfile = {
  id: 'test-profile',
  name: { en: 'Test Profile', pl: 'Profil testowy' },
  description: { en: 'Desc', pl: 'Opis' },
  inputTokensPerTask: 1000,
  outputTokensPerTask: 200,
  cachedInputShare: 0,
  tasksPerDay: 10,
  workDaysPerMonth: 20,
  qualityDimension: 'intelligence',
  allowBatch: true,
  isPreset: true,
};

const freeModel: ModelEntry = {
  id: 'provider/free-model',
  name: 'Free Model',
  provider: 'provider',
  providerName: 'Provider',
  inputModalities: ['text'],
  outputModalities: ['text'],
  capabilities: {
    tools: true,
    reasoning: false,
    structuredOutputs: false,
    imageInput: false,
  },
  openWeights: true,
  offers: [
    {
      channel: 'openrouter-free',
      vendor: 'openrouter',
      sourceId: 'openrouter',
      inputPerMTok: 0,
      outputPerMTok: 0,
      isFree: true,
    },
  ],
  quality: {
    intelligence: 50,
    source: 'artificial-analysis',
  },
};

const batchOnlyModel: ModelEntry = {
  id: 'provider/batch-model',
  name: 'Batch Model',
  provider: 'provider',
  providerName: 'Provider',
  inputModalities: ['text'],
  outputModalities: ['text'],
  capabilities: {
    tools: false,
    reasoning: false,
    structuredOutputs: false,
    imageInput: false,
  },
  openWeights: false,
  offers: [
    {
      channel: 'openrouter-batch',
      vendor: 'openrouter',
      sourceId: 'openrouter',
      inputPerMTok: 0.5,
      outputPerMTok: 1.0,
      isFree: false,
    },
  ],
  quality: {
    intelligence: 60,
    source: 'artificial-analysis',
  },
};

const paidModel1: ModelEntry = {
  id: 'provider/paid-model-1',
  name: 'Paid Model 1',
  provider: 'provider',
  providerName: 'Provider',
  inputModalities: ['text'],
  outputModalities: ['text'],
  capabilities: {
    tools: true,
    reasoning: true,
    structuredOutputs: true,
    imageInput: true,
  },
  openWeights: false,
  offers: [
    {
      channel: 'direct',
      vendor: 'provider',
      sourceId: 'direct',
      inputPerMTok: 1.0,
      outputPerMTok: 3.0,
      isFree: false,
    },
  ],
  quality: {
    intelligence: 80,
    source: 'artificial-analysis',
  },
};

const paidModel2: ModelEntry = {
  id: 'provider/paid-model-2',
  name: 'Paid Model 2',
  provider: 'provider',
  providerName: 'Provider',
  inputModalities: ['text'],
  outputModalities: ['text'],
  capabilities: {
    tools: false,
    reasoning: false,
    structuredOutputs: false,
    imageInput: false,
  },
  openWeights: false,
  offers: [
    {
      channel: 'openrouter',
      vendor: 'openrouter',
      sourceId: 'openrouter',
      inputPerMTok: 2.0,
      outputPerMTok: 6.0,
      isFree: false,
    },
  ],
  quality: {
    intelligence: 70, // Higher cost and lower quality than paidModel1 -> dominated by paidModel1
    source: 'artificial-analysis',
  },
};

describe('buildExplorerRows', () => {
  it('skips free models when includeFreeModels is false', () => {
    const models = [freeModel, paidModel1];

    const rowsWithoutFree = buildExplorerRows(
      models,
      mockProfile,
      { includeFreeModels: false, includeBatchOffers: true },
      20,
    );
    expect(rowsWithoutFree).toHaveLength(1);
    expect(rowsWithoutFree[0]?.model.id).toBe('provider/paid-model-1');

    const rowsWithFree = buildExplorerRows(
      models,
      mockProfile,
      { includeFreeModels: true, includeBatchOffers: true },
      20,
    );
    expect(rowsWithFree).toHaveLength(2);
  });

  it('skips batch offers when includeBatchOffers or profile.allowBatch is false', () => {
    const models = [batchOnlyModel, paidModel1];

    const rowsBatchDisabledSettings = buildExplorerRows(
      models,
      mockProfile,
      { includeFreeModels: true, includeBatchOffers: false },
      20,
    );
    expect(rowsBatchDisabledSettings).toHaveLength(1);
    expect(rowsBatchDisabledSettings[0]?.model.id).toBe('provider/paid-model-1');

    const noBatchProfile = { ...mockProfile, allowBatch: false };
    const rowsBatchDisabledProfile = buildExplorerRows(
      models,
      noBatchProfile,
      { includeFreeModels: true, includeBatchOffers: true },
      20,
    );
    expect(rowsBatchDisabledProfile).toHaveLength(1);
    expect(rowsBatchDisabledProfile[0]?.model.id).toBe('provider/paid-model-1');
  });

  it('correctly calculates Pareto frontier across candidate models', () => {
    const models = [paidModel1, paidModel2];
    const rows = buildExplorerRows(
      models,
      mockProfile,
      { includeFreeModels: true, includeBatchOffers: true },
      20,
    );

    const row1 = rows.find((r) => r.model.id === 'provider/paid-model-1');
    const row2 = rows.find((r) => r.model.id === 'provider/paid-model-2');

    expect(row1?.isPareto).toBe(true);
    expect(row2?.isPareto).toBe(false);
  });

  it('marks isNew flag when model id is in newModelIds set or array', () => {
    const models = [paidModel1];
    const rows = buildExplorerRows(
      models,
      mockProfile,
      { includeFreeModels: true, includeBatchOffers: true },
      20,
      { newModelIds: new Set(['provider/paid-model-1']) },
    );

    expect(rows[0]?.isNew).toBe(true);
  });
});
