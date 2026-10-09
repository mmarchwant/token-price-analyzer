import type { ModelEntry, ModelIntent, SubscriptionPlan } from './types';

const hasModality = (modalities: string[], modality: string) =>
  modalities.some((value) => value.toLowerCase() === modality);

export function matchesModelIntent(model: ModelEntry, intent: ModelIntent): boolean {
  switch (intent) {
    case 'all':
      return true;
    case 'text-reasoning':
      return hasModality(model.outputModalities, 'text') && model.capabilities.reasoning;
    case 'coding':
      return model.quality.coding !== undefined;
    case 'agents':
      return model.capabilities.tools && model.quality.agentic !== undefined;
    case 'image-generation':
      return hasModality(model.outputModalities, 'image');
    case 'video-generation':
      return hasModality(model.outputModalities, 'video');
  }
}

export function filterModelsByIntent(models: ModelEntry[], intent: ModelIntent): ModelEntry[] {
  return intent === 'all' ? models : models.filter((model) => matchesModelIntent(model, intent));
}

export function matchesPlanIntent(
  plan: SubscriptionPlan,
  models: ModelEntry[],
  intent: ModelIntent,
): boolean {
  if (intent === 'all') return true;
  if ((intent === 'coding' || intent === 'agents') && plan.features.codingAgents.length > 0) {
    return true;
  }
  if (intent === 'image-generation' && plan.features.imageGeneration) return true;
  const includedIds = new Set([plan.primaryModelId, ...plan.includedModelIds]);
  return models.some((model) => includedIds.has(model.id) && matchesModelIntent(model, intent));
}
