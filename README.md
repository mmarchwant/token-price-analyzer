# token-price-analyzer

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

## Local Development

1. Ensure Node.js `>=22` is installed (or use `.nvmrc` via `nvm use`).
2. Install dependencies: `npm ci`
3. Start dev server: `npm run dev`

## Deployment & GitHub Settings

The application is automatically built and deployed to GitHub Pages on pushes to `main`.

- **Settings → Pages → Source:** GitHub Actions
- **Settings → Actions → Workflow permissions:** Read and write permissions (required for automated data refresh)
- **Optional Secret:** `AA_API_KEY` (for Artificial Analysis API integration)

## Planned Data Sources

- **OpenRouter:** Live and daily API pricing and model benchmarks.
- **LiteLLM Price List:** Direct API prices across providers.
- **Artificial Analysis:** Quality indices and speed benchmarks.
- **Frankfurter (ECB):** Reference foreign exchange rates.
- **Curated Data:** Hand-maintained subscription plan limits, usage profiles, and channel fees.
