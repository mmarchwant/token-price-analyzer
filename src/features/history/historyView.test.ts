import { describe, expect, it } from 'vitest';
import { historyChartPoints, historyItems, percentChange } from './historyView';
import type { PriceHistory } from '../../domain/types';

const history: PriceHistory = {
  schemaVersion: 1,
  year: 2026,
  updatedAt: '2026-10-09T10:00:00.000Z',
  models: {
    'model/older': { firstSeen: '2026-01-01', points: [['2026-01-01', 1, 2]] },
    'model/newer': {
      firstSeen: '2026-02-01',
      points: [
        ['2026-02-01', 2, 4],
        ['2026-03-01', 1.5, 3],
      ],
    },
  },
  subscriptions: {
    pro: {
      firstSeen: '2026-01-01',
      points: [
        ['2026-01-01', 20],
        ['2026-04-01', 25],
      ],
    },
  },
};

describe('history view model', () => {
  it('sorts entries by their most recent price change', () => {
    expect(historyItems(history, 'models').map((item) => item.id)).toEqual([
      'model/newer',
      'model/older',
    ]);
    expect(historyItems(history, 'models')[0]).toMatchObject({
      firstSeen: '2026-02-01',
      lastChanged: '2026-03-01',
      pointCount: 2,
    });
  });

  it('maps model and subscription points to chart data', () => {
    expect(historyChartPoints(history, 'models', 'model/newer')).toEqual([
      { date: '2026-02-01', input: 2, output: 4 },
      { date: '2026-03-01', input: 1.5, output: 3 },
    ]);
    expect(historyChartPoints(history, 'subscriptions', 'pro')).toEqual([
      { date: '2026-01-01', price: 20 },
      { date: '2026-04-01', price: 25 },
    ]);
  });

  it('calculates changes and safely handles unavailable baselines', () => {
    expect(percentChange(2, 1.5)).toBe(-25);
    expect(percentChange(0, 1)).toBeUndefined();
    expect(percentChange(undefined, 1)).toBeUndefined();
  });
});
