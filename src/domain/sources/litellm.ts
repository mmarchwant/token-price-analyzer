import type { ModelAlias, ModelEntry, PriceOffer } from '../types.js';
import { createModelMatcher, PROVIDER_SLUG_BY_SOURCE_PROVIDER } from './match.js';

function toMTok(val: number): number {
  return Math.round(val * 1e6 * 1e6) / 1e6;
}

export function normalizeLiteLlm(
  raw: unknown,
  models: ModelEntry[],
  aliases: ModelAlias[],
): { offersByModelId: Map<string, PriceOffer[]>; unmatched: string[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid LiteLLM payload: expected record object');
  }

  const matcher = createModelMatcher(models, aliases, 'litellm');
  const offersByModelIdAndVendor = new Map<string, Map<string, PriceOffer>>();
  const unmatchedSet = new Set<string>();

  const entries = Object.entries(raw as Record<string, Record<string, unknown>>);

  for (const [key, entry] of entries) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }

    const mode = entry.mode;
    const provider =
      typeof entry.litellm_provider === 'string' ? entry.litellm_provider : undefined;
    const inputCost = entry.input_cost_per_token;
    const outputCost = entry.output_cost_per_token;

    // Filter: mode === 'chat', provider in PROVIDER_SLUG_BY_SOURCE_PROVIDER, input & output cost present
    if (mode !== 'chat') {
      continue;
    }

    if (!provider || !(provider in PROVIDER_SLUG_BY_SOURCE_PROVIDER)) {
      continue;
    }

    if (
      typeof inputCost !== 'number' ||
      inputCost < 0 ||
      typeof outputCost !== 'number' ||
      outputCost < 0
    ) {
      continue;
    }

    const vendorSlug = PROVIDER_SLUG_BY_SOURCE_PROVIDER[provider] ?? provider;
    const modelId = matcher(key, provider);

    if (!modelId) {
      unmatchedSet.add(key);
      continue;
    }

    const inputPerMTok = toMTok(inputCost);
    const outputPerMTok = toMTok(outputCost);
    const isFree = inputPerMTok === 0 && outputPerMTok === 0;

    const cacheReadPerMTok =
      typeof entry.cache_read_input_token_cost === 'number'
        ? toMTok(entry.cache_read_input_token_cost)
        : undefined;

    const cacheWritePerMTok =
      typeof entry.cache_creation_input_token_cost === 'number'
        ? toMTok(entry.cache_creation_input_token_cost)
        : undefined;

    // Check for long-context keys like *_above_<N>k_tokens
    let longContext: PriceOffer['longContext'] = undefined;

    for (const propKey of Object.keys(entry)) {
      const match = propKey.match(/_above_(\d+)k_tokens$/);
      if (match && match[1]) {
        const thresholdK = parseInt(match[1], 10);
        if (!isNaN(thresholdK) && thresholdK > 0) {
          const thresholdTokens = thresholdK * 1000;
          const lcInputKey = `input_cost_per_token_above_${thresholdK}k_tokens`;
          const lcOutputKey = `output_cost_per_token_above_${thresholdK}k_tokens`;
          const lcCacheReadKey = `cache_read_input_token_cost_above_${thresholdK}k_tokens`;

          const lcInputVal = entry[lcInputKey];
          const lcOutputVal = entry[lcOutputKey];
          const lcCacheReadVal = entry[lcCacheReadKey];

          if (typeof lcInputVal === 'number' && typeof lcOutputVal === 'number') {
            longContext = {
              thresholdTokens,
              inputPerMTok: toMTok(lcInputVal),
              outputPerMTok: toMTok(lcOutputVal),
              cacheReadPerMTok:
                typeof lcCacheReadVal === 'number' ? toMTok(lcCacheReadVal) : undefined,
            };
            break;
          }
        }
      }
    }

    const offer: PriceOffer = {
      channel: 'direct',
      vendor: vendorSlug,
      sourceId: key,
      inputPerMTok,
      outputPerMTok,
      cacheReadPerMTok,
      cacheWritePerMTok,
      isFree,
      longContext,
    };

    if (!offersByModelIdAndVendor.has(modelId)) {
      offersByModelIdAndVendor.set(modelId, new Map<string, PriceOffer>());
    }
    const vendorMap = offersByModelIdAndVendor.get(modelId);
    if (!vendorMap) continue;

    // Deduplicate: keep cheapest per vendor
    const existingOffer = vendorMap.get(vendorSlug);
    if (!existingOffer) {
      vendorMap.set(vendorSlug, offer);
    } else {
      const existingSum = existingOffer.inputPerMTok + existingOffer.outputPerMTok;
      const newSum = offer.inputPerMTok + offer.outputPerMTok;
      if (newSum < existingSum) {
        vendorMap.set(vendorSlug, offer);
      }
    }
  }

  const offersByModelId = new Map<string, PriceOffer[]>();
  for (const [modelId, vendorMap] of offersByModelIdAndVendor.entries()) {
    offersByModelId.set(modelId, Array.from(vendorMap.values()));
  }

  const unmatched = Array.from(unmatchedSet).sort();

  return { offersByModelId, unmatched };
}
