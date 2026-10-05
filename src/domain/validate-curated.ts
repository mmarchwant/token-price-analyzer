import type { CuratedData, Snapshot } from './types';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateCurated(
  curated: CuratedData,
  snapshot?: Snapshot,
  now: Date = new Date(),
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nowIsoDate = now.toISOString().slice(0, 10);
  const nowTimestamp = now.getTime();

  // 1. Duplicate IDs
  const seenProfileIds = new Set<string>();
  for (const profile of curated.profiles) {
    if (seenProfileIds.has(profile.id)) {
      errors.push(`Duplicate profile id: '${profile.id}'`);
    } else {
      seenProfileIds.add(profile.id);
    }
  }

  const seenPlanIds = new Set<string>();
  for (const plan of curated.plans) {
    if (seenPlanIds.has(plan.id)) {
      errors.push(`Duplicate plan id: '${plan.id}'`);
    } else {
      seenPlanIds.add(plan.id);
    }
  }

  const seenFeeVendors = new Set<string>();
  for (const fee of curated.fees) {
    if (seenFeeVendors.has(fee.vendor)) {
      errors.push(`Duplicate fee vendor: '${fee.vendor}'`);
    } else {
      seenFeeVendors.add(fee.vendor);
    }
  }

  const seenOverrideModelIds = new Set<string>();
  for (const override of curated.qualityOverrides) {
    if (seenOverrideModelIds.has(override.modelId)) {
      errors.push(`Duplicate quality override modelId: '${override.modelId}'`);
    } else {
      seenOverrideModelIds.add(override.modelId);
    }
  }

  const seenAliasKeys = new Set<string>();
  for (const alias of curated.aliases) {
    const key = `${alias.source}:${alias.sourceId}`;
    if (seenAliasKeys.has(key)) {
      errors.push(`Duplicate alias for source '${alias.source}' and sourceId '${alias.sourceId}'`);
    } else {
      seenAliasKeys.add(key);
    }
  }

  // 2. lastVerified in the future or older than 45 days
  for (const plan of curated.plans) {
    if (plan.lastVerified > nowIsoDate) {
      errors.push(`Plan '${plan.id}' lastVerified date (${plan.lastVerified}) is in the future`);
    } else {
      const verifiedTimestamp = new Date(`${plan.lastVerified}T00:00:00Z`).getTime();
      const ageDays = (nowTimestamp - verifiedTimestamp) / (1000 * 60 * 60 * 24);
      if (ageDays > 45) {
        warnings.push(
          `Plan '${plan.id}' lastVerified date (${plan.lastVerified}) is older than 45 days`,
        );
      }
    }
  }

  for (const fee of curated.fees) {
    if (fee.lastVerified > nowIsoDate) {
      errors.push(
        `Fee vendor '${fee.vendor}' lastVerified date (${fee.lastVerified}) is in the future`,
      );
    } else {
      const verifiedTimestamp = new Date(`${fee.lastVerified}T00:00:00Z`).getTime();
      const ageDays = (nowTimestamp - verifiedTimestamp) / (1000 * 60 * 60 * 24);
      if (ageDays > 45) {
        warnings.push(
          `Fee vendor '${fee.vendor}' lastVerified date (${fee.lastVerified}) is older than 45 days`,
        );
      }
    }
  }

  // 3. Snapshot warnings
  if (snapshot) {
    const snapshotModelIds = new Set(snapshot.models.map((m) => m.id));

    for (const plan of curated.plans) {
      if (!snapshotModelIds.has(plan.primaryModelId)) {
        warnings.push(
          `Plan '${plan.id}' primaryModelId '${plan.primaryModelId}' not found in snapshot models`,
        );
      }
      for (const incId of plan.includedModelIds) {
        if (!snapshotModelIds.has(incId)) {
          warnings.push(
            `Plan '${plan.id}' includedModelId '${incId}' not found in snapshot models`,
          );
        }
      }
    }

    for (const override of curated.qualityOverrides) {
      if (!snapshotModelIds.has(override.modelId)) {
        warnings.push(
          `Quality override modelId '${override.modelId}' not found in snapshot models`,
        );
      }
    }

    for (const alias of curated.aliases) {
      if (!snapshotModelIds.has(alias.modelId)) {
        warnings.push(`Alias target modelId '${alias.modelId}' not found in snapshot models`);
      }
    }
  }

  return { errors, warnings };
}
