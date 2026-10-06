# token-price-analyzer [![Refresh Data](https://github.com/<owner>/token-price-analyzer/actions/workflows/refresh-data.yml/badge.svg)](https://github.com/<owner>/token-price-analyzer/actions/workflows/refresh-data.yml)

A static web application (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality.

It answers questions like: _"I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?"_

## Tech Stack

- **Framework & UI:** Vite, React, TypeScript (`strict`), Tailwind CSS v4
- **Testing:** Vitest, `@testing-library/react`, Playwright (E2E)
- **Linting & Formatting:** ESLint (flat config), Prettier
- **Pipeline & Hosting:** Node 22 (`tsx`), GitHub Actions, GitHub Pages

## Development Scripts

- `npm run dev`: Starts the Vite development server
- `npm run build`: Builds the production bundle (`dist/`)
- `npm run preview`: Previews the production build locally
- `npm run typecheck`: Type-checks all TypeScript files (app, scripts, tests, configs)
- `npm run lint`: Checks linting with ESLint and code style with Prettier
- `npm run format`: Formats code with Prettier
- `npm run test`: Runs unit and component tests with Vitest
- `npm run test:watch`: Runs Vitest in watch mode
- `npm run test:coverage`: Runs Vitest code coverage report
- `npm run e2e`: Runs Playwright end-to-end tests
- `npm run data:fetch`: Fetches live source data and generates `public/data/snapshot.json`
- `npm run data:history`: Updates `public/data/history/index.json` and annual price history files
- `npm run data:sample`: Generates an offline snapshot from fixture datasets
- `npm run data:validate`: Validates curated datasets and snapshot JSON against domain schemas

## Local Development

1. Ensure Node.js `>=22` is installed (or use `.nvmrc` via `nvm use`).
2. Install dependencies: `npm ci`
3. Start dev server: `npm run dev`

## Data Pipeline & Methodology

For full details on data sources, precedence rules, model matching, calculation formulas, and failure behavior, see [Data Pipeline Documentation](docs/data-pipeline.md) and [Methodology Documentation](docs/methodology.md).

## Data Refresh

The application automatically refreshes pricing, FX rates, and model benchmarks every day at 04:23 UTC via the `refresh-data.yml` GitHub Action workflow. Updated snapshot data and change-only price history points are validated, committed to the repository, and deployed to GitHub Pages automatically.

## Deployment & GitHub Settings

The application is automatically built and deployed to GitHub Pages on pushes to `main`.

- **Settings → Pages → Source:** GitHub Actions
- **Settings → Actions → Workflow permissions:** Read and write permissions (required for automated data refresh)
- **Optional Secret:** `AA_API_KEY` (for Artificial Analysis API integration)

## Data Sources

- **OpenRouter:** Live and daily API pricing and model benchmarks.
- **LiteLLM Price List:** Direct API prices across providers.
- **Artificial Analysis:** Quality indices and speed benchmarks ([Artificial Analysis](https://artificialanalysis.ai)).
- **Frankfurter (ECB):** Reference foreign exchange rates.
- **Curated Data:** Hand-maintained subscription plan limits, usage profiles, and channel fees.

## Attribution

- **Artificial Analysis**: Benchmark quality scores and inference speed data ([artificialanalysis.ai](https://artificialanalysis.ai)).
- **OpenRouter**: API model prices and endpoint metadata ([openrouter.ai](https://openrouter.ai)).
- **LiteLLM**: Direct provider API pricing specifications ([github.com/BerriAI/litellm](https://github.com/BerriAI/litellm)).
- **Frankfurter**: Foreign exchange reference rates from the European Central Bank ([frankfurter.app](https://www.frankfurter.app)).
