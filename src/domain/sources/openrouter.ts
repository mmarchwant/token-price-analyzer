import { z } from 'zod';
import type { ModelEntry, PriceOffer, QualityScores } from '../types.js';

const OpenRouterOverrideSchema = z
  .object({
    min_prompt_tokens: z.number().optional(),
    utc_start: z.union([z.string(), z.number()]).optional(),
    utc_end: z.union([z.string(), z.number()]).optional(),
    prompt: z.string(),
    completion: z.string(),
    input_cache_read: z.string().optional(),
    input_cache_write: z.string().optional(),
  })
  .passthrough();

const OpenRouterPricingSchema = z
  .object({
    prompt: z.string(),
    completion: z.string(),
    input_cache_read: z.string().nullable().optional(),
    input_cache_write: z.string().nullable().optional(),
    overrides: z.array(OpenRouterOverrideSchema).nullable().optional(),
  })
  .passthrough();

const OpenRouterModelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    created: z.number().optional(),
    description: z.string().optional(),
    context_length: z.number().optional(),
    hugging_face_id: z.string().nullable().optional(),
    expiration_date: z.string().nullable().optional(),
    architecture: z
      .object({
        input_modalities: z.array(z.string()).optional(),
        output_modalities: z.array(z.string()).optional(),
      })
      .optional(),
    pricing: OpenRouterPricingSchema,
    top_provider: z
      .object({
        max_completion_tokens: z.number().nullable().optional(),
      })
      .optional(),
    supported_parameters: z.array(z.string()).optional(),
    benchmarks: z
      .object({
        artificial_analysis: z
          .object({
            intelligence_index: z.number().nullable().optional(),
            coding_index: z.number().nullable().optional(),
            agentic_index: z.number().nullable().optional(),
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const OpenRouterResponseSchema = z
  .object({
    data: z.array(OpenRouterModelSchema),
  })
  .passthrough();

function toMTok(valStr: string): number {
  const val = Number(valStr);
  if (Number.isNaN(val)) return 0;
  return Math.round(val * 1e6 * 1e6) / 1e6;
}

export function normalizeOpenRouter(raw: unknown): {
  models: ModelEntry[];
  warnings: string[];
} {
  const parseResult = OpenRouterResponseSchema.safeParse(raw);
  if (!parseResult.success) {
    throw new Error(
      `Invalid OpenRouter payload: expected top-level object with 'data' array. Details: ${parseResult.error.message}`,
    );
  }

  const warnings: string[] = [];
  let timeWindowOverridesCount = 0;

  // Group entries by base ID
  interface GroupedModel {
    baseId: string;
    baseRawEntry?: z.infer<typeof OpenRouterModelSchema>;
    variantEntries: z.infer<typeof OpenRouterModelSchema>[];
  }

  const grouped = new Map<string, GroupedModel>();

  for (const item of parseResult.data.data) {
    // Skip ids starting with ~
    if (item.id.startsWith('~')) {
      continue;
    }

    // Skip entries with negative prices
    const promptPrice = Number(item.pricing.prompt);
    const completionPrice = Number(item.pricing.completion);
    if (
      Number.isNaN(promptPrice) ||
      Number.isNaN(completionPrice) ||
      promptPrice < 0 ||
      completionPrice < 0
    ) {
      continue;
    }

    // Determine base id & variant suffix
    let baseId = item.id;
    if (item.id.endsWith(':free') || item.id.endsWith(':batch')) {
      baseId = item.id.slice(0, item.id.lastIndexOf(':'));
    }

    if (!grouped.has(baseId)) {
      grouped.set(baseId, { baseId, variantEntries: [] });
    }
    const grp = grouped.get(baseId);
    if (!grp) continue;

    if (item.id === baseId) {
      grp.baseRawEntry = item;
    } else {
      grp.variantEntries.push(item);
    }
  }

  const models: ModelEntry[] = [];

  for (const [baseId, grp] of grouped.entries()) {
    // Primary item for metadata is the base raw entry if present, else first variant entry
    const primary = grp.baseRawEntry ?? grp.variantEntries[0];
    if (!primary) continue;

    // Collect all entries for offer generation (base entry if exists, plus variants)
    const allEntries: z.infer<typeof OpenRouterModelSchema>[] = [];
    if (grp.baseRawEntry) {
      allEntries.push(grp.baseRawEntry);
    }
    allEntries.push(...grp.variantEntries);

    const offers: PriceOffer[] = [];

    for (const entry of allEntries) {
      const isFreeVariant = entry.id.endsWith(':free');
      const isBatchVariant = entry.id.endsWith(':batch');

      let channel: PriceOffer['channel'] = 'openrouter';
      if (isFreeVariant) {
        channel = 'openrouter-free';
      } else if (isBatchVariant) {
        channel = 'openrouter-batch';
      }

      const inputPerMTok = toMTok(entry.pricing.prompt);
      const outputPerMTok = toMTok(entry.pricing.completion);
      const isFree = isFreeVariant || (inputPerMTok === 0 && outputPerMTok === 0);

      const cacheReadPerMTok =
        typeof entry.pricing.input_cache_read === 'string'
          ? toMTok(entry.pricing.input_cache_read)
          : undefined;
      const cacheWritePerMTok =
        typeof entry.pricing.input_cache_write === 'string'
          ? toMTok(entry.pricing.input_cache_write)
          : undefined;

      // Overrides handling
      let longContext: PriceOffer['longContext'] = undefined;

      if (entry.pricing.overrides && Array.isArray(entry.pricing.overrides)) {
        for (const ov of entry.pricing.overrides) {
          if (ov.utc_start !== undefined || ov.utc_end !== undefined) {
            timeWindowOverridesCount++;
            continue;
          }
          if (ov.min_prompt_tokens !== undefined && !longContext) {
            longContext = {
              thresholdTokens: ov.min_prompt_tokens,
              inputPerMTok: toMTok(ov.prompt),
              outputPerMTok: toMTok(ov.completion),
              cacheReadPerMTok: ov.input_cache_read ? toMTok(ov.input_cache_read) : undefined,
            };
          }
        }
      }

      offers.push({
        channel,
        vendor: 'openrouter',
        sourceId: entry.id,
        inputPerMTok,
        outputPerMTok,
        cacheReadPerMTok,
        cacheWritePerMTok,
        isFree,
        longContext,
        url: `https://openrouter.ai/${baseId}`,
      });
    }

    // Provider & Name parsing
    const slashIdx = baseId.indexOf('/');
    const providerSlug = slashIdx !== -1 ? baseId.slice(0, slashIdx) : baseId;

    let providerName = providerSlug;
    let name = primary.name;
    if (primary.name.includes(': ')) {
      const parts = primary.name.split(': ');
      providerName = parts[0] ?? providerSlug;
      name = parts.slice(1).join(': ');
    }

    // Modalties & Capabilities
    const inputModalities = primary.architecture?.input_modalities ?? [];
    const outputModalities = primary.architecture?.output_modalities ?? [];
    const supportedParams = primary.supported_parameters ?? [];

    const capabilities = {
      tools: supportedParams.includes('tools'),
      reasoning: supportedParams.includes('reasoning'),
      structuredOutputs:
        supportedParams.includes('structured_outputs') ||
        supportedParams.includes('response_format'),
      imageInput: inputModalities.includes('image'),
    };

    const openWeights =
      typeof primary.hugging_face_id === 'string' && primary.hugging_face_id.trim().length > 0
        ? true
        : null;

    // Quality benchmark
    const aaBench =
      grp.baseRawEntry?.benchmarks?.artificial_analysis ?? primary.benchmarks?.artificial_analysis;
    let quality: QualityScores = { source: 'none' };

    if (
      aaBench &&
      (typeof aaBench.intelligence_index === 'number' ||
        typeof aaBench.coding_index === 'number' ||
        typeof aaBench.agentic_index === 'number')
    ) {
      quality = {
        intelligence: aaBench.intelligence_index ?? undefined,
        coding: aaBench.coding_index ?? undefined,
        agentic: aaBench.agentic_index ?? undefined,
        source: 'openrouter-aa',
      };
    }

    const maxOutput = primary.top_provider?.max_completion_tokens;

    models.push({
      id: baseId,
      name,
      provider: providerSlug,
      providerName,
      description: primary.description,
      createdAt:
        typeof primary.created === 'number'
          ? new Date(primary.created * 1000).toISOString()
          : undefined,
      contextLength: primary.context_length,
      maxOutputTokens: typeof maxOutput === 'number' && maxOutput > 0 ? maxOutput : undefined,
      inputModalities,
      outputModalities,
      capabilities,
      openWeights,
      offers,
      quality,
      deprecatedAt: primary.expiration_date ?? undefined,
    });
  }

  if (timeWindowOverridesCount > 0) {
    warnings.push(`Ignored ${timeWindowOverridesCount} time-window override(s)`);
  }

  // Sort by provider, then name
  models.sort((a, b) => {
    const provCmp = a.provider.localeCompare(b.provider);
    if (provCmp !== 0) return provCmp;
    return a.name.localeCompare(b.name);
  });

  return { models, warnings };
}
