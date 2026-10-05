import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../src/domain/types';
import { loadCurated, type CuratedData } from './curated';
import { validateCurated } from './validate-curated';

function createMockCurated(): CuratedData {
  return {
    profiles: [
      {
        id: 'test-profile-1',
        name: { en: 'Test 1', pl: 'Test 1' },
        description: { en: 'Desc 1', pl: 'Opis 1' },
        inputTokensPerTask: 1000,
        outputTokensPerTask: 200,
        cachedInputShare: 0,
        tasksPerDay: 10,
        workDaysPerMonth: 22,
        qualityDimension: 'intelligence',
        allowBatch: false,
        isPreset: true,
      },
    ],
    plans: [
      {
        id: 'test-plan-1',
        provider: 'test',
        providerName: 'Test Provider',
        name: 'Test Plan',
        priceUsdMonthly: 10,
        url: 'https://example.com/pricing',
        lastVerified: '2026-10-01',
        confidence: 'official',
        primaryModelId: 'vendor/model-a',
        includedModelIds: ['vendor/model-a', 'vendor/model-b'],
        features: {
          codingAgents: [],
          imageGeneration: false,
          deepResearch: false,
          apiAccess: false,
        },
        limit: { kind: 'unknown' },
        unitLabel: { en: 'message', pl: 'wiadomość' },
        referenceUnit: {
          inputTokens: 1000,
          outputTokens: 200,
          cachedInputShare: 0,
        },
        notes: { en: 'Note', pl: 'Notatka' },
        sources: [{ label: 'Source', url: 'https://example.com/pricing' }],
      },
    ],
    fees: [
      {
        vendor: 'test-vendor',
        purchaseFeePct: 0,
        minFeeUsd: 0,
        minTopUpUsd: 0,
        notes: { en: 'Note', pl: 'Notatka' },
        sourceUrl: 'https://example.com/billing',
        lastVerified: '2026-10-01',
      },
    ],
    qualityOverrides: [
      {
        modelId: 'vendor/model-a',
        tier: 'S',
        force: true,
        note: { en: 'Override note', pl: 'Notatka nadpisania' },
      },
    ],
    aliases: [
      {
        source: 'litellm',
        sourceId: 'litellm-model-1',
        modelId: 'vendor/model-a',
      },
    ],
  };
}

describe('validateCurated', () => {
  const fixedNow = new Date('2026-10-05T12:00:00Z');

  it('validates a correct curated dataset without snapshot', () => {
    const data = createMockCurated();
    const res = validateCurated(data, undefined, fixedNow);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it('detects duplicate profile IDs', () => {
    const data = createMockCurated();
    const first = data.profiles[0];
    if (first) data.profiles.push({ ...first });
    const res = validateCurated(data, undefined, fixedNow);
    expect(res.errors).toContain("Duplicate profile id: 'test-profile-1'");
  });

  it('detects duplicate plan IDs', () => {
    const data = createMockCurated();
    const first = data.plans[0];
    if (first) data.plans.push({ ...first });
    const res = validateCurated(data, undefined, fixedNow);
    expect(res.errors).toContain("Duplicate plan id: 'test-plan-1'");
  });

  it('detects duplicate fee vendors', () => {
    const data = createMockCurated();
    const first = data.fees[0];
    if (first) data.fees.push({ ...first });
    const res = validateCurated(data, undefined, fixedNow);
    expect(res.errors).toContain("Duplicate fee vendor: 'test-vendor'");
  });

  it('detects duplicate quality override modelIds', () => {
    const data = createMockCurated();
    const first = data.qualityOverrides[0];
    if (first) data.qualityOverrides.push({ ...first });
    const res = validateCurated(data, undefined, fixedNow);
    expect(res.errors).toContain("Duplicate quality override modelId: 'vendor/model-a'");
  });

  it('detects duplicate alias keys', () => {
    const data = createMockCurated();
    const first = data.aliases[0];
    if (first) data.aliases.push({ ...first });
    const res = validateCurated(data, undefined, fixedNow);
    expect(res.errors).toContain(
      "Duplicate alias for source 'litellm' and sourceId 'litellm-model-1'",
    );
  });

  it('flags future lastVerified dates as errors', () => {
    const data = createMockCurated();
    if (data.plans[0]) data.plans[0].lastVerified = '2026-10-10';
    if (data.fees[0]) data.fees[0].lastVerified = '2026-10-10';
    const res = validateCurated(data, undefined, fixedNow);
    expect(res.errors).toContain(
      "Plan 'test-plan-1' lastVerified date (2026-10-10) is in the future",
    );
    expect(res.errors).toContain(
      "Fee vendor 'test-vendor' lastVerified date (2026-10-10) is in the future",
    );
  });

  it('flags lastVerified older than 45 days as warnings', () => {
    const data = createMockCurated();
    if (data.plans[0]) data.plans[0].lastVerified = '2026-08-01';
    if (data.fees[0]) data.fees[0].lastVerified = '2026-08-01';
    const res = validateCurated(data, undefined, fixedNow);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toContain(
      "Plan 'test-plan-1' lastVerified date (2026-08-01) is older than 45 days",
    );
    expect(res.warnings).toContain(
      "Fee vendor 'test-vendor' lastVerified date (2026-08-01) is older than 45 days",
    );
  });

  it('issues warnings when models are not in snapshot', () => {
    const data = createMockCurated();
    const mockSnapshot: Snapshot = {
      schemaVersion: 1,
      generatedAt: '2026-10-05T00:00:00Z',
      sources: [],
      fx: {
        base: 'USD',
        date: '2026-10-05',
        rates: { USD: 1, PLN: 4.0, EUR: 0.9 },
      },
      models: [],
      subscriptions: [],
      usageProfiles: [],
      channelFees: [],
      diagnostics: { unmatched: [], warnings: [] },
    };

    const res = validateCurated(data, mockSnapshot, fixedNow);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toContain(
      "Plan 'test-plan-1' primaryModelId 'vendor/model-a' not found in snapshot models",
    );
    expect(res.warnings).toContain(
      "Plan 'test-plan-1' includedModelId 'vendor/model-a' not found in snapshot models",
    );
    expect(res.warnings).toContain(
      "Plan 'test-plan-1' includedModelId 'vendor/model-b' not found in snapshot models",
    );
    expect(res.warnings).toContain(
      "Quality override modelId 'vendor/model-a' not found in snapshot models",
    );
    expect(res.warnings).toContain(
      "Alias target modelId 'vendor/model-a' not found in snapshot models",
    );
  });

  it('validates committed curated dataset files with zero errors', () => {
    const curated = loadCurated('data/curated');
    const res = validateCurated(curated, undefined, fixedNow);
    expect(res.errors).toEqual([]);
  });
});
