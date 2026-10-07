import type { ModelEntry } from '../../domain/types';

export function parseExplorerSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get('search')?.trim() ?? '';
}

export function filterExplorerModels(models: ModelEntry[], search: string): ModelEntry[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (!normalizedSearch) return models;

  return models.filter((model) =>
    [model.name, model.providerName, model.provider, model.id].some((value) =>
      value.toLocaleLowerCase().includes(normalizedSearch),
    ),
  );
}
