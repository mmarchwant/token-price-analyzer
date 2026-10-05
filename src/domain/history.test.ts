import { describe, expect, it } from 'vitest';
import { appendSnapshotToHistory, priceAt, referenceOffer, updateHistoryIndex } from './history';
import type { HistoryIndex, ModelEntry, PriceHistory, Snapshot } from './types';

describe('src/domain/history.ts', () => {
  describe('referenceOffer', () => {
    it('selects cheapest non-free non-batch openrouter offer if available', () => {
      const model: ModelEntry = {
        id: 'test/model',
        name: 'Test Model',
        provider: 'test',
        providerName: 'Test Provider',
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
            channel: 'openrouter-free',
            vendor: 'openrouter',
            sourceId: 'test/model',
            inputPerMTok: 0,
            outputPerMTok: 0,
            isFree: true,
          },
          {
            channel: 'openrouter-batch',
            vendor: 'openrouter',
            sourceId: 'test/model',
            inputPerMTok: 0.1,
            outputPerMTok: 0.2,
            isFree: false,
          },
          {
            channel: 'openrouter',
            vendor: 'vendor1',
            sourceId: 'test/model',
            inputPerMTok: 1.0,
            outputPerMTok: 2.0,
            isFree: false,
          },
          {
            channel: 'openrouter',
            vendor: 'vendor2',
            sourceId: 'test/model',
            inputPerMTok: 0.5,
            outputPerMTok: 1.0,
            isFree: false,
          },
          {
            channel: 'direct',
            vendor: 'direct-vendor',
            sourceId: 'test/model',
            inputPerMTok: 0.1,
            outputPerMTok: 0.1,
            isFree: false,
          },
        ],
      };

      const ref = referenceOffer(model);
      expect(ref).toBeDefined();
      expect(ref?.channel).toBe('openrouter');
      expect(ref?.vendor).toBe('vendor2');
      expect(ref?.inputPerMTok).toBe(0.5);
    });

    it('falls back to cheapest direct offer if no non-free non-batch openrouter offer exists', () => {
      const model: ModelEntry = {
        id: 'test/model',
        name: 'Test Model',
        provider: 'test',
        providerName: 'Test Provider',
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
            channel: 'openrouter-free',
            vendor: 'openrouter',
            sourceId: 'test/model',
            inputPerMTok: 0,
            outputPerMTok: 0,
            isFree: true,
          },
          {
            channel: 'direct',
            vendor: 'direct2',
            sourceId: 'test/model',
            inputPerMTok: 2.0,
            outputPerMTok: 3.0,
            isFree: false,
          },
          {
            channel: 'direct',
            vendor: 'direct1',
            sourceId: 'test/model',
            inputPerMTok: 1.0,
            outputPerMTok: 1.5,
            isFree: false,
          },
        ],
      };

      const ref = referenceOffer(model);
      expect(ref).toBeDefined();
      expect(ref?.channel).toBe('direct');
      expect(ref?.vendor).toBe('direct1');
    });

    it('returns undefined if model is free-only or has no eligible offers', () => {
      const model: ModelEntry = {
        id: 'test/free-model',
        name: 'Free Model',
        provider: 'test',
        providerName: 'Test Provider',
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
            channel: 'openrouter-free',
            vendor: 'openrouter',
            sourceId: 'test/free-model',
            inputPerMTok: 0,
            outputPerMTok: 0,
            isFree: true,
          },
        ],
      };

      expect(referenceOffer(model)).toBeUndefined();
    });
  });

  describe('appendSnapshotToHistory', () => {
    const mockSnapshot: Snapshot = {
      schemaVersion: 1,
      generatedAt: '2026-05-10T10:00:00.000Z',
      sources: [],
      fx: { base: 'USD', date: '2026-05-10', rates: { USD: 1, PLN: 4, EUR: 0.9 } },
      diagnostics: { unmatched: [], warnings: [] },
      usageProfiles: [],
      channelFees: [],
      models: [
        {
          id: 'model-1',
          name: 'Model One',
          provider: 'prov',
          providerName: 'Prov',
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
              vendor: 'vendor1',
              sourceId: 'model-1',
              inputPerMTok: 2.0,
              outputPerMTok: 4.0,
              isFree: false,
            },
          ],
        },
        {
          id: 'free-model',
          name: 'Free Model',
          provider: 'prov',
          providerName: 'Prov',
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
              channel: 'openrouter-free',
              vendor: 'vendor1',
              sourceId: 'free-model',
              inputPerMTok: 0,
              outputPerMTok: 0,
              isFree: true,
            },
          ],
        },
      ],
      subscriptions: [
        {
          id: 'plan-1',
          provider: 'prov',
          providerName: 'Prov',
          name: 'Plan One',
          priceUsdMonthly: 20,
          url: 'https://example.com',
          lastVerified: '2026-05-10',
          confidence: 'official',
          primaryModelId: 'model-1',
          includedModelIds: ['model-1'],
          features: {
            codingAgents: [],
            imageGeneration: false,
            deepResearch: false,
            apiAccess: true,
          },
          limit: { kind: 'unknown' },
          unitLabel: { en: 'units', pl: 'jednostki' },
          referenceUnit: { inputTokens: 1000, outputTokens: 1000, cachedInputShare: 0 },
          notes: { en: 'note', pl: 'notatka' },
          sources: [{ label: 's', url: 'https://example.com' }],
        },
      ],
    };

    it('creates new history year file when history is undefined', () => {
      const history = appendSnapshotToHistory(undefined, mockSnapshot, '2026-05-10');
      expect(history.schemaVersion).toBe(1);
      expect(history.year).toBe(2026);
      expect(history.updatedAt).toBe(mockSnapshot.generatedAt);
      expect(history.models['model-1']).toEqual({
        firstSeen: '2026-05-10',
        points: [['2026-05-10', 2.0, 4.0]],
      });
      expect(history.models['free-model']).toBeUndefined();
      expect(history.subscriptions['plan-1']).toEqual({
        firstSeen: '2026-05-10',
        points: [['2026-05-10', 20]],
      });
    });

    it('is idempotent when run twice on the same date with unchanged prices', () => {
      const history1 = appendSnapshotToHistory(undefined, mockSnapshot, '2026-05-10');
      const history2 = appendSnapshotToHistory(history1, mockSnapshot, '2026-05-10');

      expect(history2.models['model-1']?.points).toHaveLength(1);
      expect(history2.models['model-1']?.points[0]).toEqual(['2026-05-10', 2.0, 4.0]);
      expect(history2.subscriptions['plan-1']?.points).toHaveLength(1);
      expect(history2.subscriptions['plan-1']?.points[0]).toEqual(['2026-05-10', 20]);
    });

    it('appends a new point when price changes on a later date', () => {
      const history1 = appendSnapshotToHistory(undefined, mockSnapshot, '2026-05-10');

      const updatedSnapshot: Snapshot = {
        ...mockSnapshot,
        generatedAt: '2026-06-01T10:00:00.000Z',
        models: [
          {
            ...mockSnapshot.models[0]!,
            offers: [
              {
                ...mockSnapshot.models[0]!.offers[0]!,
                inputPerMTok: 1.5,
                outputPerMTok: 3.0,
              },
            ],
          },
        ],
        subscriptions: [
          {
            ...mockSnapshot.subscriptions[0]!,
            priceUsdMonthly: 25,
          },
        ],
      };

      const history2 = appendSnapshotToHistory(history1, updatedSnapshot, '2026-06-01');

      expect(history2.models['model-1']?.firstSeen).toBe('2026-05-10');
      expect(history2.models['model-1']?.points).toEqual([
        ['2026-05-10', 2.0, 4.0],
        ['2026-06-01', 1.5, 3.0],
      ]);
      expect(history2.subscriptions['plan-1']?.firstSeen).toBe('2026-05-10');
      expect(history2.subscriptions['plan-1']?.points).toEqual([
        ['2026-05-10', 20],
        ['2026-06-01', 25],
      ]);
    });

    it('does not append a point if price difference is <= 1e-9', () => {
      const history1 = appendSnapshotToHistory(undefined, mockSnapshot, '2026-05-10');

      const tinyChangeSnapshot: Snapshot = {
        ...mockSnapshot,
        generatedAt: '2026-05-11T10:00:00.000Z',
        models: [
          {
            ...mockSnapshot.models[0]!,
            offers: [
              {
                ...mockSnapshot.models[0]!.offers[0]!,
                inputPerMTok: 2.0 + 1e-10,
                outputPerMTok: 4.0 - 1e-10,
              },
            ],
          },
        ],
      };

      const history2 = appendSnapshotToHistory(history1, tinyChangeSnapshot, '2026-05-11');
      expect(history2.models['model-1']?.points).toHaveLength(1);
    });

    it('seeds carryFrom last points on YYYY-01-01 when entering a new year', () => {
      const prevYearHistory: PriceHistory = {
        schemaVersion: 1,
        year: 2025,
        updatedAt: '2025-12-31T23:59:59.000Z',
        models: {
          'model-1': {
            firstSeen: '2025-03-15',
            points: [
              ['2025-03-15', 3.0, 6.0],
              ['2025-11-01', 2.5, 5.0],
            ],
          },
        },
        subscriptions: {
          'plan-1': {
            firstSeen: '2025-01-10',
            points: [['2025-01-10', 15]],
          },
        },
      };

      const history2026 = appendSnapshotToHistory(
        undefined,
        mockSnapshot,
        '2026-01-02',
        prevYearHistory,
      );

      expect(history2026.models['model-1']?.firstSeen).toBe('2025-03-15');
      expect(history2026.models['model-1']?.points).toEqual([
        ['2026-01-01', 2.5, 5.0],
        ['2026-01-02', 2.0, 4.0],
      ]);

      expect(history2026.subscriptions['plan-1']?.firstSeen).toBe('2025-01-10');
      expect(history2026.subscriptions['plan-1']?.points).toEqual([
        ['2026-01-01', 15],
        ['2026-01-02', 20],
      ]);
    });

    it('retains models/plans that disappeared from current snapshot', () => {
      const existingHistory: PriceHistory = {
        schemaVersion: 1,
        year: 2026,
        updatedAt: '2026-05-01T00:00:00.000Z',
        models: {
          'disappeared-model': {
            firstSeen: '2026-01-01',
            points: [['2026-01-01', 10.0, 20.0]],
          },
        },
        subscriptions: {},
      };

      const updated = appendSnapshotToHistory(existingHistory, mockSnapshot, '2026-05-10');
      expect(updated.models['disappeared-model']).toEqual({
        firstSeen: '2026-01-01',
        points: [['2026-01-01', 10.0, 20.0]],
      });
      expect(updated.models['model-1']).toBeDefined();
    });
  });

  describe('updateHistoryIndex', () => {
    it('creates or updates index with sorted years and updated timestamp', () => {
      const prevIndex: HistoryIndex = {
        schemaVersion: 1,
        years: [2024, 2025],
        updatedAt: '2025-12-31T00:00:00.000Z',
      };

      const updated = updateHistoryIndex(prevIndex, 2026, '2026-01-01T12:00:00.000Z');
      expect(updated).toEqual({
        schemaVersion: 1,
        years: [2024, 2025, 2026],
        updatedAt: '2026-01-01T12:00:00.000Z',
      });
    });
  });

  describe('priceAt', () => {
    it('returns the latest price point in effect on or before target date', () => {
      const points: [string, number, number][] = [
        ['2026-01-01', 1.0, 2.0],
        ['2026-03-01', 0.8, 1.6],
        ['2026-06-01', 0.5, 1.0],
      ];

      expect(priceAt(points, '2025-12-31')).toBeUndefined();
      expect(priceAt(points, '2026-01-01')).toEqual(['2026-01-01', 1.0, 2.0]);
      expect(priceAt(points, '2026-02-15')).toEqual(['2026-01-01', 1.0, 2.0]);
      expect(priceAt(points, '2026-03-01')).toEqual(['2026-03-01', 0.8, 1.6]);
      expect(priceAt(points, '2026-07-01')).toEqual(['2026-06-01', 0.5, 1.0]);
    });
  });
});
