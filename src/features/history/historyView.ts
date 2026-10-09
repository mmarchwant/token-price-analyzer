import type { PriceHistory } from '../../domain/types';

export type HistoryKind = 'models' | 'subscriptions';

export interface HistoryItem {
  id: string;
  firstSeen: string;
  lastChanged: string;
  pointCount: number;
}

export interface HistoryChartPoint {
  date: string;
  input?: number;
  output?: number;
  price?: number;
}

export function historyItems(history: PriceHistory, kind: HistoryKind): HistoryItem[] {
  const entries = kind === 'models' ? history.models : history.subscriptions;

  return Object.entries(entries)
    .map(([id, entry]) => ({
      id,
      firstSeen: entry.firstSeen,
      lastChanged: entry.points.at(-1)?.[0] ?? entry.firstSeen,
      pointCount: entry.points.length,
    }))
    .sort((a, b) => b.lastChanged.localeCompare(a.lastChanged) || a.id.localeCompare(b.id));
}

export function historyChartPoints(
  history: PriceHistory,
  kind: HistoryKind,
  id: string | undefined,
): HistoryChartPoint[] {
  if (!id) return [];

  if (kind === 'models') {
    return (history.models[id]?.points ?? []).map(([date, input, output]) => ({
      date,
      input,
      output,
    }));
  }

  return (history.subscriptions[id]?.points ?? []).map(([date, price]) => ({ date, price }));
}

export function percentChange(
  first: number | undefined,
  last: number | undefined,
): number | undefined {
  if (first === undefined || last === undefined || first === 0) return undefined;
  return ((last - first) / first) * 100;
}
