# Data Sources & Methodology

This document details the data pipeline, calculation formulas, quality metrics, and subscription estimation logic used by **Token Price Analyzer**.

---

## 1. Cost Per Task Formula

Every AI task consists of uncached input tokens, cached input tokens (cache reads), cache write operations, and output tokens. The effective total cost per task is calculated using vendor unit prices per 1,000,000 tokens:

$$\text{Task Cost} = (\text{Uncached Inputs} \times \text{Input Rate}) + (\text{Cached Inputs} \times \text{Cache Read Rate}) + (\text{Cache Writes} \times \text{Cache Write Rate}) + (\text{Output Tokens} \times \text{Output Rate})$$

Key rules:

- **Long-context Pricing**: When prompt token volume exceeds a model's long-context threshold (e.g. 128k tokens), long-context rate tiers automatically apply.
- **Effective $/1M Tokens**: Combines the profile's weighted input and output token ratios into a single normalized cost per 1M tokens.

---

## 2. Usage Profiles

A **Usage Profile** defines the workload parameters:

- **Task Shape**: `inputTokensPerTask`, `outputTokensPerTask`, and `cachedInputShare` (0.0 to 1.0).
- **Workload Volume**: `tasksPerDay` and `workDaysPerMonth` (typically 20–22 days).
- **Execution Rules**: Preferred quality dimension and whether batch processing (`allowBatch`) is permitted.

Presets reflect common developer workflows (Chat, Coding Agent, Deep Research, Batch). Users can customize all parameters.

---

## 3. Quality Metrics & Pareto Frontiers

Quality benchmark scores (0–100) across **Intelligence**, **Coding**, and **Agentic** capabilities are sourced from [Artificial Analysis](https://artificialanalysis.ai).

### Percentile Quality Tiers

Models are grouped into quality tiers based on benchmark distribution percentiles:

- **S Tier**: Top 5% of benchmark scores.
- **A Tier**: Next 15%.
- **B Tier**: Next 30%.
- **C Tier**: Next 30%.
- **D Tier**: Remaining models.

### Pareto Frontier

The **Pareto Frontier** identifies models that offer non-dominated combinations of cost and quality (i.e. no other model offers higher quality at the same or lower cost).

---

## 4. Budget Reach & Top-up Fees

When evaluating API budget capacity:

1. **Purchase Fees**: Top-up fees (percentage fee + minimum fee) are deducted first to determine net usable API credit:
   $$\text{Usable Credit} = \max(0, \text{Gross Budget} \times (1 - \text{Fee \%}) - \text{Min Fee})$$
2. **Task Capacity**: $\text{Total Tasks} = \lfloor \frac{\text{Usable Credit}}{\text{Task Cost}} \rfloor$
3. **Workdays Covered**: $\text{Days} = \frac{\text{Total Tasks}}{\text{Tasks Per Day}}$

---

## 5. Subscriptions vs. API Value

Subscription plans (e.g. ChatGPT Plus, Claude Pro) enforce usage limits via rolling windows (e.g. 5-hour rolling windows), monthly message quotas, or USD credit allowances.

### API-Equivalent Value

API-Equivalent Value measures what the plan's reference monthly capacity would cost if purchased directly via primary model API endpoints:
$$\text{API-Equivalent Value} = \text{Monthly Reference Capacity} \times \text{Primary Model API Rate}$$

### Leverage & Coverage

- **Leverage Ratio**: $\frac{\text{API-Equivalent Value}}{\text{Monthly Subscription Price}}$
- **Confidence Badges**:
  - `official`: Published by provider documentation.
  - `reported`: Verified by community testing and user reports.
  - `estimated`: Calculated using benchmark assumptions.

---

## 6. Advisor Scoring Logic

The Advisor ranks combinations of subscriptions and API endpoints using a weighted utility function:

1. **Quality Tier Weight**: Prioritizes higher quality tiers matching the chosen usage profile dimension.
2. **Workday Coverage**: Scores the degree to which monthly demand (e.g., 20 workdays) is satisfied.
3. **Cost Efficiency**: Evaluates cost per completed workday.
4. **Diversity Rules**: Filters out redundant model endpoints across channels to provide diverse, actionable recommendations.

---

## 7. Currency & VAT Conversions

- Internal pricing engine operates in **USD per 1M tokens**.
- **FX Rates**: Daily reference exchange rates from the European Central Bank via [Frankfurter](https://www.frankfurter.app).
- **Local List Prices**: Where providers publish explicit local currency pricing (e.g. PLN/EUR subscription fees), published local prices take precedence over FX conversions.
- **VAT Adjustments**: Applied dynamically at display time based on selected tax settings (e.g. 23% PL VAT).

---

## 8. Limitations & Financial Disclaimer

- All figures, capacity ranges, and scores are estimates for comparative evaluation.
- AI provider pricing, rate limits, and subscription terms change frequently without advance notice.
- This application does not provide financial or legal advice. Free API tiers may be subject to rate limits and response delays.
