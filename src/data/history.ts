import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { parseHistoryIndex, parsePriceHistory } from '../domain/schemas';
import type { HistoryIndex, PriceHistory } from '../domain/types';

function dataUrl(path: string): string {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}data/history/${path}`;
}

async function fetchHistoryFile<T>(path: string, parse: (json: unknown) => T): Promise<T> {
  const url = dataUrl(path);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to load price history from ${url}: ${response.status} ${response.statusText}`,
    );
  }

  return parse(await response.json());
}

export function fetchHistoryIndex(): Promise<HistoryIndex> {
  return fetchHistoryFile('index.json', parseHistoryIndex);
}

export function fetchPriceHistory(year: number): Promise<PriceHistory> {
  return fetchHistoryFile(`${year}.json`, parsePriceHistory);
}

export function useHistoryIndexQuery(): UseQueryResult<HistoryIndex, Error> {
  return useQuery({
    queryKey: ['history', 'index'],
    queryFn: fetchHistoryIndex,
    staleTime: Infinity,
  });
}

export function usePriceHistoryQuery(
  year: number | undefined,
): UseQueryResult<PriceHistory, Error> {
  return useQuery({
    queryKey: ['history', year],
    queryFn: () => fetchPriceHistory(year!),
    enabled: year !== undefined,
    staleTime: Infinity,
  });
}
