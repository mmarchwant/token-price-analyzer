import { describe, expect, it } from 'vitest';
import {
  buildCompareHref,
  buildCompareRows,
  clearStoredCompareRefs,
  getStoredCompareRefs,
  parseItems,
  serializeItems,
  setStoredCompareRefs,
  type CompareRef,
} from './compareItems';
import sampleSnapshot from '../../domain/__fixtures__/sample-snapshot.json';
import type { ModelEntry, SubscriptionPlan, UsageProfile } from '../../domain/types';

describe('compareItems domain helpers', () => {
  describe('parseItems', () => {
    it('parses valid model and subscription tokens', () => {
      const input = ['m:openai/gpt-4o', 's:chatgpt-plus'];
      const refs = parseItems(input);
      expect(refs).toEqual([
        { kind: 'model', id: 'openai/gpt-4o' },
        { kind: 'plan', id: 'chatgpt-plus' },
      ]);
    });

    it('splits comma-separated string tokens', () => {
      const input = ['m:openai/gpt-4o,s:chatgpt-plus'];
      const refs = parseItems(input);
      expect(refs).toEqual([
        { kind: 'model', id: 'openai/gpt-4o' },
        { kind: 'plan', id: 'chatgpt-plus' },
      ]);
    });

    it('deduplicates items', () => {
      const input = ['m:openai/gpt-4o', 's:chatgpt-plus', 'm:openai/gpt-4o'];
      const refs = parseItems(input);
      expect(refs).toHaveLength(2);
      expect(refs[0]).toEqual({ kind: 'model', id: 'openai/gpt-4o' });
    });

    it('caps output at 4 items', () => {
      const input = ['m:m1', 'm:m2', 's:s1', 's:s2', 'm:m3'];
      const refs = parseItems(input);
      expect(refs).toHaveLength(4);
      expect(refs.map((r) => r.id)).toEqual(['m1', 'm2', 's1', 's2']);
    });

    it('ignores invalid prefixes or empty IDs', () => {
      const input = ['invalid:x', 'm:', 's:', 'x:123', 'm:valid-id'];
      const refs = parseItems(input);
      expect(refs).toEqual([{ kind: 'model', id: 'valid-id' }]);
    });
  });

  describe('serializeItems', () => {
    it('serializes CompareRef array back to string tokens', () => {
      const refs: CompareRef[] = [
        { kind: 'model', id: 'openai/gpt-4o' },
        { kind: 'plan', id: 'chatgpt-plus' },
      ];
      expect(serializeItems(refs)).toEqual(['m:openai/gpt-4o', 's:chatgpt-plus']);
    });
  });

  describe('buildCompareHref', () => {
    it('appends item when existing items count is less than 4', () => {
      const existing: CompareRef[] = [{ kind: 'model', id: 'm1' }];
      const add: CompareRef = { kind: 'plan', id: 's1' };
      const href = buildCompareHref(existing, add);
      expect(href).toBe('/compare?items=m%3Am1%2Cs%3As1');
    });

    it('does not append duplicate item', () => {
      const existing: CompareRef[] = [{ kind: 'model', id: 'm1' }];
      const add: CompareRef = { kind: 'model', id: 'm1' };
      const href = buildCompareHref(existing, add);
      expect(href).toBe('/compare?items=m%3Am1');
    });

    it('replaces the last item when existing items count is 4', () => {
      const existing: CompareRef[] = [
        { kind: 'model', id: 'm1' },
        { kind: 'model', id: 'm2' },
        { kind: 'plan', id: 's1' },
        { kind: 'plan', id: 's2' },
      ];
      const add: CompareRef = { kind: 'model', id: 'm3' };
      const href = buildCompareHref(existing, add);
      expect(href).toBe('/compare?items=m%3Am1%2Cm%3Am2%2Cs%3As1%2Cm%3Am3');
    });
  });

  describe('localStorage sync', () => {
    it('saves and reads stored compare refs', () => {
      const refs: CompareRef[] = [
        { kind: 'model', id: 'openai/gpt-4o' },
        { kind: 'plan', id: 'chatgpt-plus' },
      ];
      setStoredCompareRefs(refs);
      const stored = getStoredCompareRefs();
      expect(stored).toEqual(refs);

      clearStoredCompareRefs();
    });
  });

  describe('buildCompareRows', () => {
    const models = sampleSnapshot.models as unknown as ModelEntry[];
    const subscriptions = sampleSnapshot.subscriptions as unknown as SubscriptionPlan[];
    const profile: UsageProfile = {
      id: 'test',
      name: { en: 'Test Profile', pl: 'Testowy profil' },
      description: { en: '', pl: '' },
      inputTokensPerTask: 2000,
      outputTokensPerTask: 500,
      cachedInputShare: 0,
      tasksPerDay: 50,
      workDaysPerMonth: 20,
      qualityDimension: 'intelligence',
      allowBatch: false,
      isPreset: false,
    };
    const settings = {
      currency: 'USD' as const,
      fx: {
        base: 'USD' as const,
        date: '2025-01-01',
        rates: { USD: 1 as const, EUR: 0.9, PLN: 4.0 },
      },
      isVatApplied: false,
      activeHoursPerDay: 8,
      snapshotDate: '2025-01-01',
    };

    it('generates rows and computes best and worst flags for numeric cells', () => {
      const refs: CompareRef[] = [
        { kind: 'model', id: models[0]!.id },
        { kind: 'model', id: models[1]!.id },
      ];

      const rows = buildCompareRows(refs, { models, subscriptions, fees: [] }, profile, settings);

      expect(rows.length).toBeGreaterThan(0);
      const monthlyCostRow = rows.find((r) => r.key === 'monthlyCost');
      expect(monthlyCostRow).toBeDefined();
      expect(monthlyCostRow?.better).toBe('lower');

      const key0 = `model:${models[0]!.id}`;
      const key1 = `model:${models[1]!.id}`;
      const cell0 = monthlyCostRow!.cells[key0];
      const cell1 = monthlyCostRow!.cells[key1];

      expect(cell0).toBeDefined();
      expect(cell1).toBeDefined();

      if (cell0!.numericValue !== cell1!.numericValue) {
        expect(cell0!.isBest || cell0!.isWorst).toBe(true);
        expect(cell1!.isBest || cell1!.isWorst).toBe(true);
      }
    });
  });
});
