import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { normalizeOpenRouter } from '../domain/sources/openrouter';
import type { ModelEntry } from '../domain/types';

export interface LiveOpenRouterResult {
  models: ModelEntry[];
  warnings: string[];
}

export async function fetchLiveOpenRouter(): Promise<LiveOpenRouterResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return normalizeOpenRouter(json);
  } finally {
    clearTimeout(timer);
  }
}

export function useLiveOpenRouterQuery(
  enabled: boolean,
): UseQueryResult<LiveOpenRouterResult, Error> {
  return useQuery<LiveOpenRouterResult, Error>({
    queryKey: ['liveOpenRouter'],
    queryFn: fetchLiveOpenRouter,
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
