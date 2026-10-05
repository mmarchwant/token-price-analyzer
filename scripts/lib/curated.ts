import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  ChannelFeeSchema,
  ModelAliasesFileSchema,
  QualityOverridesFileSchema,
  SubscriptionPlanSchema,
  UsageProfileSchema,
} from '../../src/domain/schemas';
import type {
  ChannelFee,
  ModelAlias,
  QualityOverride,
  SubscriptionPlan,
  UsageProfile,
} from '../../src/domain/types';

export interface CuratedData {
  profiles: UsageProfile[];
  plans: SubscriptionPlan[];
  fees: ChannelFee[];
  qualityOverrides: QualityOverride[];
  aliases: ModelAlias[];
}

const UsageProfilesFileSchema = z.object({
  profiles: z.array(UsageProfileSchema),
});

const SubscriptionPlansFileSchema = z.object({
  plans: z.array(SubscriptionPlanSchema),
});

const ChannelFeesFileSchema = z.object({
  fees: z.array(ChannelFeeSchema),
});

export function loadCurated(dir = 'data/curated'): CuratedData {
  const profilesPath = path.join(dir, 'usage-profiles.json');
  const plansPath = path.join(dir, 'subscriptions.json');
  const feesPath = path.join(dir, 'channel-fees.json');
  const overridesPath = path.join(dir, 'quality-overrides.json');
  const aliasesPath = path.join(dir, 'model-aliases.json');

  const profilesRaw = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
  const plansRaw = JSON.parse(fs.readFileSync(plansPath, 'utf-8'));
  const feesRaw = JSON.parse(fs.readFileSync(feesPath, 'utf-8'));
  const overridesRaw = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
  const aliasesRaw = JSON.parse(fs.readFileSync(aliasesPath, 'utf-8'));

  const profilesParsed = UsageProfilesFileSchema.parse(profilesRaw);
  const plansParsed = SubscriptionPlansFileSchema.parse(plansRaw);
  const feesParsed = ChannelFeesFileSchema.parse(feesRaw);
  const overridesParsed = QualityOverridesFileSchema.parse(overridesRaw);
  const aliasesParsed = ModelAliasesFileSchema.parse(aliasesRaw);

  return {
    profiles: profilesParsed.profiles,
    plans: plansParsed.plans,
    fees: feesParsed.fees,
    qualityOverrides: overridesParsed.overrides,
    aliases: aliasesParsed.aliases,
  };
}
