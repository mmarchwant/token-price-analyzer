# Curated Datasets & Validator Guide

This repository maintains a set of hand-curated JSON files in `data/curated/`. These datasets power the subscription comparison, usage profile analysis, channel payment fee calculations, quality benchmark overrides, and model aliasing.

## Overview of Curated Datasets

All files in `data/curated/` are validated against Zod schemas defined in `src/domain/schemas.ts`.

### 1. Usage Profiles (`data/curated/usage-profiles.json`)

Defines standardized user workload profiles and task shapes:

- **`id`**: Unique kebab-case identifier (e.g., `coding-assistant`).
- **`name`**: Localized object `{ "en": "...", "pl": "..." }`.
- **`description`**: Localized text explaining what a "task" represents for this profile.
- **`inputTokensPerTask`**: Average input tokens per task.
- **`outputTokensPerTask`**: Average output tokens per task.
- **`cachedInputShare`**: Proportion of input tokens expected to hit prompt cache (0.0 to 1.0).
- **`tasksPerDay`**: Average number of tasks performed per active working day.
- **`workDaysPerMonth`**: Standard active working days per month (preset profiles use `22`).
- **`qualityDimension`**: Primary quality benchmark dimension (`intelligence`, `coding`, or `agentic`).
- **`allowBatch`**: Boolean indicating if batch processing API pricing applies.
- **`isPreset`**: `true` for standard system presets.

### 2. Subscription Plans (`data/curated/subscriptions.json`)

Defines consumer and developer AI subscription plans:

- **`id`**: Unique plan slug (e.g., `chatgpt-plus`).
- **`provider`**: Vendor ID slug (e.g., `openai`, `anthropic`).
- **`providerName`**: Display provider name (e.g., `OpenAI`).
- **`name`**: Plan display name (e.g., `ChatGPT Plus`).
- **`priceUsdMonthly`**: Monthly price in USD.
- **`annualPriceUsdMonthly`**: (Optional) Effective monthly price when billed annually.
- **`url`**: Official plan pricing page URL.
- **`lastVerified`**: Date string `YYYY-MM-DD` when pricing/limits were last verified.
- **`confidence`**: Verification confidence level:
  - `official`: Directly published on official pricing page or documentation.
  - `reported`: Based on official community reports, support documents, or empirical estimates.
  - `estimated`: Calculated or inferred from similar tiers.
- **`primaryModelId`**: Canonical OpenRouter-style model ID representing the main flagship model in the plan.
- **`includedModelIds`**: List of canonical OpenRouter-style model IDs available under the plan.
- **`features`**: Object containing feature flags:
  - `codingAgents`: Supported CLI/IDE coding agent platforms (e.g., `["codex"]`, `["claude-code"]`, `["copilot"]`).
  - `imageGeneration`: Boolean indicating native image generation support.
  - `deepResearch`: Boolean indicating web/deep research capability.
  - `apiAccess`: Boolean indicating if subscription credits include standard API access.
  - `longContextTokens`: Optional extended context window limit in tokens.
- **`limit`**: Plan usage quota structure (`window`, `monthly`, `usd-credit`, or `unknown`).
- **`unitLabel`**: Localized unit description `{ "en": "...", "pl": "..." }`.
- **`referenceUnit`**: Standard task token shape `{ "inputTokens": number, "outputTokens": number, "cachedInputShare": number }` used to normalize quota calculations.
- **`notes`**: Localized explanatory notes.
- **`sources`**: Array of source objects `[{ "label": "...", "url": "..." }]`.

### 3. Channel Fees (`data/curated/channel-fees.json`)

Defines purchase fees and minimum top-up requirements for API channels and direct vendors:

- **`vendor`**: Vendor ID slug (e.g., `openrouter`, `openai`, `anthropic`, `google`).
- **`purchaseFeePct`**: Percentage payment processing or platform fee added during credit top-up.
- **`minFeeUsd`**: Fixed minimum processing fee in USD.
- **`minTopUpUsd`**: Minimum required payment top-up amount in USD.
- **`notes`**: Localized notes on payment constraints.
- **`sourceUrl`**: Official billing documentation URL.
- **`lastVerified`**: Date string `YYYY-MM-DD`.

### 4. Quality Overrides (`data/curated/quality-overrides.json`)

Allows maintainers to override or supply quality scores for models when automated benchmark data is missing or wrong:

- **`modelId`**: Canonical OpenRouter model ID.
- **`tier`**: Optional tier (`S`, `A`, `B`, `C`, `D`).
- **`intelligence`**, **`coding`**, **`agentic`**: Optional numerical scores.
- **`force`**: Boolean (`true` to override automated benchmark, `false` to use as fallback).
- **`note`**: Localized reason for the override.

### 5. Model Aliases (`data/curated/model-aliases.json`)

Maps source-specific model names from external data feeds (LiteLLM, Artificial Analysis) to canonical OpenRouter model IDs:

- **`source`**: Vendor feed identifier (`litellm` or `artificial-analysis`).
- **`sourceId`**: Identifier used in the source data feed.
- **`modelId`**: Canonical target model ID.

---

## How to Add a New Subscription Plan: Worked Example

When adding a plan (e.g., "ExampleAI Pro"), follow these steps:

1. **Determine the `referenceUnit` and `unitLabel`**:
   Identify how the provider measures limits:
   - For general chat plans, use standard **CHAT** reference unit:
     ```json
     "unitLabel": { "en": "chat message", "pl": "wiadomość w czacie" },
     "referenceUnit": { "inputTokens": 3000, "outputTokens": 800, "cachedInputShare": 0.3 }
     ```
   - For heavy agent coding plans, use **CODEX** or **COPILOT** reference units.

2. **Define the limit structure**:
   Suppose ExampleAI Pro provides 50 messages per 5-hour rolling window:

   ```json
   "limit": {
     "kind": "window",
     "windowHours": 5,
     "unitsPerWindow": { "low": 50, "high": 50 }
   }
   ```

   If limits are variable or unpublished, specify a range (e.g., `{ "low": 40, "high": 100 }`) or use `{ "kind": "unknown" }`.

3. **Set verification date and sources**:
   Set `lastVerified` to today's date (`YYYY-MM-DD`) and include the official pricing page in `sources`.

---

## How to Add Quality Overrides or Model Aliases

- **Quality Override**:
  Add an entry to `overrides` in `data/curated/quality-overrides.json`:

  ```json
  {
    "overrides": [
      {
        "modelId": "provider/model-name",
        "tier": "A",
        "intelligence": 85.5,
        "force": true,
        "note": {
          "en": "Manual override due to missing benchmark entry.",
          "pl": "Ręczne nadpisanie z powodu braku wpisu w benchmarku."
        }
      }
    ]
  }
  ```

- **Model Alias**:
  Add an entry to `aliases` in `data/curated/model-aliases.json`:
  ```json
  {
    "aliases": [
      {
        "source": "litellm",
        "sourceId": "provider-model-v1",
        "modelId": "provider/model-v1"
      }
    ]
  }
  ```

---

## Maintenance Policy & Verification Schedule

- **30-Day Check Cycle**: All curated datasets should be reviewed approximately every 30 days.
- **45-Day Warning Trigger**: The validator (`npm run data:validate`) automatically raises a warning if any `lastVerified` date is older than 45 days.
- **Future Date Guard**: `lastVerified` dates in the future relative to execution time trigger a validation error.

---

## Submitting Changes via Pull Request

Before submitting changes to curated data:

1. Run `npm run data:validate` to ensure schemas pass and no duplicate IDs or invalid dates exist.
2. Run full quality checks:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
3. Update `lastVerified` to the date of your verification whenever you update plan details or channel fees.
