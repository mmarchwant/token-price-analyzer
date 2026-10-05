# Data Pipeline

This document describes how `token-price-analyzer` fetches, normalizes, validates, and merges AI model data, pricing, foreign exchange rates, and curated metadata into a unified snapshot (`public/data/snapshot.json`).

## Architecture Overview

The data pipeline runs as an offline Node.js task (via `tsx`) executed daily by a GitHub Action or manually during development.

```
+--------------------+
|  OpenRouter API    | ---> Canonical model catalog & OpenRouter pricing
+--------------------+
|  LiteLLM Price DB  | ---> Direct provider API prices
+--------------------+
| ArtificialAnalysis | ---> Intelligence, coding & agentic benchmark scores, speed
+--------------------+
| Frankfurter (ECB)  | ---> Foreign exchange rates (USD base, PLN, EUR)
+--------------------+
| Curated JSON Datasets|---> Subscriptions, usage profiles, channel fees, quality overrides
+--------------------+
          |
          v
+--------------------+
|   buildSnapshot()  | ---> Validation & Merging
+--------------------+
          |
          v
+-----------------------------+
| public/data/snapshot.json   |
| public/data/meta.json       |
+-----------------------------+
```

---

## Data Sources & Contributions

1. **OpenRouter API** (`https://openrouter.ai/api/v1/models`):
   - **Contributes:** Base model catalog, model metadata (context length, capabilities, modalities, open weights), OpenRouter channel pricing (standard, free, batch variants), and default OpenRouter benchmark scores if present.
   - **Canonical ID standard:** OpenRouter base ID without variant suffixes (e.g., `anthropic/claude-3.5-sonnet`).

2. **LiteLLM Price List** (`https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`):
   - **Contributes:** Direct provider API prices (`channel: "direct"`), long-context tier pricing thresholds, cache read/creation costs.
   - **Matching:** Matched to canonical OpenRouter model IDs via exact ID matching, vendor rules, and `data/curated/model-aliases.json`.

3. **Artificial Analysis API** (`https://artificialanalysis.ai/api/v2/language/models/free`):
   - **Contributes:** Independent quality benchmarks (intelligence index, coding index, agentic index) and speed performance metrics (tokens per second, time to first token).
   - **Authentication:** Authenticated via `AA_API_KEY` header. Paginated up to 5 pages. If no API key is provided, source status is marked `skipped`.

4. **Frankfurter ECB FX API** (`https://api.frankfurter.dev/v1/latest?base=USD&symbols=PLN,EUR`):
   - **Contributes:** Daily reference exchange rates relative to USD for PLN and EUR.

5. **Curated Datasets** (`data/curated/`):
   - **Contributes:** Hand-maintained usage profiles, subscription plans, channel fee structures, model quality overrides, and model alias mappings.

---

## Model Matching & Aliases

Model entries across LiteLLM and Artificial Analysis are resolved to OpenRouter canonical model IDs:

- **Exact & Slug Matching:** Normalizers attempt to match source model slugs and provider hints against canonical IDs.
- **Model Aliases:** Explicit mappings defined in `data/curated/model-aliases.json`:
  ```json
  {
    "source": "litellm",
    "sourceId": "claude-3-5-sonnet-20241022",
    "modelId": "anthropic/claude-3.5-sonnet"
  }
  ```
  To map a new model from LiteLLM or Artificial Analysis, add a new alias entry in `data/curated/model-aliases.json`.

---

## Quality Precedence Rules

Each model's quality scores (`intelligence`, `coding`, `agentic`) and tier (`S`, `A`, `B`, `C`, `D`) are resolved using the following order of precedence:

1. **Forced Override (`force: true` in `quality-overrides.json`):** Scores specified in the override take precedence. Missing numeric fields are filled from AA direct or OpenRouter-AA.
2. **Artificial Analysis Direct API:** Direct benchmark evaluations fetched from the Artificial Analysis API (`source: "artificial-analysis"`).
3. **OpenRouter Benchmark Data:** Benchmarks provided alongside OpenRouter model responses (`source: "openrouter-aa"`).
4. **Non-forced Override (`force: false` in `quality-overrides.json`):** Used if no direct AA or OpenRouter benchmark data is available. Numeric fields fill gaps in missing metrics.
5. **None (`source: "none"`):** Unscored models.

_Note:_ An override's `tier` and human-readable `note` are always preserved whenever an override exists for a model. For models without an override tier, quality tiers are automatically computed using `assignTiers(models, 'intelligence')`. Speed metrics always originate from Artificial Analysis.

---

## Failure Behavior & Resiliency

- **OpenRouter Failure:** If OpenRouter API fails, `buildSnapshot` carries over model entries from the previous snapshot (`public/data/snapshot.json`) and emits a warning diagnostic. If no previous snapshot exists, the builder throws an error.
- **LiteLLM / Artificial Analysis / FX Failures:** If optional sources fail to fetch or parse, the snapshot build process continues with warnings recorded in `diagnostics.warnings`.
- **FX Fallback:** If FX rates cannot be fetched and no previous snapshot exists, fallback exchange rates (USD=1, PLN=4.0, EUR=0.9) are applied.

---

## Commands

- `npm run data:fetch`: Fetches live data from network endpoints, builds `public/data/snapshot.json` and `public/data/meta.json`.
- `npm run data:sample`: Builds offline snapshot and metadata from local fixtures (`scripts/__fixtures__/`) and writes to `public/data/` as well as `src/domain/__fixtures__/built-snapshot.json`.
- `npm run data:validate`: Validates curated dataset integrity and verifies `public/data/snapshot.json` against domain zod schemas.

---

## Attribution & Licensing Notes

- **Artificial Analysis:** Benchmark indices and speed metrics provided courtesy of [Artificial Analysis](https://artificialanalysis.ai). User interfaces displaying quality or speed metrics sourced from Artificial Analysis must include visible attribution with a direct link to https://artificialanalysis.ai.
- **LiteLLM Price List:** Distributed under the [MIT License](https://github.com/BerriAI/litellm/blob/main/LICENSE).
- **OpenRouter:** Model pricing and metadata retrieved from OpenRouter's public API.
