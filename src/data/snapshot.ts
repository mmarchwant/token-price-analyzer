import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { parseSnapshot } from '../domain/schemas';
import type { Snapshot } from '../domain/types';

export async function fetchSnapshot(): Promise<Snapshot> {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const url = (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + 'data/snapshot.json';

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load snapshot from ${url}: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return parseSnapshot(json);
}

export function useSnapshotQuery(): UseQueryResult<Snapshot, Error> {
  return useQuery<Snapshot, Error>({
    queryKey: ['snapshot'],
    queryFn: fetchSnapshot,
    staleTime: Infinity,
  });
}
