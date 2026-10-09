import { z } from 'zod';

export const CurrencySchema = z.enum(['USD', 'PLN', 'EUR']);

export const LocalizedTextSchema = z.object({
  en: z.string().min(1),
  pl: z.string().min(1),
});

export const RangeSchema = z
  .object({
    low: z.number().min(0),
    high: z.number().min(0),
  })
  .refine((val) => val.low <= val.high, {
    message: 'low must be <= high',
  });

export const TaskShapeSchema = z.object({
  inputTokens: z.number().min(0),
  outputTokens: z.number().min(0),
  cachedInputShare: z.number().min(0).max(1),
});

export const PriceOfferSchema = z.object({
  channel: z.enum(['openrouter', 'openrouter-free', 'openrouter-batch', 'direct']),
  vendor: z.string(),
  sourceId: z.string(),
  inputPerMTok: z.number().min(0),
  outputPerMTok: z.number().min(0),
  cacheReadPerMTok: z.number().min(0).optional(),
  cacheWritePerMTok: z.number().min(0).optional(),
  isFree: z.boolean(),
  longContext: z
    .object({
      thresholdTokens: z.number().int().gt(0),
      inputPerMTok: z.number(),
      outputPerMTok: z.number(),
      cacheReadPerMTok: z.number().optional(),
    })
    .optional(),
  url: z.string().url().optional(),
});

export const QualityTierSchema = z.enum(['S', 'A', 'B', 'C', 'D']);

export const QualityScoresSchema = z.object({
  intelligence: z.number().optional(),
  coding: z.number().optional(),
  agentic: z.number().optional(),
  source: z.enum(['artificial-analysis', 'openrouter-aa', 'manual', 'none']),
  tier: QualityTierSchema.optional(),
  note: LocalizedTextSchema.optional(),
});

export const SpeedSchema = z.object({
  outputTokensPerSecond: z.number().gt(0).optional(),
  timeToFirstTokenSeconds: z.number().min(0).optional(),
  source: z.string(),
});

export const ModelEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  providerName: z.string(),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  contextLength: z.number().int().gt(0).optional(),
  maxOutputTokens: z.number().int().gt(0).optional(),
  inputModalities: z.array(z.string()),
  outputModalities: z.array(z.string()),
  capabilities: z.object({
    tools: z.boolean(),
    reasoning: z.boolean(),
    structuredOutputs: z.boolean(),
    imageInput: z.boolean(),
  }),
  openWeights: z.boolean().nullable(),
  offers: z.array(PriceOfferSchema).min(1),
  quality: QualityScoresSchema,
  speed: SpeedSchema.optional(),
  deprecatedAt: z.string().optional(),
});

export const QualityDimensionSchema = z.enum(['intelligence', 'coding', 'agentic']);

// A user-facing scope for model discovery. It is deliberately independent from
// usage profiles: profiles describe demand, while this describes which models
// belong in the candidate set.
export const ModelIntentSchema = z.enum([
  'all',
  'text-reasoning',
  'coding',
  'agents',
  'image-generation',
  'video-generation',
]);

export const UsageProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
  inputTokensPerTask: z.number().int().gt(0),
  outputTokensPerTask: z.number().int().gt(0),
  cachedInputShare: z.number().min(0).max(1),
  tasksPerDay: z.number().gt(0),
  workDaysPerMonth: z.number().int().min(1).max(31),
  qualityDimension: QualityDimensionSchema,
  allowBatch: z.boolean(),
  isPreset: z.boolean(),
});

export const SubscriptionLimitSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('window'),
    windowHours: z.number().gt(0),
    unitsPerWindow: RangeSchema,
    weeklyUnitsCap: RangeSchema.optional(),
  }),
  z.object({
    kind: z.literal('monthly'),
    unitsPerMonth: RangeSchema,
  }),
  z.object({
    kind: z.literal('usd-credit'),
    usdPerMonth: z.number().gt(0),
  }),
  z.object({
    kind: z.literal('unknown'),
  }),
]);

export const SubscriptionPlanSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  provider: z.string(),
  providerName: z.string(),
  name: z.string(),
  priceUsdMonthly: z.number().min(0),
  annualPriceUsdMonthly: z.number().min(0).optional(),
  localPrices: z
    .object({
      PLN: z.number().optional(),
      EUR: z.number().optional(),
    })
    .optional(),
  url: z.string().url(),
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.enum(['official', 'reported', 'estimated']),
  primaryModelId: z.string(),
  includedModelIds: z.array(z.string()),
  features: z.object({
    codingAgents: z.array(z.string()),
    imageGeneration: z.boolean(),
    deepResearch: z.boolean(),
    apiAccess: z.boolean(),
    longContextTokens: z.number().int().gt(0).optional(),
  }),
  limit: SubscriptionLimitSchema,
  unitLabel: LocalizedTextSchema,
  referenceUnit: TaskShapeSchema,
  notes: LocalizedTextSchema,
  sources: z
    .array(
      z.object({
        label: z.string(),
        url: z.string().url(),
      }),
    )
    .min(1),
});

export const ChannelFeeSchema = z.object({
  vendor: z.string(),
  purchaseFeePct: z.number().min(0),
  minFeeUsd: z.number().min(0),
  minTopUpUsd: z.number().min(0),
  notes: LocalizedTextSchema,
  sourceUrl: z.string().url(),
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const QualityOverrideSchema = z.object({
  modelId: z.string(),
  tier: QualityTierSchema.optional(),
  intelligence: z.number().optional(),
  coding: z.number().optional(),
  agentic: z.number().optional(),
  force: z.boolean(),
  note: LocalizedTextSchema,
});

export const QualityOverridesFileSchema = z.object({
  overrides: z.array(QualityOverrideSchema),
});

export const ModelAliasSchema = z.object({
  source: z.enum(['litellm', 'artificial-analysis']),
  sourceId: z.string(),
  modelId: z.string(),
});

export const ModelAliasesFileSchema = z.object({
  aliases: z.array(ModelAliasSchema),
});

export const FxRatesSchema = z.object({
  base: z.literal('USD'),
  date: z.string(),
  rates: z.object({
    USD: z.literal(1),
    PLN: z.number().gt(0),
    EUR: z.number().gt(0),
  }),
});

export const SourceIdSchema = z.enum([
  'openrouter',
  'litellm',
  'artificial-analysis',
  'frankfurter',
  'curated',
]);

export const SourceStatusSchema = z.object({
  id: SourceIdSchema,
  ok: z.boolean(),
  skipped: z.boolean(),
  fetchedAt: z.string(),
  itemCount: z.number().int().min(0),
  error: z.string().optional(),
});

export const SnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  sources: z.array(SourceStatusSchema),
  fx: FxRatesSchema,
  models: z.array(ModelEntrySchema),
  subscriptions: z.array(SubscriptionPlanSchema),
  usageProfiles: z.array(UsageProfileSchema),
  channelFees: z.array(ChannelFeeSchema),
  diagnostics: z.object({
    unmatched: z.array(
      z.object({
        source: SourceIdSchema,
        ids: z.array(z.string()),
      }),
    ),
    warnings: z.array(z.string()),
  }),
});

export function parseSnapshot(json: unknown) {
  const result = SnapshotSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 5);
    const messages = issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    });
    throw new Error(`Invalid snapshot:\n${messages.join('\n')}`);
  }
  return result.data;
}

export const PricePointSchema = z.tuple([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.number(),
  z.number(),
]);

export const PlanPricePointSchema = z.tuple([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.number()]);

export const PriceHistorySchema = z.object({
  schemaVersion: z.literal(1),
  year: z.number().int(),
  updatedAt: z.string(),
  models: z.record(
    z.string(),
    z.object({
      firstSeen: z.string(),
      points: z.array(PricePointSchema),
    }),
  ),
  subscriptions: z.record(
    z.string(),
    z.object({
      firstSeen: z.string(),
      points: z.array(PlanPricePointSchema),
    }),
  ),
});

export const HistoryIndexSchema = z.object({
  schemaVersion: z.literal(1),
  years: z.array(z.number().int()),
  updatedAt: z.string(),
});

export function parsePriceHistory(json: unknown) {
  const result = PriceHistorySchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 5);
    const messages = issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    });
    throw new Error(`Invalid PriceHistory:\n${messages.join('\n')}`);
  }
  return result.data;
}

export function parseHistoryIndex(json: unknown) {
  const result = HistoryIndexSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 5);
    const messages = issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    });
    throw new Error(`Invalid HistoryIndex:\n${messages.join('\n')}`);
  }
  return result.data;
}
