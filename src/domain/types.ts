import { z } from 'zod';
import {
  ChannelFeeSchema,
  CurrencySchema,
  FxRatesSchema,
  LocalizedTextSchema,
  ModelAliasSchema,
  ModelAliasesFileSchema,
  ModelEntrySchema,
  ModelIntentSchema,
  PriceOfferSchema,
  QualityDimensionSchema,
  QualityOverrideSchema,
  QualityOverridesFileSchema,
  QualityScoresSchema,
  QualityTierSchema,
  PricePointSchema,
  PlanPricePointSchema,
  PriceHistorySchema,
  HistoryIndexSchema,
  RangeSchema,
  SnapshotSchema,
  SourceIdSchema,
  SourceStatusSchema,
  SpeedSchema,
  SubscriptionLimitSchema,
  SubscriptionPlanSchema,
  TaskShapeSchema,
  UsageProfileSchema,
} from './schemas';

export type Currency = z.infer<typeof CurrencySchema>;
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
export type Range = z.infer<typeof RangeSchema>;
export type TaskShape = z.infer<typeof TaskShapeSchema>;
export type PriceOffer = z.infer<typeof PriceOfferSchema>;
export type QualityTier = z.infer<typeof QualityTierSchema>;
export type QualityScores = z.infer<typeof QualityScoresSchema>;
export type Speed = z.infer<typeof SpeedSchema>;
export type ModelEntry = z.infer<typeof ModelEntrySchema>;
export type ModelIntent = z.infer<typeof ModelIntentSchema>;
export type QualityDimension = z.infer<typeof QualityDimensionSchema>;
export type UsageProfile = z.infer<typeof UsageProfileSchema>;
export type SubscriptionLimit = z.infer<typeof SubscriptionLimitSchema>;
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
export type ChannelFee = z.infer<typeof ChannelFeeSchema>;
export type QualityOverride = z.infer<typeof QualityOverrideSchema>;
export type QualityOverridesFile = z.infer<typeof QualityOverridesFileSchema>;
export type ModelAlias = z.infer<typeof ModelAliasSchema>;
export type ModelAliasesFile = z.infer<typeof ModelAliasesFileSchema>;
export type FxRates = z.infer<typeof FxRatesSchema>;
export type SourceId = z.infer<typeof SourceIdSchema>;
export type SourceStatus = z.infer<typeof SourceStatusSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;

export type PricePoint = z.infer<typeof PricePointSchema>;
export type PlanPricePoint = z.infer<typeof PlanPricePointSchema>;
export type PriceHistory = z.infer<typeof PriceHistorySchema>;
export type HistoryIndex = z.infer<typeof HistoryIndexSchema>;

export interface CuratedData {
  profiles: UsageProfile[];
  plans: SubscriptionPlan[];
  fees: ChannelFee[];
  qualityOverrides: QualityOverride[];
  aliases: ModelAlias[];
}
