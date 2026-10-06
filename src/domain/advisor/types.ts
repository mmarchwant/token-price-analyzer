import type { QualityTier, Range, UsageProfile } from '../types';

export interface Needs {
  codingAgent: boolean;
  imageGeneration: boolean;
  deepResearch: boolean;
  longContext: boolean;
  openWeights: boolean;
  toolCalling: boolean;
}

export interface AdvisorInput {
  budgetUsd: number; // net list-price budget in USD
  profile: UsageProfile;
  intensity: number; // multiplier on tasksPerDay, 0.25–4
  activeHoursPerDay: number;
  needs: Needs;
  minTier: QualityTier | 'any';
  includeFree: boolean;
  preferFlexibility: boolean; // small bonus for pay-as-you-go
}

export type Strategy = 'api' | 'subscription' | 'subscription+api' | 'two-subscriptions';

export interface Reason {
  code: string;
  params?: Record<string, string | number>;
}

export interface Recommendation {
  id: string;
  strategy: Strategy;
  planIds: string[];
  modelIds: string[];
  monthlyCostUsd: number;
  coverage: Range | null;
  quality: number | undefined;
  tier: QualityTier | undefined;
  score: number; // 0–100
  reasons: Reason[];
  warnings: Reason[];
}
