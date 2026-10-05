import { assignTiers } from '../quality.js';
import { parseSnapshot } from '../schemas.js';
import type {
  CuratedData,
  FxRates,
  ModelEntry,
  PriceOffer,
  QualityScores,
  Snapshot,
  SourceStatus,
  Speed,
} from '../types.js';
import { validateCurated } from '../validate-curated.js';

export interface BuildSnapshotInput {
  now: Date;
  openrouter: { models: ModelEntry[]; warnings: string[] } | { error: string };
  litellm?: { offersByModelId: Map<string, PriceOffer[]>; unmatched: string[] } | { error: string };
  aa?:
    | { byModelId: Map<string, { quality: QualityScores; speed?: Speed }>; unmatched: string[] }
    | { error: string }
    | 'skipped';
  fx?: FxRates | { error: string };
  previous?: Snapshot;
  curated: CuratedData;
}

export function buildSnapshot(input: BuildSnapshotInput): Snapshot {
  const warnings: string[] = [];
  let models: ModelEntry[];

  // 1. OpenRouter & carry-over logic
  if ('error' in input.openrouter) {
    if (input.previous) {
      models = structuredClone(input.previous.models);
      warnings.push('OpenRouter failed; models carried over from previous snapshot');
    } else {
      throw new Error(
        `OpenRouter failed and no previous snapshot available: ${input.openrouter.error}`,
      );
    }
  } else {
    models = structuredClone(input.openrouter.models);
    warnings.push(...input.openrouter.warnings);
  }

  // 2. LiteLLM Direct Offers
  let litellmUnmatched: string[] = [];
  if (input.litellm) {
    if ('error' in input.litellm) {
      warnings.push(`LiteLLM fetch failed: ${input.litellm.error}`);
    } else {
      litellmUnmatched = input.litellm.unmatched;
      const offersMap = input.litellm.offersByModelId;
      for (const model of models) {
        const directOffers = offersMap.get(model.id);
        if (directOffers && directOffers.length > 0) {
          model.offers = model.offers.filter((o) => o.channel !== 'direct');
          model.offers.push(...directOffers);
        }
      }
    }
  }

  // 3. Artificial Analysis Quality & Speed
  let aaData: { byModelId: Map<string, { quality: QualityScores; speed?: Speed }> } | undefined =
    undefined;
  let aaUnmatched: string[] = [];

  if (input.aa) {
    if (typeof input.aa === 'object') {
      if ('error' in input.aa) {
        warnings.push(`Artificial Analysis fetch failed: ${input.aa.error}`);
      } else {
        aaData = input.aa;
        aaUnmatched = input.aa.unmatched;
      }
    }
  }

  // 4. Quality Precedence, Overrides & Speed
  for (const model of models) {
    const override = input.curated.qualityOverrides.find((o) => o.modelId === model.id);
    const aaModel = aaData?.byModelId.get(model.id);

    if (aaModel?.speed) {
      model.speed = aaModel.speed;
    }

    const orQuality = model.quality.source === 'openrouter-aa' ? model.quality : undefined;

    let intelligence: number | undefined;
    let coding: number | undefined;
    let agentic: number | undefined;
    let source: QualityScores['source'];

    if (override?.force === true) {
      intelligence =
        override.intelligence ?? aaModel?.quality.intelligence ?? orQuality?.intelligence;
      coding = override.coding ?? aaModel?.quality.coding ?? orQuality?.coding;
      agentic = override.agentic ?? aaModel?.quality.agentic ?? orQuality?.agentic;
      if (
        override.intelligence !== undefined ||
        override.coding !== undefined ||
        override.agentic !== undefined
      ) {
        source = 'manual';
      } else if (aaModel?.quality) {
        source = 'artificial-analysis';
      } else if (orQuality) {
        source = 'openrouter-aa';
      } else {
        source = 'manual';
      }
    } else {
      const aaHasScores =
        aaModel?.quality &&
        (aaModel.quality.intelligence !== undefined ||
          aaModel.quality.coding !== undefined ||
          aaModel.quality.agentic !== undefined);

      const orHasScores =
        orQuality &&
        (orQuality.intelligence !== undefined ||
          orQuality.coding !== undefined ||
          orQuality.agentic !== undefined);

      const overrideHasScores =
        override &&
        (override.intelligence !== undefined ||
          override.coding !== undefined ||
          override.agentic !== undefined);

      if (aaHasScores) {
        intelligence =
          aaModel.quality.intelligence ?? override?.intelligence ?? orQuality?.intelligence;
        coding = aaModel.quality.coding ?? override?.coding ?? orQuality?.coding;
        agentic = aaModel.quality.agentic ?? override?.agentic ?? orQuality?.agentic;
        source = 'artificial-analysis';
      } else if (orHasScores) {
        intelligence = orQuality.intelligence ?? override?.intelligence;
        coding = orQuality.coding ?? override?.coding;
        agentic = orQuality.agentic ?? override?.agentic;
        source = 'openrouter-aa';
      } else if (overrideHasScores) {
        intelligence = override.intelligence;
        coding = override.coding;
        agentic = override.agentic;
        source = 'manual';
      } else {
        source = override ? 'manual' : 'none';
      }
    }

    model.quality = {
      intelligence,
      coding,
      agentic,
      source,
      tier: override?.tier,
      note: override?.note,
    };
  }

  // Compute quality tiers for models without an override tier
  const computedTiers = assignTiers(models, 'intelligence');
  for (const model of models) {
    if (!model.quality.tier) {
      const tier = computedTiers.get(model.id);
      if (tier) {
        model.quality.tier = tier;
      }
    }
  }

  // 5. FX Rates
  let fx: FxRates;
  if (input.fx && !('error' in input.fx)) {
    fx = input.fx;
  } else if (input.previous?.fx) {
    fx = input.previous.fx;
    warnings.push('FX fetch failed; using previous rates');
  } else {
    fx = { base: 'USD', date: 'fallback', rates: { USD: 1, PLN: 4.0, EUR: 0.9 } };
    warnings.push('FX fetch failed and no previous snapshot; using fallback rates');
  }

  // Filter out models with zero offers
  models = models.filter((m) => m.offers.length > 0);

  // Sort by provider, then name
  models.sort((a, b) => {
    const provCmp = a.provider.localeCompare(b.provider);
    if (provCmp !== 0) return provCmp;
    return a.name.localeCompare(b.name);
  });

  // 6. Source Statuses
  const sources: SourceStatus[] = [
    {
      id: 'openrouter',
      ok: !('error' in input.openrouter),
      skipped: false,
      fetchedAt: input.now.toISOString(),
      itemCount: 'models' in input.openrouter ? input.openrouter.models.length : 0,
      error: 'error' in input.openrouter ? input.openrouter.error : undefined,
    },
    {
      id: 'litellm',
      ok: !!(input.litellm && !('error' in input.litellm)),
      skipped: !input.litellm,
      fetchedAt: input.now.toISOString(),
      itemCount:
        input.litellm && 'offersByModelId' in input.litellm
          ? input.litellm.offersByModelId.size
          : 0,
      error: input.litellm && 'error' in input.litellm ? input.litellm.error : undefined,
    },
    {
      id: 'artificial-analysis',
      ok: !!(input.aa && input.aa !== 'skipped' && !('error' in input.aa)),
      skipped: input.aa === 'skipped' || !input.aa,
      fetchedAt: input.now.toISOString(),
      itemCount:
        input.aa && typeof input.aa === 'object' && 'byModelId' in input.aa
          ? input.aa.byModelId.size
          : 0,
      error:
        input.aa && typeof input.aa === 'object' && 'error' in input.aa
          ? input.aa.error
          : undefined,
    },
    {
      id: 'frankfurter',
      ok: !!(input.fx && !('error' in input.fx)),
      skipped: !input.fx,
      fetchedAt: input.now.toISOString(),
      itemCount: input.fx && !('error' in input.fx) ? Object.keys(input.fx.rates).length : 0,
      error: input.fx && 'error' in input.fx ? input.fx.error : undefined,
    },
    {
      id: 'curated',
      ok: true,
      skipped: false,
      fetchedAt: input.now.toISOString(),
      itemCount:
        input.curated.profiles.length +
        input.curated.plans.length +
        input.curated.fees.length +
        input.curated.qualityOverrides.length +
        input.curated.aliases.length,
    },
  ];

  const draftSnapshot: Snapshot = {
    schemaVersion: 1,
    generatedAt: input.now.toISOString(),
    sources,
    fx,
    models,
    subscriptions: input.curated.plans,
    usageProfiles: input.curated.profiles,
    channelFees: input.curated.fees,
    diagnostics: {
      unmatched: [
        { source: 'litellm', ids: litellmUnmatched },
        { source: 'artificial-analysis', ids: aaUnmatched },
      ],
      warnings: [],
    },
  };

  const curatedValidation = validateCurated(input.curated, draftSnapshot, input.now);
  if (curatedValidation.errors.length > 0) {
    throw new Error(`Curated data validation failed:\n${curatedValidation.errors.join('\n')}`);
  }

  draftSnapshot.diagnostics.warnings = [...warnings, ...curatedValidation.warnings];

  return parseSnapshot(draftSnapshot);
}
