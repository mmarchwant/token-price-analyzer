# token-price-analyzer — prompty dla Google Jules

> Wygenerowano: 2026-10-05. Ten plik to cały plan implementacji od A do Z.
> Każdy prompt to **jedna sesja Jules = jeden PR**. Kopiujesz cały blok (od `# Task` do `PR title`) i wklejasz do Julesa.
> Prompty są samowystarczalne i celowo powtarzają te same zasady.

---

## 1. Co budujemy

Statyczna aplikacja web, która odpowiada na pytanie: **„Mam X zł/$ w tym miesiącu. Lepiej wziąć API czy subskrypcję, u którego providera i z jakim modelem, żeby realnie dostać dobrą jakość za dobrą cenę?”**

Główne widoki:

| Widok | Co daje |
|---|---|
| **Advisor** (strona główna) | Kreator: budżet + sposób użycia + potrzeby → ranking strategii (subskrypcja / API / sub + doładowanie API / dwie suby) z uzasadnieniem |
| **Explorer** | Tabela + mapa „koszt vs jakość” ~450 modeli: $/MTok in/out/cache, koszt zadania dla Twojego profilu, indeks jakości, front Pareto |
| **Budget** | „Za ile dany model może pracować”: ile zadań/dni pracy kupi budżet, logarytmiczna skala porównawcza |
| **Subscriptions vs API** | Szacowana pojemność planów w Twoich zadaniach, wartość w przeliczeniu na API (×dźwignia), wykres break-even |
| **Compare** | 2–4 modele/plany obok siebie, link do udostępnienia |
| **History** | Codzienne snapshoty cen: co staniało/zdrożało, nowe modele, wykresy |
| **Profiles** | Profile użycia (np. „tura agenta CLI” = 80k in / 2.5k out / 90% cache) i kalkulator zadań |
| **Sources** | Źródła, świeżość danych, metodologia, atrybucja |

### Architektura (decyzje podjęte w rozmowie)

```
GitHub Actions (cron codziennie)                    Przeglądarka (GitHub Pages)
┌──────────────────────────────────────┐           ┌──────────────────────────────────┐
│ scripts/fetch-data.ts                │           │ Vite + React SPA (HashRouter)     │
│  ├─ OpenRouter /api/v1/models  (ceny, │  commit   │  ├─ public/data/snapshot.json     │
│  │   + indeksy AA, bez klucza)       │ ───────▶  │  ├─ live: OpenRouter (CORS OK)    │
│  ├─ LiteLLM price JSON (ceny direct) │ snapshot  │  ├─ i18n EN/PL, USD/PLN/EUR, VAT  │
│  ├─ Artificial Analysis (opcj. klucz)│ + history │  └─ cała logika w src/domain      │
│  ├─ Frankfurter/EBC (kursy walut)    │           │     (czyste funkcje + testy)      │
│  └─ data/curated/*.json (suby, ...)  │           └──────────────────────────────────┘
└──────────────────────────────────────┘
```

Sprawdzone 2026-10-05:
- OpenRouter `GET https://openrouter.ai/api/v1/models` działa bez klucza i ma `Access-Control-Allow-Origin: *`. Zwraca ~466 modeli z cenami per token, w tym wariantami `:free` i `:batch`, cenami cache i progami long-context. Dla ~147 modeli zwraca też `benchmarks.artificial_analysis.{intelligence_index,coding_index,agentic_index}`. Dzięki temu jakość działa nawet bez klucza AA.
- Artificial Analysis free API (`/api/v2/language/models/free`, nagłówek `x-api-key`) ma limit 100 zapytań dziennie i **wymaga atrybucji**. Daje dodatkowe indeksy i prędkość (tok/s).
- Frankfurter (`api.frankfurter.dev`) nie wysyła nagłówków CORS, więc kursy walut pobiera cron, nie przeglądarka.
- Limity subskrypcji są publikowane mgliście i zmieniają się co kilka tygodni. Dlatego są w ręcznie kurowanym `data/curated/subscriptions.json` z polami `confidence`, `lastVerified` i `sources`. Do ich odświeżania służy prompt M1.

---

## 2. Krok 0: setup ręczny (robisz Ty, bez Julesa)

1. **Repo na GitHubie**: utwórz **publiczne** repo `token-price-analyzer`. GitHub Pages z prywatnego repo wymaga płatnego planu. Wypchnij lokalny `main`:
   ```bash
   git remote add origin https://github.com/<twoj-login>/token-price-analyzer.git
   ```
   ```bash
   git push -u origin main
   ```
   Warto zacommitować ten plik (`JULES_PROMPTS.md`) do repo. Każdy prompt mówi Julesowi, żeby realizował tylko swoje zadanie.
2. **Pages**: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. **Uprawnienia Actions**: Settings → Actions → General → Workflow permissions → **Read and write permissions**. Bez tego cron nie zacommituje snapshotu.
4. **(Opcjonalnie, zalecane) klucz Artificial Analysis**: załóż konto na https://artificialanalysis.ai i wygeneruj klucz API. Potem Settings → Secrets and variables → Actions → New repository secret → nazwa `AA_API_KEY`. Bez klucza aplikacja działa na indeksach z OpenRoutera.
5. **Branch protection**: jeśli włączysz ochronę `main`, dopuść `github-actions[bot]` do pushowania albo nie włączaj ochrony. Inaczej codzienny refresh danych się wywali.
6. **Jules**: https://jules.google → połącz GitHub → wybierz repo. W konfiguracji repo w Julesie (Environment / setup script) wklej:
   ```bash
   if [ -f package.json ]; then npm ci && (npx playwright install --with-deps chromium || npx playwright install chromium || true); fi
   ```
   Przed Task 01 nie ma `package.json`, więc skrypt nic nie robi. Od Task 02 instaluje zależności i przeglądarkę do testów e2e.

---

## 3. Jak pracować z Julesem (zasady, które oszczędzą sesje)

- **Jedno zadanie = nowa sesja = jeden PR.** Nie kontynuuj następnego taska w tej samej sesji. Jules nie robi `git pull` i pracowałby na nieaktualnym kodzie.
- **Przed kolejnym taskiem zmerguj poprzedni PR** (chyba że tabela niżej mówi, że taski mogą iść równolegle).
- **Czytaj plan** przed zatwierdzeniem. Jeśli Jules planuje coś spoza zakresu (np. „przy okazji zrefaktoryzuję…”), odpisz w sesji: *"Stay strictly within the task scope; drop step N."*
- **CI musi być zielone** przed merge (od Task 01 działa `ci.yml`).
- **Jeśli PR jest zły**: drobne poprawki zgłaszaj w tej samej sesji (*"Fix: …, keep changes valid"*). Jeśli jest fundamentalnie zepsuty, zamknij PR i odpal ten sam prompt w nowej sesji z dopiskiem na końcu: *"Note: a previous attempt failed because …; avoid that."*
- **Konflikty przy równoległych taskach**: rozwiązuj w webowym edytorze GitHuba (zwykle to `package-lock.json` lub pliki tłumaczeń) albo po prostu odpal task ponownie po merge'u poprzedniego.
- **Zamiast klikać w UI możesz używać CLI** `tools/jules/jules.mjs` (opis w sekcji 3a).
- Limit free: **15 zadań dziennie, 3 równolegle.** Plan ma 17 tasków plus zapas na poprawki, czyli realnie 5–8 dni spokojnej pracy.

### 3a. CLI do Jules API (opcjonalnie)

`tools/jules/jules.mjs` wyciąga prompt z tego pliku, tworzy sesję przez Jules API (z automatycznym PR i wymaganym zatwierdzeniem planu), pokazuje plan i postęp, i pilnuje kolejności z tabeli zależności. Działa na Node 22+, bez zależności. Klucz bierze wyłącznie ze zmiennej środowiskowej `JULES_API_KEY`.

```powershell
$env:JULES_API_KEY = "<twój klucz z jules.google → Settings>"
```

Typowy cykl jednego taska:

```bash
node tools/jules/jules.mjs next
```
```bash
node tools/jules/jules.mjs start 01
```
```bash
node tools/jules/jules.mjs watch 01
```
```bash
node tools/jules/jules.mjs approve 01
```
```bash
node tools/jules/jules.mjs watch 01
```

Po zmergowaniu PR uruchom `next` i bierz kolejny task. Status merge'a skrypt sprawdza przez `gh`; jeśli nie masz GitHub CLI, użyj `mark-merged 01`. Pozostałe komendy: `tasks`, `status`, `plan`, `message <id> "..."`, `activities`, `prompt <id>`, `forget`. Pełna lista: `--help`. Dla M2/M3 zrób `prompt M3 > m3.md`, uzupełnij `<...>` i odpal `start M3 --prompt-file m3.md`. Przy ponownej próbie dodaj `--force --note "poprzednio: …"`.

### Kolejność i zależności

| # | Task | Zależy od | Może iść równolegle z | Rozmiar |
|---|---|---|---|---|
| 01 | Scaffold, tooling, CI, deploy Pages, AGENTS.md | — | — | M |
| 02 | Domena: schematy zod, matematyka cen/jakości/walut | 01 | — | M |
| 03 | Dane kurowane: subskrypcje, profile, opłaty + walidator | 02 | **04** | M |
| 04 | Normalizatory źródeł + dopasowanie modeli + fixtures | 02 | **03** | M/L |
| 05 | Budowanie snapshotu + skrypty fetch + pierwszy snapshot | 03, 04 | — | M |
| 06 | Codzienny cron + historia cen | 05 | — | M |
| 07 | App shell: routing, i18n EN/PL, ustawienia, UI primitives | 01 (merge po 06) | — | L |
| 08 | Warstwa danych: snapshot, live OpenRouter, URL state | 07 | — | M |
| 09 | Explorer (tabela + mapa koszt/jakość) | 08 | **10, 11** | L |
| 10 | Profile użycia + kalkulator zadań | 08 | **09, 11** | M |
| 11 | Budżet: „za ile model może pracować” | 08 | **09, 10** | M |
| 12 | Subskrypcje vs API + break-even | 09–11 | — | L |
| 13 | Advisor: silnik rekomendacji + kreator | 12 | **15, 16** | L |
| 14 | Compare 1:1 + linki do udostępnienia | 13 | — | M |
| 15 | Historia i trendy (UI) | 08 (merge po 12) | **13, 16** | M |
| 16 | Źródła, metodologia, atrybucja, szablony issues | 08 (merge po 12) | **13, 15** | S/M |
| 17 | QA: e2e, a11y, wydajność, README | wszystko | — | M |
| M1–M3 | Utrzymanie (odświeżanie subskrypcji, nowy plan, bugfix) | po 17 | — | S |

**Proponowany rozkład dni:**
- Dzień 1: 01 → 02
- Dzień 2: 03 + 04 (równolegle) → 05 → 06
- Dzień 3: 07 → 08
- Dzień 4: 09 + 10 + 11 (równolegle, merge po kolei)
- Dzień 5: 12 → 13 + 15 + 16 (równolegle)
- Dzień 6: 14 → 17

Po Task 05 strona jest już na Pages, choć jeszcze z placeholderami. Po Task 06 dane odświeżają się same codziennie.

---

## 4. Prompty

### Task 01 — Scaffold, tooling, CI, Pages deploy

````text
# Task 01 — Project scaffold, tooling, CI and GitHub Pages deploy

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
The repository contains only an initial commit (possibly a README and JULES_PROMPTS.md). There is no application code and no package.json yet.

## Goal
Create a clean, production-ready skeleton that every later task builds on: Vite + React + TypeScript app in the repository root, Tailwind CSS v4, Vitest + Testing Library, Playwright, ESLint + Prettier, GitHub Actions CI and a GitHub Pages deploy workflow, plus AGENTS.md and README.md.

## Allowed packages (use current stable versions)
Runtime: `react`, `react-dom`.
Dev: `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `prettier`, `eslint-config-prettier`, `@playwright/test`, `tsx`, `@types/node`, `@types/react`, `@types/react-dom`.

## Requirements
1. Scaffold in the repo root (not in a subfolder). package.json: `"name": "token-price-analyzer"`, `"private": true`, `"type": "module"`, `"engines": { "node": ">=22" }`. Add `.nvmrc` containing `22`. Use npm and commit `package-lock.json`.
2. `vite.config.ts`: React plugin, Tailwind v4 via `@tailwindcss/vite`, `base: './'` (relative asset URLs so the app works under `https://<user>.github.io/token-price-analyzer/` and locally), and path alias `@/` → `src/`.
3. TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `resolveJsonModule: true`. Use separate tsconfig projects for the app (`src/`) and for Node code (vite config, playwright config, `scripts/`, `e2e/`). Configure the `@/` alias for TypeScript too.
4. Vitest: default environment `node`. Component tests (`src/**/*.test.tsx`) run in `jsdom`. Use whichever mechanism the installed Vitest version supports cleanly (for example `projects`, or a `// @vitest-environment jsdom` docblock in each .tsx test) and document the choice in AGENTS.md. Add a setup file that registers `@testing-library/jest-dom` matchers. Include `src/**/*.test.{ts,tsx}` and `scripts/**/*.test.ts`. Exclude `e2e/**`.
5. Create this folder skeleton (use `.gitkeep` where a folder is empty): `src/app`, `src/components/ui`, `src/components/layout`, `src/domain`, `src/data`, `src/state`, `src/i18n`, `src/features`, `scripts`, `scripts/__fixtures__`, `data/curated`, `public/data`, `docs`, `e2e`.
6. Minimal app: `src/main.tsx` mounts `<App />` from `src/app/App.tsx` inside `React.StrictMode`. `App` renders an `<h1>` "Token Price Analyzer" and a short paragraph "Work in progress", styled with a few Tailwind classes (to prove Tailwind works). `src/index.css` contains `@import "tailwindcss";`. `index.html` has `<html lang="en">`, a sensible `<title>` and a meta description.
7. package.json scripts, exactly these names:
   - `dev`: `vite`
   - `build`: `vite build`
   - `preview`: `vite preview`
   - `typecheck`: type-checks ALL TypeScript (app, node configs, scripts, tests, e2e) without emitting files
   - `lint`: `eslint . && prettier --check .`
   - `format`: `prettier --write .`
   - `test`: `vitest run`
   - `test:watch`: `vitest`
   - `test:coverage`: `vitest run --coverage`
   - `e2e`: `playwright test`
8. ESLint flat config (`eslint.config.js`): `@eslint/js` recommended, `typescript-eslint` recommended, `react-hooks` recommended, `react-refresh/only-export-components` as a warning, `eslint-config-prettier` last. Set the rule `@typescript-eslint/no-explicit-any` to `error`. Ignore: `dist`, `coverage`, `playwright-report`, `test-results`, `public/data`, `tools`. Prettier config: `singleQuote: true`, `semi: true`, `printWidth: 100`, `trailingComma: "all"`. `.prettierignore`: `dist`, `coverage`, `playwright-report`, `test-results`, `public/data`, `tools`, `package-lock.json`, `JULES_PROMPTS.md`. The `tools/` folder already exists (maintainer tooling, plain `.mjs`, not part of the app). Do not modify it, and exclude it from ESLint, Prettier, TypeScript and Vitest.
9. Tests: `src/app/App.test.tsx` renders `App` and asserts the heading. `playwright.config.ts`: chromium only; `webServer` runs `npm run build && npm run preview -- --port 4173 --strictPort`; `baseURL` is `http://localhost:4173`; reporter `list` locally and `html` on CI. Add one smoke test `e2e/smoke.spec.ts` that checks the heading. `npm run e2e` is not part of the rule-5 checks, but it must pass when browsers are installed.
10. `.github/workflows/ci.yml`: runs on `pull_request` and on `push` to `main`. Job `checks`: checkout, `actions/setup-node` with `node-version-file: .nvmrc` and npm cache, `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Job `e2e` (needs `checks`): `npm ci`, `npx playwright install --with-deps chromium`, `npm run e2e`, and upload `playwright-report` as an artifact when it fails. Use current major versions of the official actions.
11. `.github/workflows/deploy.yml`:
    - Triggers: `push` to `main`, `workflow_dispatch`, and `workflow_call`. The `workflow_call` trigger takes an optional string input `ref` (default `''`), so the future data-refresh workflow can deploy the commit it just created.
    - Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group `pages`, `cancel-in-progress: false`.
    - Job `build`: checkout with `ref: ${{ inputs.ref || github.sha }}`, setup-node from `.nvmrc`, `npm ci`, then `npm run build` with env `VITE_REPO_URL: ${{ github.server_url }}/${{ github.repository }}`. Then `actions/configure-pages` and `actions/upload-pages-artifact` with path `dist`.
    - Job `deploy` (needs `build`): `actions/deploy-pages`, environment `github-pages` with `url: ${{ steps.deployment.outputs.page_url }}`.
12. Create `src/vite-env.d.ts` (if the template did not) and declare `ImportMetaEnv` with an optional `VITE_REPO_URL: string`.
13. `.gitignore`: `node_modules`, `dist`, `coverage`, `playwright-report`, `test-results`, `.env*`, `!.env.example`. Add a standard `.editorconfig` (2 spaces, LF, utf-8, final newline).
14. `README.md`: what the project is, the question it answers, the stack, scripts, local development, and deployment notes (Settings → Pages → Source: GitHub Actions; Settings → Actions → Workflow permissions: Read and write; optional secret `AA_API_KEY`). Add a "Planned data sources" list: OpenRouter, LiteLLM price list, Artificial Analysis, Frankfurter (ECB rates), and curated data.
15. `AGENTS.md` with exactly the content below. The only change you make is filling in the "Vitest environment" line after you have configured Vitest:

```markdown
# AGENTS.md — token-price-analyzer

## Why
Static web app that answers: "Given my budget and how I use AI, should I pay for an API (which model, which channel) or a subscription (which plan), and what quality do I get per dollar right now?" Data comes from public sources (OpenRouter, LiteLLM price list, Artificial Analysis, ECB FX via Frankfurter) plus a small curated dataset (subscription plans, usage profiles, channel fees). The data is refreshed daily by GitHub Actions.

## What (stack and layout)
- Vite + React + TypeScript (strict), Tailwind CSS v4, Vitest + Testing Library, Playwright (e2e), Node 22, npm.
- `src/domain/` holds pure business logic and zod schemas (the single source of truth for data shapes). No React, DOM or network.
- `src/domain/sources/` holds pure normalizers that turn raw source JSON into domain objects. Both scripts and the browser use them.
- `src/data/` holds data-loading hooks (snapshot, live refresh). `src/state/` holds the settings store and URL state.
- `src/features/<feature>/` has one folder per page: advisor, explorer, budget, subscriptions, compare, history, profiles, sources.
- `src/components/ui/` holds small reusable primitives. `src/components/layout/` holds the app shell.
- `src/i18n/` holds the i18next setup and `locales/{en,pl}/<namespace>.json`.
- `scripts/` is the Node data pipeline (run with `tsx`): fetch → normalize → validate → write `public/data/`.
- `data/curated/` holds hand-maintained JSON, validated by `npm run data:validate`.
- `public/data/` is GENERATED by scripts and CI. Never hand-edit it; regenerate it.
- `tools/` is maintainer tooling (e.g. the Jules API CLI). It is not part of the app. Don't modify it.

## How (commands)
- Install: `npm ci` · Dev: `npm run dev` · Build: `npm run build`
- Required checks before submitting: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
- E2E: `npm run e2e` (first run `npx playwright install --with-deps chromium`)

## Conventions
- Prices are USD per 1M tokens (`inputPerMTok`, `outputPerMTok`, …). Currency and VAT conversion happen only at display time, via `src/domain/currency.ts`.
- Data shapes are defined once as zod schemas in `src/domain/schemas.ts`. TS types are `z.infer` exports from `src/domain/types.ts`.
- Canonical model id = OpenRouter base id without the variant suffix, e.g. `anthropic/claude-sonnet-5.5`.
- Every UI string goes through i18n with `en` and `pl`. Human text in curated data uses `{ "en": "...", "pl": "..." }`.
- Tests never use the network; they use committed fixtures.
- Routing uses `HashRouter` (works on GitHub Pages). Fetch static data with `import.meta.env.BASE_URL + 'data/…'`.
- Vitest environment: <describe the mechanism you configured>.
- Keep components small. Put heavy computation in `src/domain/` (or a pure `*.ts` helper next to the feature) with unit tests.

## Don'ts
- Don't hand-edit `public/data/`. Don't add dependencies a task did not allow. Don't commit secrets. Don't modify `tools/`.
- Don't implement tasks from `JULES_PROMPTS.md` other than the one you were given.
```

## Out of scope
Routing, i18n, data, any real features.

## Acceptance criteria
- `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build` all pass. `npm run e2e` passes with Chromium installed.
- `dist/index.html` references assets with relative paths (`./assets/...`).
- Both workflows are valid YAML and match the requirements above.
- AGENTS.md and README.md exist and are accurate.

## PR title
chore: scaffold Vite + React + TS app with tooling, CI and Pages deploy
````

---

### Task 02 — Domena: schematy i matematyka

````text
# Task 02 — Domain core: data schemas and pricing, quality and currency math

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Task 01 is merged: Vite + React + TS scaffold, Tailwind v4, Vitest, Playwright, ESLint/Prettier, CI and Pages deploy workflows, AGENTS.md. There is no domain code yet.

## Goal
Create the pure TypeScript core every other task depends on: zod schemas for all data shapes, plus well-tested functions for task cost, budget reach, quality tiers, the Pareto frontier, currency/VAT conversion and ranges. There are no UI changes in this task.

## Allowed packages
Runtime: `zod` (current stable).

## Requirements

### 1. `src/domain/schemas.ts` (zod schemas) and `src/domain/types.ts` (exported `z.infer` types)
Export every schema as `XxxSchema` and every type as `Xxx`. Field names must be exactly as written.

- `Currency`: `'USD' | 'PLN' | 'EUR'`.
- `LocalizedText`: `{ en: string; pl: string }`, both non-empty.
- `Range`: `{ low: number; high: number }`, both ≥ 0, refined so that `low <= high`.
- `TaskShape`: `{ inputTokens: number ≥ 0; outputTokens: number ≥ 0; cachedInputShare: number in [0,1] }`.
- `PriceOffer`:
  `{ channel: 'openrouter' | 'openrouter-free' | 'openrouter-batch' | 'direct'; vendor: string /* 'openrouter', 'anthropic', … */; sourceId: string; inputPerMTok: number ≥ 0; outputPerMTok: number ≥ 0; cacheReadPerMTok?: number ≥ 0; cacheWritePerMTok?: number ≥ 0; isFree: boolean; longContext?: { thresholdTokens: int > 0; inputPerMTok: number; outputPerMTok: number; cacheReadPerMTok?: number }; url?: string (url) }`.
- `QualityTier`: `'S' | 'A' | 'B' | 'C' | 'D'`.
- `QualityScores`: `{ intelligence?: number; coding?: number; agentic?: number; source: 'artificial-analysis' | 'openrouter-aa' | 'manual' | 'none'; tier?: QualityTier; note?: LocalizedText }`.
- `Speed`: `{ outputTokensPerSecond?: number > 0; timeToFirstTokenSeconds?: number ≥ 0; source: string }`.
- `ModelEntry`: `{ id: string; name: string; provider: string /* slug, e.g. 'anthropic' */; providerName: string; description?: string; createdAt?: string /* ISO date */; contextLength?: int > 0; maxOutputTokens?: int > 0; inputModalities: string[]; outputModalities: string[]; capabilities: { tools: boolean; reasoning: boolean; structuredOutputs: boolean; imageInput: boolean }; openWeights: boolean | null; offers: PriceOffer[] /* min 1 */; quality: QualityScores; speed?: Speed; deprecatedAt?: string }`.
- `QualityDimension`: `'intelligence' | 'coding' | 'agentic'`.
- `UsageProfile`: `{ id: string /* kebab-case regex */; name: LocalizedText; description: LocalizedText; inputTokensPerTask: int > 0; outputTokensPerTask: int > 0; cachedInputShare: number in [0,1]; tasksPerDay: number > 0; workDaysPerMonth: int in [1,31]; qualityDimension: QualityDimension; allowBatch: boolean; isPreset: boolean }`.
- `SubscriptionLimit`: a discriminated union on `kind`:
  - `{ kind: 'window'; windowHours: number > 0; unitsPerWindow: Range; weeklyUnitsCap?: Range }`
  - `{ kind: 'monthly'; unitsPerMonth: Range }`
  - `{ kind: 'usd-credit'; usdPerMonth: number > 0 }`
  - `{ kind: 'unknown' }`
- `SubscriptionPlan`: `{ id: string /* kebab-case */; provider: string; providerName: string; name: string; priceUsdMonthly: number ≥ 0; annualPriceUsdMonthly?: number ≥ 0; localPrices?: { PLN?: number; EUR?: number } /* gross monthly local list prices */; url: string (url); lastVerified: string /* YYYY-MM-DD */; confidence: 'official' | 'reported' | 'estimated'; primaryModelId: string; includedModelIds: string[]; features: { codingAgents: string[]; imageGeneration: boolean; deepResearch: boolean; apiAccess: boolean; longContextTokens?: int > 0 }; limit: SubscriptionLimit; unitLabel: LocalizedText; referenceUnit: TaskShape; notes: LocalizedText; sources: { label: string; url: string (url) }[] /* min 1 */ }`.
- `ChannelFee`: `{ vendor: string; purchaseFeePct: number ≥ 0; minFeeUsd: number ≥ 0; minTopUpUsd: number ≥ 0; notes: LocalizedText; sourceUrl: string (url); lastVerified: string /* YYYY-MM-DD */ }`.
- `QualityOverride`: `{ modelId: string; tier?: QualityTier; intelligence?: number; coding?: number; agentic?: number; force: boolean; note: LocalizedText }`. Also export `QualityOverridesFileSchema = { overrides: QualityOverride[] }`.
- `ModelAlias`: `{ source: 'litellm' | 'artificial-analysis'; sourceId: string; modelId: string }`. Also export `ModelAliasesFileSchema = { aliases: ModelAlias[] }`.
- `FxRates`: `{ base: 'USD'; date: string; rates: { USD: 1 (literal); PLN: number > 0; EUR: number > 0 } }`.
- `SourceId`: `'openrouter' | 'litellm' | 'artificial-analysis' | 'frankfurter' | 'curated'`.
- `SourceStatus`: `{ id: SourceId; ok: boolean; skipped: boolean; fetchedAt: string; itemCount: int ≥ 0; error?: string }`.
- `Snapshot`: `{ schemaVersion: 1 (literal); generatedAt: string /* ISO datetime */; sources: SourceStatus[]; fx: FxRates; models: ModelEntry[]; subscriptions: SubscriptionPlan[]; usageProfiles: UsageProfile[]; channelFees: ChannelFee[]; diagnostics: { unmatched: { source: SourceId; ids: string[] }[]; warnings: string[] } }`.
- `parseSnapshot(json: unknown): Snapshot`: on failure throws an `Error` whose message lists the first 5 issues as `path: message`.

### 2. `src/domain/range.ts`
`range(low, high)`, `point(x)` (low = high = x), `scaleRange(r, k)`, `addRanges(a, b)`, `divideRange(r, d)`, `minRange(r, cap)` (caps both ends), `isPoint(r)`. All results are valid Ranges (when `k < 0` throw).

### 3. `src/domain/pricing.ts`
- `effectivePrices(offer, inputTokens)`: returns `{ inputPerMTok, outputPerMTok, cacheReadPerMTok?, cacheWritePerMTok? }`, using `offer.longContext` prices when `inputTokens > thresholdTokens`.
- `costPerTask(task: TaskShape, offer: PriceOffer, opts?: { chargeCacheWrites?: boolean /* default true */ }): number` (USD):
  - `cached = inputTokens × cachedInputShare`; `uncached = inputTokens − cached`.
  - Cached tokens are priced at `cacheReadPerMTok ?? inputPerMTok`.
  - Uncached tokens are priced at `cacheWritePerMTok` when `chargeCacheWrites && cachedInputShare > 0 && cacheWritePerMTok !== undefined`, otherwise at `inputPerMTok`.
  - Output tokens are priced at `outputPerMTok`.
  - Divide by 1e6. Free offers (`isFree`) return 0.
- `effectivePerMTok(task, offer)`: `costPerTask / (inputTokens + outputTokens) × 1e6` (the "blended $ per 1M tokens for this usage shape"); returns 0 for empty tasks.
- `taskFromProfile(profile): TaskShape`; `monthlyTasks(profile)` = `tasksPerDay × workDaysPerMonth`; `monthlyCost(profile, offer)`.
- `tasksForBudget(budgetUsd, task, offer)`: `Math.floor(budget / costPerTask)`; returns `Number.POSITIVE_INFINITY` for zero-cost tasks.
- `workDaysForBudget(budgetUsd, profile, offer)` = `budget / (costPerTask × tasksPerDay)` (Infinity for free).
- `tokensForBudget(budgetUsd, task, offer)`: `{ inputTokens, outputTokens }` purchasable at this task's ratio.
- `generationSecondsPerTask(task, speed?)`: `ttft + outputTokens / tps`, or `null` if `tps` is unknown.
- `selectOffer(model, task, opts: { includeFree: boolean; includeBatch: boolean }): PriceOffer | undefined`: the cheapest eligible offer by `costPerTask`. Free offers count only if `includeFree`, and `openrouter-batch` offers only if `includeBatch`. Ties prefer `direct` over `openrouter`.
- `usableCredit(budgetUsd, fee?: ChannelFee)`: returns 0 if `budget < fee.minTopUpUsd`; otherwise `budget − max(budget × purchaseFeePct / 100, minFeeUsd)`, clamped at ≥ 0. Without a fee it returns the budget unchanged.

### 4. `src/domain/quality.ts`
- `qualityScore(model, dimension)`: the score for that dimension, falling back to `intelligence`, otherwise `undefined`.
- `assignTiers(models, dimension): Map<string, QualityTier>`: rank models that have a score by percentile. Top 5% → S, next 15% → A, next 30% → B, next 30% → C, rest → D (with at least one S when there is at least one scored model). Models without a score get `model.quality.tier` if set, and otherwise no entry.
- `tierWeight(tier)`: S 1.0, A 0.85, B 0.7, C 0.55, D 0.4. Unknown tiers get 0.5.
- `meetsMinTier(tier | undefined, minTier)`: true when the tier is at least `minTier` (an unknown tier fails anything stricter than D).
- `paretoFrontier(points: { id: string; cost: number; quality: number | undefined }[]): Set<string>`: the ids not dominated by another point (another point dominates when it has cost ≤ and quality ≥, with at least one strictly). Points without quality are excluded.
- `qualityPerDollar(quality, costPerTaskUsd)`: `quality / costPerTask`, or `null` when cost is 0 or quality is undefined.

### 5. `src/domain/currency.ts`
- `convertFromUsd(amountUsd, currency, fx)`, `convertToUsd(amount, currency, fx)`.
- `applyVat(amount, vatRatePct)`, `removeVat(amount, vatRatePct)`.
- `formatMoney(amount, currency, locale, opts?: { maxFractionDigits?: number; compact?: boolean })` using `Intl.NumberFormat`. Amounts with magnitude below 0.01 (and not 0) show up to 3 significant digits, e.g. `$0.00042`.
- `formatTokens(n, locale)`: compact notation (`1.2M`, `350K`).
- `formatPercent(x, locale)` for x in [0,1].

### 6. Fixture and tests
- `src/domain/__fixtures__/sample-snapshot.json`: a small, valid Snapshot with 8 models covering every offer channel (including one model with a long-context price and one with only a free offer), quality from different sources (one model without quality), 4 subscription plans covering every limit kind, 2 usage profiles, 2 channel fees and FX rates. Add a test proving it parses.
- Unit tests for every function above, including edge cases: zero cache, 100% cache, missing cacheRead price, cache writes on and off, the long-context threshold, free offers, a fee below the minimum and the minimum top-up, a VAT round trip, Pareto ties and dominated points, tiers with fewer than 5 models, and `parseSnapshot` error message content.

## Out of scope
UI, fetching data, curated datasets, subscription capacity math (that comes in a later task).

## Acceptance criteria
- All rule-5 checks pass. `src/domain/` has no imports from React, the DOM or the network.
- Test coverage of `src/domain/` is ≥ 90% lines (`npm run test:coverage`). State the number in the PR description.

## PR title
feat(domain): data schemas and pricing, quality and currency core
````

---

### Task 03 — Dane kurowane (subskrypcje, profile, opłaty)

````text
# Task 03 — Curated datasets (subscriptions, usage profiles, channel fees) and validator

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–02 are merged. `src/domain/schemas.ts` defines `SubscriptionPlan`, `UsageProfile`, `ChannelFee`, `QualityOverridesFileSchema`, `ModelAliasesFileSchema` and `Snapshot`, plus pricing/quality/currency helpers. There is no data yet.

## Goal
Create the hand-maintained datasets in `data/curated/`, a validation script (`npm run data:validate`) and maintainer docs. Another task (source normalizers) may be running in parallel. Do not touch `src/domain/sources/` or `scripts/__fixtures__/`.

## Allowed packages
None.

## Requirements

### 1. `data/curated/usage-profiles.json`
Shape `{ "profiles": UsageProfile[] }`. All entries have `isPreset: true` and `workDaysPerMonth: 22`. Write natural `en` and `pl` names and 1–2 sentence descriptions explaining what a "task" means for each profile.

| id | name (en / pl) | inputTokensPerTask | outputTokensPerTask | cachedInputShare | tasksPerDay | qualityDimension | allowBatch |
|---|---|---|---|---|---|---|---|
| chat-light | Casual chat / Okazjonalny czat | 1500 | 600 | 0 | 15 | intelligence | false |
| chat-heavy | Heavy chat & writing / Intensywny czat i pisanie | 6000 | 1200 | 0.3 | 60 | intelligence | false |
| coding-assistant | Coding assistant (IDE chat) / Asystent programisty (czat w IDE) | 12000 | 1500 | 0.5 | 80 | coding | false |
| coding-agent | Agentic coding (CLI agent turns) / Programowanie agentowe (tury agenta CLI) | 80000 | 2500 | 0.9 | 250 | agentic | false |
| doc-analysis | Long-document analysis / Analiza długich dokumentów | 60000 | 2000 | 0.1 | 10 | intelligence | false |
| batch-processing | Bulk processing (batch API) / Przetwarzanie masowe (batch API) | 2000 | 400 | 0 | 2000 | intelligence | true |

### 2. `data/curated/subscriptions.json`
Shape `{ "plans": SubscriptionPlan[] }`. Seed it with the plans below, researched on 2026-10-05. Set `lastVerified: "2026-10-05"` on every plan. Write `notes` in en and pl, based on the note given. `sources` always contains at least the plan URL (label "Official pricing page"). `apiAccess` is false unless stated. `includedModelIds` are OpenRouter-style ids. They may not all exist in the current data; that is expected and the validator reports it as a warning.

Reference units (`referenceUnit`, a TaskShape) used below:
- **CHAT** = `{ inputTokens: 3000, outputTokens: 800, cachedInputShare: 0.3 }`, unitLabel en "chat message" / pl "wiadomość w czacie"
- **CODEX** = `{ inputTokens: 300000, outputTokens: 6000, cachedInputShare: 0.9 }`, unitLabel en "Codex local message (multi-step agent run)" / pl "lokalna wiadomość Codex (wieloetapowe zadanie agenta)"
- **GLM** = `{ inputTokens: 150000, outputTokens: 4000, cachedInputShare: 0.9 }`, unitLabel en "prompt in a coding tool" / pl "prompt w narzędziu do kodowania"
- **COPILOT** = `{ inputTokens: 30000, outputTokens: 1500, cachedInputShare: 0.5 }`, unitLabel en "premium request" / pl "zapytanie premium"

Plans (id — providerName (provider slug) — name — price — confidence — primaryModelId — includedModelIds — features — limit — referenceUnit — note):
1. `chatgpt-go` — OpenAI (openai) — ChatGPT Go — $8 — reported — `openai/gpt-5.6-luna` — [openai/gpt-5.6-luna] — imageGeneration — limit unknown — CHAT — "Unlimited GPT-5.6 Luna text chats subject to abuse guardrails; ad-supported in some regions." — url https://chatgpt.com/pricing
2. `chatgpt-plus` — OpenAI — ChatGPT Plus — $20 — official — `openai/gpt-6-sol` — [openai/gpt-6-astra, openai/gpt-6-sol, openai/gpt-6-luna, openai/gpt-5.6-sol] — codingAgents ["codex"], imageGeneration, deepResearch — window 5h, unitsPerWindow 10–100 — CODEX — "OpenAI publishes approximate Codex ranges per 5h: 10–100 (Sol), 25–200 (Terra), 250–2,000 (Luna) local messages. Ordinary chat has no single published cap." — url https://chatgpt.com/pricing, extra source https://help.openai.com
3. `chatgpt-pro-100` — OpenAI — ChatGPT Pro ($100) — $100 — reported — `openai/gpt-6-sol` — same as Plus + openai/gpt-6-astra-pro — same features — window 5h, 50–500 — CODEX — "About 5× Plus limits."
4. `chatgpt-pro-200` — OpenAI — ChatGPT Pro ($200) — $200 — reported — `openai/gpt-6-sol` — same as Pro $100 — same features — window 5h, 200–2000 — CODEX — "Reopened to new sign-ups on 2026-09-29 with a reduced, unpublished allowance; this range is the previous 20× allowance and is likely overstated."
5. `claude-pro` — Anthropic (anthropic) — Claude Pro — $20, annualPriceUsdMonthly 17 — reported — `anthropic/claude-sonnet-5.5` — [anthropic/claude-opus-5.5, anthropic/claude-sonnet-5.5, anthropic/claude-opus-5, anthropic/claude-sonnet-5] — codingAgents ["claude-code"], deepResearch — window 5h, 45–90 — CHAT — "Anthropic does not publish counts. ~45 messages per 5h is a community estimate from before the 2026-09-22 limit increase; a weekly cap also applies. Fable models are available only via extra usage credits." — url https://claude.com/pricing, extra source https://support.claude.com
6. `claude-max-5x` — Anthropic — Claude Max 5× — $100 — reported — `anthropic/claude-opus-5.5` — Pro list + anthropic/claude-fable-5.1 — same features — window 5h, 225–450 — CHAT — "Officially 5× the Pro per-session allowance; Fable 5.1 can use up to 50% of the weekly allowance."
7. `claude-max-20x` — Anthropic — Claude Max 20× — $200 — reported — `anthropic/claude-opus-5.5` — same as Max 5× — same features — window 5h, 900–1800 — CHAT — "Officially 20× the Pro per-session allowance."
8. `google-ai-plus` — Google (google) — Google AI Plus — $4.99 — official — `google/gemini-3.6-flash` — [google/gemini-3.6-flash, google/gemini-3.1-pro-preview] — none — limit unknown — CHAT — "2× Free usage; compute-based limits refresh every 5h with a weekly ceiling; 400 GB storage." — url https://one.google.com/about/google-ai-plans/
9. `google-ai-pro` — Google — Google AI Pro — $19.99 — official — `google/gemini-3.1-pro-preview` — [google/gemini-3.1-pro-preview, google/gemini-3.8-flash] — codingAgents ["gemini-cli", "jules"], imageGeneration, deepResearch, longContextTokens 1048576 — limit unknown — CHAT — "4× Free usage, compute-based; also raises Jules and Gemini CLI limits; 5 TB storage."
10. `google-ai-ultra-5x` — Google — Google AI Ultra 5× — $99.99 — official — `google/gemini-3.1-pro-preview` — same as AI Pro — same features — limit unknown — CHAT — "5× AI Pro limits; includes Deep Think."
11. `google-ai-ultra-20x` — Google — Google AI Ultra 20× — $199.99 — official — same as Ultra 5× — limit unknown — CHAT — "20× AI Pro limits; includes Deep Think."
12. `supergrok` — xAI (x-ai) — SuperGrok — $30 — reported — `x-ai/grok-4.7` — [x-ai/grok-4.7] — imageGeneration, deepResearch — limit unknown — CHAT — "Limits not published as fixed numbers." — url https://x.ai/grok
13. `glm-coding-lite` — Z.ai (z-ai) — GLM Coding Lite — $18 — reported — `z-ai/glm-5.3` — [z-ai/glm-5.3, z-ai/glm-5.3-flash] — codingAgents ["claude-code", "cline", "opencode"], apiAccess true — window 5h, 80–80, weeklyUnitsCap 400–400 — GLM — "Usable only in officially supported coding tools; the newest models consume 2–3× quota at peak hours." — url https://z.ai/subscribe
14. `glm-coding-pro` — Z.ai — GLM Coding Pro — $80 — reported — same models/features — window 5h, 400–400, weekly 2000–2000 — GLM — same note
15. `glm-coding-max` — Z.ai — GLM Coding Max — $168 — reported — same — window 5h, 1600–1600, weekly 8000–8000 — GLM — same note
16. `github-copilot-pro` — GitHub (github) — Copilot Pro — $10 — reported — `anthropic/claude-sonnet-5.5` — [] — codingAgents ["copilot"] — monthly 300–300 — COPILOT — "Premium-request multipliers differ per model; base-model completions are unlimited. Verify current numbers." — url https://github.com/features/copilot/plans
17. `github-copilot-pro-plus` — GitHub — Copilot Pro+ — $39 — reported — same — monthly 1500–1500 — COPILOT — same note
18. `cursor-pro` — Cursor (cursor) — Cursor Pro — $20 — reported — `anthropic/claude-sonnet-5.5` — [] — codingAgents ["cursor"] — usd-credit 20 — COPILOT — "Includes roughly $20/month of frontier-model usage at API prices plus an unlimited 'Auto' model. Verify current terms." — url https://cursor.com/pricing
19. `mistral-le-chat-pro` — Mistral (mistralai) — Le Chat Pro — $14.99 — reported — `mistralai/mistral-medium-3-5` — [mistralai/mistral-medium-3-5] — imageGeneration, deepResearch — limit unknown — CHAT — "Limits not published as fixed numbers." — url https://mistral.ai/pricing
20. `perplexity-pro` — Perplexity (perplexity) — Perplexity Pro — $20 — reported — `perplexity/sonar-pro` — [perplexity/sonar-pro] — deepResearch — limit unknown — CHAT — "Search-focused; lets you pick third-party models per query." — url https://www.perplexity.ai/pro

### 3. `data/curated/channel-fees.json`
Shape `{ "fees": ChannelFee[] }`, all with `lastVerified: "2026-10-05"` and notes saying the values must be verified:
- `openrouter`: purchaseFeePct 5.5, minFeeUsd 0.8, minTopUpUsd 5, sourceUrl https://openrouter.ai/docs/faq
- `anthropic`: 0, 0, 5, https://docs.anthropic.com/en/api/billing
- `openai`: 0, 0, 5, https://platform.openai.com/docs/guides/billing
- `google`: 0, 0, 0, https://ai.google.dev/gemini-api/docs/pricing (note: pay-as-you-go billing; the API also has a free tier)

### 4. `data/curated/quality-overrides.json` and `data/curated/model-aliases.json`
`{ "overrides": [] }` and `{ "aliases": [] }`. Both are empty for now and are documented in the docs.

### 5. Validator
- `scripts/lib/curated.ts`: `loadCurated(dir = 'data/curated')` reads and parses all five files with the zod schemas from `src/domain/schemas.ts`, and returns a typed object `{ profiles, plans, fees, qualityOverrides, aliases }`.
- `scripts/lib/validate-curated.ts`: a pure function `validateCurated(curated, snapshot?: Snapshot): { errors: string[]; warnings: string[] }`.
  - **Errors**: duplicate ids (profiles, plans, fee vendors, override modelIds, alias pairs), and `lastVerified` in the future relative to an injected `now`.
  - **Warnings**: plans whose `primaryModelId`/`includedModelIds` are not in the snapshot; overrides and aliases pointing to unknown models; `lastVerified` older than 45 days.
- `scripts/validate-data.ts`, exposed as `npm run data:validate` (`tsx scripts/validate-data.ts`): loads curated data. If `public/data/snapshot.json` exists, it also parses it with `parseSnapshot` and passes it in. It prints errors and warnings and exits with code 1 only when there are schema errors or `errors`.
- Unit tests for `validateCurated` (temporary in-memory objects, no file system) and a test that the committed curated files pass with zero errors.

### 6. Docs
`docs/curated-data.md` explains each file and field, confidence levels (official / reported / estimated), how to choose a `referenceUnit` and limits for a new plan (with a worked example), how to add a quality override or alias, the "verify every ~30 days" policy, and how to submit changes via PR.

## Out of scope
Fetching remote data, source normalizers, UI.

## Acceptance criteria
- `npm run data:validate` exits 0 (warnings about missing snapshot models are fine).
- All rule-5 checks pass.

## PR title
feat(data): curated subscriptions, usage profiles and channel fees with validator
````

---

### Task 04 — Normalizatory źródeł i dopasowanie modeli

````text
# Task 04 — Source normalizers (OpenRouter, LiteLLM, Artificial Analysis, Frankfurter) and model matching

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–02 are merged: scaffold plus `src/domain/` (schemas including `ModelEntry`, `PriceOffer`, `QualityScores`, `Speed`, `FxRates`, `ModelAlias`; helpers in `pricing.ts`, `quality.ts`, `currency.ts`, `range.ts`). Another task (curated data in `data/curated/` + validator) may be running in parallel. Do not touch `data/curated/`, `scripts/lib/` or `docs/curated-data.md`.

## Goal
Write the pure functions that turn raw responses from each public data source into domain objects, plus conservative model matching across sources. Commit realistic fixtures. Network fetching and snapshot writing belong to the next task. Here everything is pure and tested against fixtures.

## Allowed packages
None.

## Requirements

### 1. Fixtures in `scripts/__fixtures__/`
If your environment has network access, download real responses once and trim them. Otherwise build them by hand following the documented shapes below. Keep each file under ~150 KB.
- `openrouter-models.json` from `GET https://openrouter.ai/api/v1/models` (no auth). Keep ~30 models, including:
  - models with `:free` and `:batch` variants of the same base model, and one model that exists only as `:free`;
  - an alias entry whose id starts with `~` (it has an `alias_target` field);
  - a model with `pricing.overrides` containing `min_prompt_tokens` (long context), and one with time-window overrides (`utc_start`/`utc_end`);
  - a router model with negative prices (e.g. `"-1"`);
  - models with `benchmarks.artificial_analysis` (fields `intelligence_index`, `coding_index`, `agentic_index`, some null) and models without it;
  - models with a non-null `hugging_face_id`.
  Relevant fields: `id`, `canonical_slug`, `hugging_face_id`, `name` ("Provider: Model"), `created` (unix seconds), `description`, `context_length`, `architecture.input_modalities`, `architecture.output_modalities`, `pricing.{prompt, completion, input_cache_read, input_cache_write, overrides}` (strings, USD per token), `top_provider.max_completion_tokens`, `supported_parameters`, `expiration_date`, `benchmarks`.
- `litellm-prices.json`: ~30 entries from `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`, covering providers anthropic, openai, gemini, xai, deepseek and mistral, plus at least one non-chat entry and one entry from a non-first-party provider (e.g. bedrock or azure). Relevant fields: `litellm_provider`, `mode`, `input_cost_per_token`, `output_cost_per_token`, `cache_read_input_token_cost`, `cache_creation_input_token_cost`, and long-context keys like `input_cost_per_token_above_200k_tokens` / `output_cost_per_token_above_200k_tokens`. Inspect the real file to confirm field names.
- `aa-models-page1.json` and `aa-models-page2.json`: synthetic pages of `GET https://artificialanalysis.ai/api/v2/language/models/free` (do NOT call it; it needs a key). Shape: `{ tier, intelligence_index_version, pagination: { page, page_size, total_pages, has_more }, data: [{ id, name, slug, release_date, model_creator: { id, name }, evaluations: { artificial_analysis_intelligence_index, artificial_analysis_coding_index, artificial_analysis_agentic_index }, pricing: { price_1m_input_tokens, price_1m_output_tokens }, performance: { median_output_tokens_per_second, median_time_to_first_token_seconds } }] }`. Use about 8 models whose slugs correspond to models in the OpenRouter fixture (e.g. slug `claude-sonnet-5-5` for `anthropic/claude-sonnet-5.5`), plus 2 that match nothing.
- `frankfurter-latest.json`: `{ "amount": 1.0, "base": "USD", "date": "2026-10-02", "rates": { "EUR": 0.89087, "PLN": 3.8998 } }`.

### 2. `src/domain/sources/match.ts`
- `normalizeModelKey(s: string): string`: lowercase; drop everything up to the last `/`; drop a trailing `:variant`; drop parenthetical parts like ` (high)`; drop date suffixes `-YYYYMMDD` and `-YYYY-MM-DD` (do NOT drop 4-digit version suffixes like `-2512`); drop a trailing `-latest`; replace `.`, `_` and spaces with `-`; collapse repeated `-`.
- `createModelMatcher(models: ModelEntry[], aliases: ModelAlias[], source: ModelAlias['source'])` returns `(sourceId: string, providerHint?: string) => string | undefined`. Resolution order:
  1. an exact alias for this source;
  2. a model with the same provider (when the hint maps to a known provider slug) and an equal normalized key;
  3. a unique model across all providers with an equal normalized key.
  It never does fuzzy or partial matching; a wrong match is worse than no match.
- Export `PROVIDER_SLUG_BY_SOURCE_PROVIDER`: maps LiteLLM provider names and AA creator names to OpenRouter provider slugs. LiteLLM: `anthropic→anthropic`, `openai→openai`, `gemini→google`, `xai→x-ai`, `deepseek→deepseek`, `mistral→mistralai`, `moonshot→moonshotai`, `zai→z-ai`, `dashscope→qwen`, `minimax→minimax`. AA creator names: `Anthropic`, `OpenAI`, `Google`, `xAI`, `DeepSeek`, `Mistral`, `Moonshot AI`, `Z AI`, `Alibaba`, `MiniMax`, `Meta`.

### 3. `src/domain/sources/openrouter.ts`
`normalizeOpenRouter(raw: unknown): { models: ModelEntry[]; warnings: string[] }`
- Parse leniently with a local zod schema that covers only the fields used, with unknown keys allowed. If the top-level shape is invalid, throw a descriptive error.
- Skip ids starting with `~`. Skip entries with any negative price.
- Base id = id without a `:free` or `:batch` suffix. A `:free` entry becomes an offer with `channel: 'openrouter-free'` and `isFree: true`; `:batch` becomes `channel: 'openrouter-batch'`; everything else is `channel: 'openrouter'` (`isFree` true only if both prompt and completion are 0). Any other suffix (e.g. `:thinking`) is kept as part of a separate model id.
- Convert per-token price strings to per-MTok numbers (× 1e6, rounded to 6 decimals). Map cache read/write prices. Take the first override whose only condition is `min_prompt_tokens` and map it to `longContext`. Ignore time-window overrides, adding one warning with their count.
- `vendor: 'openrouter'`, `sourceId` = the original id, `url: 'https://openrouter.ai/' + baseId`.
- Model fields: `provider` = id prefix before `/`; `providerName` and `name` come from splitting `name` at the first `": "` (fall back to the provider slug and the full name); `createdAt` = ISO date from `created`; `contextLength`; `maxOutputTokens` from `top_provider.max_completion_tokens`; modalities; capabilities (`tools` ⇐ supported_parameters has `tools`; `reasoning` ⇐ `reasoning`; `structuredOutputs` ⇐ `structured_outputs` or `response_format`; `imageInput` ⇐ input modalities include `image`); `openWeights` = `true` if `hugging_face_id` is a non-empty string, otherwise `null`; `deprecatedAt` from `expiration_date`.
- Quality: from `benchmarks.artificial_analysis` (null → undefined), with `source: 'openrouter-aa'`. If there are no scores, use `{ source: 'none' }`. When variants disagree, use the base entry's data.
- A model that exists only as `:free` gets created from the free entry (with base id = id without `:free`).
- Output is sorted by `provider`, then `name`. Every model has ≥ 1 offer.

### 4. `src/domain/sources/litellm.ts`
`normalizeLiteLlm(raw: unknown, models: ModelEntry[], aliases: ModelAlias[]): { offersByModelId: Map<string, PriceOffer[]>; unmatched: string[] }`
- Only entries with `mode === 'chat'` and a `litellm_provider` present in `PROVIDER_SLUG_BY_SOURCE_PROVIDER`. Skip entries without input or output cost.
- Match with `createModelMatcher(..., 'litellm')`, using the key and the provider hint.
- Offer: `channel: 'direct'`, `vendor` = provider slug, `sourceId` = the LiteLLM key, prices × 1e6, cache read/write, and `longContext` from `*_above_<N>k_tokens` keys (threshold = N × 1000).
- When several keys map to the same model (dated duplicates), keep the cheapest per vendor. `unmatched` lists the keys that were eligible but not matched.

### 5. `src/domain/sources/artificial-analysis.ts`
`normalizeArtificialAnalysis(pages: unknown[], models: ModelEntry[], aliases: ModelAlias[]): { byModelId: Map<string, { quality: QualityScores; speed?: Speed }>; unmatched: string[] }`
- Parse every page. Match by `slug` with the creator name as provider hint. Quality has `source: 'artificial-analysis'`. Speed has `source: 'artificial-analysis'`, with `outputTokensPerSecond` and `timeToFirstTokenSeconds` when > 0.
- If two AA entries match the same model, keep the one with the higher intelligence index.

### 6. `src/domain/sources/fx.ts`
`normalizeFrankfurter(raw: unknown): FxRates`. Throw if PLN or EUR is missing or not positive.

### 7. Tests
- `match.test.ts`: cases such as `claude-sonnet-5-5` ↔ `anthropic/claude-sonnet-5.5`; `gpt-6-sol` ↔ `openai/gpt-6-sol`; `gemini/gemini-3.1-pro-preview` ↔ `google/gemini-3.1-pro-preview`; `claude-opus-5-5-20260922` ↔ `anthropic/claude-opus-5.5`; `mistral-small-2603` stays distinct from `mistral-small`; an ambiguous key across two providers without a hint → undefined; alias precedence.
- One test file per normalizer, using the fixtures, covering every rule above (variants, `~` skip, negative prices, long context, time-window warning, quality null handling, free-only model, LiteLLM non-chat and non-first-party skips, dedupe, AA duplicates, unmatched lists).
- Every produced `ModelEntry` passes `ModelEntrySchema`.

## Out of scope
HTTP fetching, writing files, merging into a snapshot, curated data, UI.

## Acceptance criteria
- All rule-5 checks pass. No network access in tests.

## PR title
feat(data): pure source normalizers and cross-source model matching
````

---

### Task 05 — Budowanie snapshotu i skrypty fetch

````text
# Task 05 — Snapshot builder, fetch scripts and the first committed snapshot

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–04 are merged:
- `src/domain/` schemas and helpers, including `parseSnapshot`, `assignTiers` and `costPerTask`.
- `data/curated/` (usage-profiles, subscriptions, channel-fees, quality-overrides, model-aliases), `scripts/lib/curated.ts` (`loadCurated`), `scripts/lib/validate-curated.ts`, and `npm run data:validate`.
- `src/domain/sources/` with `normalizeOpenRouter`, `normalizeLiteLlm`, `normalizeArtificialAnalysis`, `normalizeFrankfurter`, `createModelMatcher`, and fixtures in `scripts/__fixtures__/`.

## Goal
Merge all sources and curated data into one validated `public/data/snapshot.json`. Add the `data:fetch` (network) and `data:sample` (offline, from fixtures) scripts, and commit the first real snapshot so the deployed site has data.

## Allowed packages
None (use Node 22's global `fetch` and `AbortController`).

## Requirements

### 1. `src/domain/sources/build-snapshot.ts` (pure)
`buildSnapshot(input): Snapshot`, where
`input = { now: Date; openrouter: { models: ModelEntry[]; warnings: string[] } | { error: string }; litellm?: { offersByModelId; unmatched } | { error: string }; aa?: { byModelId; unmatched } | { error: string } | 'skipped'; fx?: FxRates | { error: string }; previous?: Snapshot; curated: { profiles; plans; fees; qualityOverrides; aliases } }`.
- If OpenRouter failed and `previous` exists, start from `previous.models` and add the warning "OpenRouter failed; models carried over from previous snapshot". If there is no previous snapshot, throw.
- Add LiteLLM `direct` offers to the matched models (replacing any existing `direct` offers).
- Quality precedence per model: an override with `force: true` → AA direct → `openrouter-aa` → a non-forced override → `{ source: 'none' }`. An override's `tier` and `note` are always kept, and its numeric fields fill gaps. Speed comes from AA.
- After merging, compute tiers with `assignTiers(models, 'intelligence')` and write them into `quality.tier`, unless an override set a tier.
- FX: the new rates if OK; otherwise `previous.fx`; otherwise fallback `{ base: 'USD', date: 'fallback', rates: { USD: 1, PLN: 4.0, EUR: 0.9 } }` plus a warning.
- `sources`: one `SourceStatus` per source (`openrouter`, `litellm`, `artificial-analysis`, `frankfurter`, `curated`) with `ok`/`skipped`/`error`/`itemCount`/`fetchedAt` (= `now`).
- `diagnostics.unmatched` from LiteLLM and AA. `diagnostics.warnings` combines normalizer warnings with curated-data validation warnings (run `validateCurated` against the new models).
- Models are sorted by provider, then name. Drop models with zero offers.
- The result must pass `parseSnapshot`.

### 2. `scripts/lib/http.ts`
`fetchJson(url, { headers?, timeoutMs = 30000, retries = 2 })`: exponential backoff (500 ms, 1500 ms). Retries on network errors, 429 and 5xx only. Throws `HttpError` with status and url.

### 3. `scripts/fetch-data.ts` → `npm run data:fetch`
Implement it as `runFetchData(deps)` with injectable `{ fetchJson, readFile, writeFile, exists, env, now, log }` and a thin CLI entry, so it can be tested without the network.
- OpenRouter: `https://openrouter.ai/api/v1/models` (required).
- LiteLLM: `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json` (optional).
- Artificial Analysis: only if `env.AA_API_KEY` is set. `https://artificialanalysis.ai/api/v2/language/models/free?page=N` with header `x-api-key`. Follow `pagination.has_more`, up to 5 pages. Otherwise mark it `'skipped'`.
- Frankfurter: `https://api.frankfurter.dev/v1/latest?base=USD&symbols=PLN,EUR` (optional).
- Read `public/data/snapshot.json` as `previous` (if valid) and the curated data via `loadCurated`.
- Build the snapshot. Write `public/data/snapshot.json` (minified) and `public/data/meta.json` (pretty: `{ generatedAt, schemaVersion, modelCount, subscriptionCount, sources }`).
- Exit 1 (and do not overwrite files) only if `buildSnapshot` throws. Print a short summary table: per-source status and counts, number of models with quality, and unmatched counts.

### 4. `scripts/sample-data.ts` → `npm run data:sample`
Builds a snapshot from the fixtures only (OpenRouter, LiteLLM, both AA pages, Frankfurter) plus the real curated data, with a fixed `now = 2026-10-05T06:00:00Z`. By default it writes to `public/data/snapshot.json`; with `--out <path>` it writes elsewhere. Also write the same output to `src/domain/__fixtures__/built-snapshot.json`, so UI tests can use a realistic snapshot.

### 5. Extend `npm run data:validate`
When `public/data/snapshot.json` exists, it must also pass `parseSnapshot` (this may already be partly implemented; keep the existing behavior).

### 6. Tests
- `build-snapshot.test.ts`: precedence rules, carry-over on OpenRouter failure, FX fallback, tiers, a skipped AA source, and diagnostics.
- `fetch-data.test.ts`: `runFetchData` with a fake `fetchJson` serving the fixtures. Cover the happy path, AA skipped without a key, LiteLLM failure (still writes), OpenRouter failure without a previous snapshot (no write, error). Assert on the written content via the fake `writeFile`.

### 7. Commit data
- Run `npm run data:fetch` once in your environment. If the network works, commit the resulting `public/data/snapshot.json` and `meta.json`. If it does not, run `npm run data:sample` and commit that instead. State in the PR which one you did.
- Commit `src/domain/__fixtures__/built-snapshot.json`.

### 8. Docs
`docs/data-pipeline.md`: sources and what each contributes, the precedence rules, matching rules and how to add an alias, failure behavior, the commands, and attribution/licensing notes. Artificial Analysis data requires visible attribution with a link to https://artificialanalysis.ai; LiteLLM's price file is MIT-licensed; OpenRouter is a public API. Link it from README.

## Out of scope
The scheduled workflow, history, UI.

## Acceptance criteria
- `npm run data:sample` and `npm run data:validate` succeed offline.
- `public/data/snapshot.json` exists and parses.
- All rule-5 checks pass.

## PR title
feat(data): snapshot builder, fetch/sample scripts and initial snapshot
````

---

### Task 06 — Codzienny cron i historia cen

````text
# Task 06 — Daily data refresh workflow and price history

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–05 are merged. `npm run data:fetch` builds `public/data/snapshot.json` + `meta.json` from OpenRouter, LiteLLM, optional Artificial Analysis (`AA_API_KEY`), Frankfurter and curated data. `npm run data:validate` and `npm run data:sample` exist. `.github/workflows/deploy.yml` supports `workflow_call` with an optional `ref` input.

## Goal
Refresh the data automatically every day, commit it, deploy it, and keep a compact price history that later UI tasks will chart.

## Allowed packages
None.

## Requirements

### 1. Schemas (add to `src/domain/schemas.ts` and `types.ts`)
- `PricePoint`: the tuple `[date: string /* YYYY-MM-DD */, inputPerMTok: number, outputPerMTok: number]`.
- `PlanPricePoint`: the tuple `[date: string, priceUsdMonthly: number]`.
- `PriceHistory`: `{ schemaVersion: 1; year: int; updatedAt: string; models: Record<string, { firstSeen: string; points: PricePoint[] }>; subscriptions: Record<string, { firstSeen: string; points: PlanPricePoint[] }> }`.
- `HistoryIndex`: `{ schemaVersion: 1; years: int[]; updatedAt: string }`.

### 2. `src/domain/history.ts` (pure)
- `referenceOffer(model)`: the cheapest non-free, non-batch `openrouter` offer; otherwise the cheapest `direct` offer; otherwise undefined (free-only models are not tracked).
- `appendSnapshotToHistory(history: PriceHistory | undefined, snapshot: Snapshot, date: string, carryFrom?: PriceHistory): PriceHistory`:
  - Create the year file when it is missing. When `carryFrom` (the previous year's file) is given, seed every model's and plan's first point from its last known point dated `YYYY-01-01`, so charts are continuous.
  - For each model with a reference offer, append `[date, in, out]` only if it differs from the last point by more than 1e-9, or if there are no points yet. Do the same for subscriptions, using `priceUsdMonthly`.
  - `firstSeen` is set once and never changed. Running the same snapshot twice on the same date is idempotent.
  - Models that disappeared stay in the history unchanged.
- `updateHistoryIndex(index | undefined, year, now)`.
- `priceAt(points, date)`: helper returning the point in effect at a date.

### 3. `scripts/update-history.ts` → `npm run data:history`
Reads `public/data/snapshot.json`, `public/data/history/index.json` and `public/data/history/<year>.json` (year and date from `snapshot.generatedAt`, UTC). On the first day of a new year it also reads the previous year's file for carry-over. It writes the year file (minified) and the index (pretty). Use injectable deps like `runFetchData` so it can be unit-tested.

### 4. `.github/workflows/refresh-data.yml`
- Triggers: `schedule: cron '23 4 * * *'` (daily 04:23 UTC) and `workflow_dispatch`.
- Top-level permissions: `contents: write`, `pages: write`, `id-token: write`. Concurrency group `refresh-data`.
- Job `refresh` (outputs `changed` and `sha`):
  1. checkout (default branch), setup-node from `.nvmrc` with npm cache, `npm ci`
  2. `npm run data:fetch` with `env: AA_API_KEY: ${{ secrets.AA_API_KEY }}`
  3. `npm run data:validate`
  4. `npm run data:history`
  5. `npm run test` (sanity check that the new data does not break anything)
  6. If `git status --porcelain public/data` is not empty: configure the git user as `github-actions[bot]` (`41898299+github-actions[bot]@users.noreply.github.com`), commit `chore(data): refresh snapshot YYYY-MM-DD`, push, and set `changed=true` and `sha=$(git rev-parse HEAD)`. Otherwise set `changed=false`.
- Job `deploy`: `needs: refresh`, `if: needs.refresh.outputs.changed == 'true'`, `uses: ./.github/workflows/deploy.yml` with `ref: ${{ needs.refresh.outputs.sha }}`, and the same permissions granted (`contents: read`, `pages: write`, `id-token: write`). This is needed because pushes made with `GITHUB_TOKEN` do not trigger other workflows.
- Add a short comment block at the top of the file explaining both of these points.

### 5. Initial history
Run `npm run data:history` once against the committed snapshot and commit `public/data/history/index.json` and `public/data/history/2026.json`.

### 6. Docs
- `docs/data-pipeline.md`: add a "Daily refresh & history" section (schedule, what gets committed, how to run it manually from the Actions tab, how deploy is chained, why the history stores only changes).
- README: add a "Data refresh" paragraph and a status badge for `refresh-data.yml` (use a `<owner>` placeholder if the owner is unknown).

### 7. Tests
`history.test.ts` (append, dedupe, idempotency, firstSeen, year carry-over, free-only skipped, subscriptions) and `update-history.test.ts` (with fake fs).

## Out of scope
The history UI (a later task), any app code.

## Acceptance criteria
- Workflows are valid. `npm run data:history` is idempotent (a second run changes nothing).
- All rule-5 checks pass.

## PR title
feat(data): daily refresh workflow with chained deploy and price history
````

---

### Task 07 — App shell, routing, i18n, ustawienia, UI primitives

````text
# Task 07 — App shell: routing, layout, i18n (en/pl), settings store, theme and UI primitives

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–06 are merged: scaffold, domain core (`src/domain/*`), curated data, pipeline, a committed `public/data/snapshot.json`, history files and the daily refresh workflow. The app still renders a single "Work in progress" heading.

## Goal
Build the application frame that all feature pages plug into: hash routing with lazy placeholder pages for every planned feature, a responsive layout, i18next with English and Polish, a persisted settings store (currency, theme, active profile, budget, …), dark mode and a small set of accessible UI primitives. Data loading is the next task. Here the pages are placeholders.

## Allowed packages
`react-router` (current major; use `HashRouter` from it), `i18next`, `react-i18next`, `i18next-browser-languagedetector`, `zustand`, `clsx`.

## Requirements

### 1. Routing (`src/app/routes.tsx`, `src/app/App.tsx`)
- `HashRouter`. Routes: `/` redirects to `/advisor`; `/advisor`, `/explorer`, `/budget`, `/subscriptions`, `/compare`, `/history`, `/profiles`, `/sources`; `*` shows a NotFound page with a link home.
- A single route registry array `{ path, navKey, Component }` drives both `<Routes>` and the navigation, in this nav order: Advisor, Explorer, Budget, Subscriptions, Compare, History, Profiles, Sources.
- Each page lives in `src/features/<name>/<Name>Page.tsx` (e.g. `src/features/advisor/AdvisorPage.tsx`) with a default export. Pages are lazy-loaded with `React.lazy` + `Suspense` (fallback: a Skeleton). Each placeholder shows its translated `title`, `subtitle` and `comingSoon` text inside the standard `PageHeader` component (see primitives).
- Scroll to top on route change. Set `document.title` to `"<page title> · Token Price Analyzer"` (translated).

### 2. Layout (`src/components/layout/`)
- `AppLayout`: a "Skip to content" link, a header (app name/logo as an inline SVG coin/token icon, main nav, and settings controls: language EN/PL, currency USD/PLN/EUR, theme system/light/dark), `<main id="main">` with `max-w-7xl` and responsive padding, and a footer (a "Data sources & methodology" link to `/sources`, plus a placeholder line `footer.attribution` that a later task fills in).
- Below the `md` breakpoint the nav collapses into a menu button that opens an accessible disclosure panel (`aria-expanded`, closes on route change and Escape).
- The active nav item is visually highlighted and has `aria-current="page"`.

### 3. i18n (`src/i18n/`)
- `src/i18n/index.ts` initializes i18next with namespaces `common, advisor, explorer, budget, subscriptions, compare, history, profiles, sources`, supported languages `en` and `pl`, fallback `en`. Resources are statically imported JSON files at `src/i18n/locales/{en,pl}/{namespace}.json` (create all 18 files now). The detection order is localStorage key `tpa-lang`, then `navigator`. Keep `<html lang>` in sync.
- `common` holds the nav labels, settings labels, generic words (loading, error, retry, close, copy, …), NotFound and the footer text. Each feature namespace holds at least `title`, `subtitle` and `comingSoon`.
- A unit test `src/i18n/i18n.test.ts` loads every namespace for both languages and asserts that **en and pl have identical key sets** (deep), with no empty strings. This test guards every future task.

### 4. Settings store (`src/state/settings.ts`)
zustand with `persist` (localStorage key `tpa-settings`, `version: 1`, a `migrate` function that returns defaults for unknown versions). Wrap storage access so it never throws (private mode). State and defaults:
- `currency: Currency`: `'PLN'` if the detected language is `pl`, else `'USD'`
- `theme: 'system' | 'light' | 'dark'`: `'system'`
- `activeProfileId: string`: `'chat-heavy'`
- `customProfiles: UsageProfile[]`: `[]`
- `budget: { amount: number; currency: Currency }`: `{ amount: 20, currency: 'USD' }`
- `activeHoursPerDay: number`: `8`
- `vatRatePct: number`: `0`
- `includeFreeModels: boolean`: `true`
- `includeBatchOffers: boolean`: `false`
- `liveRefresh: boolean`: `true`
Add typed setters for each, plus `upsertCustomProfile(profile)`, `deleteCustomProfile(id)` and `resetSettings()`. Export selector hooks. Language is NOT in this store (i18next owns it).

### 5. Theme
Tailwind v4 class-based dark mode (`@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css`). A `useApplyTheme()` hook applies the `dark` class on `<html>` based on the setting and `prefers-color-scheme` (with a change listener). Use a neutral zinc palette with one accent color (indigo). Numbers use `tabular-nums`.

### 6. UI primitives (`src/components/ui/`, barrel `index.ts`)
`Button` (variants primary/secondary/ghost/danger, sizes sm/md), `Card` (+ `CardHeader`, `CardTitle`, `CardContent`), `Badge` (neutral/success/warning/danger/info/accent), `Select` (styled native select with a visible label), `NumberInput` (label, min/max/step, optional suffix/prefix, clamps on blur), `Toggle` (`role="switch"`), `Tabs` (accessible tablist with arrow-key navigation), `Tooltip` (works on hover AND keyboard focus, uses `aria-describedby`), `Stat` (label/value/hint), `PageHeader` (title, subtitle, optional actions slot), `EmptyState`, `ErrorState` (message + retry button), `Skeleton`, `Spinner`. All are keyboard accessible, with visible focus rings and good contrast in both themes. Add tests for `Tabs` keyboard navigation, `Toggle`, `NumberInput` clamping and `Tooltip` focus behavior.

### 7. Tests and e2e
- Update `src/app/App.test.tsx`: renders the layout, nav links exist, navigating to Explorer shows its placeholder title, and switching the language to PL changes the nav labels.
- Update `e2e/smoke.spec.ts`: open `/`, expect a redirect to `#/advisor`, switch to PL, reload, and the language persists.

## Out of scope
Loading snapshot data, any feature logic.

## Acceptance criteria
- All routes render their placeholders in both languages. The layout works at 375 px width without horizontal page scroll.
- The i18n key-parity test passes.
- All rule-5 checks pass.

## PR title
feat(app): app shell with hash routing, i18n (en/pl), settings store and UI primitives
````

---

### Task 08 — Warstwa danych: snapshot, live OpenRouter, URL state

````text
# Task 08 — Data layer: snapshot loading, live OpenRouter refresh, money formatting and URL state

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–07 are merged:
- The domain core, including `parseSnapshot`, `normalizeOpenRouter`, pricing/quality/currency helpers and the fixtures `src/domain/__fixtures__/sample-snapshot.json` and `built-snapshot.json`.
- The committed `public/data/snapshot.json`.
- The app shell with HashRouter, placeholder pages for advisor/explorer/budget/subscriptions/compare/history/profiles/sources, i18n (en/pl, namespaces per feature), the zustand settings store `src/state/settings.ts` (currency, theme, activeProfileId, customProfiles, budget, activeHoursPerDay, vatRatePct, includeFreeModels, includeBatchOffers, liveRefresh) and the UI primitives in `src/components/ui/`.

## Goal
Make real data available to every page through one provider and a handful of hooks, refresh OpenRouter prices live in the browser, show data freshness, and add shareable URL state utilities.

## Allowed packages
`@tanstack/react-query`.

## Requirements

### 1. Pure live-merge (`src/domain/sources/live-merge.ts`)
`mergeLiveModels(snapshotModels: ModelEntry[], liveModels: ModelEntry[]): { models: ModelEntry[]; changedPriceIds: Set<string>; newModelIds: Set<string> }`
- For models present in both: replace all `openrouter*` offers with the live ones and keep the `direct` offers. Keep the snapshot's quality and speed, except when the snapshot quality source is `'none'` or `'openrouter-aa'` and live has scores; then take the live `openrouter-aa` scores and keep the snapshot tier. Record the id in `changedPriceIds` if any input or output price differs.
- Live-only models are appended (their tier stays undefined) and their ids go into `newModelIds`. Snapshot-only models are kept unchanged.
- Add unit tests.

### 2. Query client and snapshot
- `src/data/queryClient.ts`, wired up in `App` with `QueryClientProvider`.
- `src/data/snapshot.ts`: `fetchSnapshot()` loads `import.meta.env.BASE_URL + 'data/snapshot.json'` and validates it with `parseSnapshot`. `useSnapshotQuery()` uses `staleTime: Infinity`.
- `src/data/liveOpenRouter.ts`: `useLiveOpenRouterQuery(enabled)` fetches `https://openrouter.ai/api/v1/models` (CORS is allowed) with a 15 s timeout and `staleTime: 10 min`, then normalizes the result with `normalizeOpenRouter`. Errors must never break the app.

### 3. `AppDataProvider` and `useAppData()` (`src/data/AppData.tsx`)
`useAppData()` returns:
```ts
{
  status: 'loading' | 'error' | 'ready';
  error?: Error;
  retry: () => void;
  snapshot?: Snapshot;
  models: ModelEntry[];            // snapshot merged with live data when available
  subscriptions: SubscriptionPlan[];
  profiles: UsageProfile[];        // presets from the snapshot + settings.customProfiles (a custom profile overrides a preset with the same id)
  fees: ChannelFee[];
  fx: FxRates;
  generatedAt?: string;
  live: { enabled: boolean; status: 'idle' | 'loading' | 'ok' | 'error'; fetchedAt?: string; changedCount: number; newCount: number; newModelIds: Set<string> };
  refreshLive: () => void;
  modelById: Map<string, ModelEntry>;
  planById: Map<string, SubscriptionPlan>;
}
```
Memoize the derived values. Live refresh respects `settings.liveRefresh`.

### 4. Convenience hooks (`src/data/hooks.ts`)
- `useActiveProfile(): UsageProfile`: resolves `settings.activeProfileId` and falls back to the first preset.
- `useMoney()` returns formatters bound to the current currency, i18n language, fx and VAT:
  - `fmt(amountUsd, opts?)`: converts and applies VAT
  - `fmtPerMTok(usdPerMTok)`
  - `fmtTokens(n)`
  - `toUsd(amount, currency)` (removes VAT and converts)
  - `currency`
  - `isVatApplied`
- `useFeeFor(offer): ChannelFee | undefined`: `openrouter*` channels use the `openrouter` fee; `direct` uses the fee for `offer.vendor`.

### 5. App-level states
`App` shows a full-page Skeleton while loading, and an `ErrorState` (translated, with a retry button) when the snapshot fails. Pages render only when `status === 'ready'`.

### 6. Data freshness (`src/components/layout/DataStatus.tsx`)
Shown in the header (compact) and the footer (full):
- "Data snapshot: {date}"
- "Live prices: updated {relative time} · {n} price changes · {m} new models", or "Live prices unavailable, using the snapshot"
- A warning badge if the snapshot is older than 3 days
- A "Refresh live prices" button
Add a settings toggle for `liveRefresh` (in the header settings controls) and a VAT control: Select with 0% / 23% (PL) / 19% (DE) / 20% (FR) / custom NumberInput.

### 7. Shared `ProfileSelect` (`src/components/ProfileSelect.tsx`)
A labeled Select listing `useAppData().profiles` (presets first, then custom ones marked "custom"). It reads and writes `settings.activeProfileId`, and has an optional `onChange`. The next feature tasks will use it.

### 8. URL state (`src/state/urlState.ts`)
`useUrlState<T>(key: string, codec: Codec<T>, defaultValue: T): [T, (value: T) => void]` built on react-router `useSearchParams` (it works inside HashRouter). It uses `replace` navigation, removes the param when the value equals the default, and leaves other params untouched. Export codecs: `stringCodec`, `numberCodec({ min?, max? })`, `booleanCodec`, `enumCodec(values)` and `listCodec(itemCodec)` (comma-separated, URL-safe). Invalid values fall back to the default. Also export `buildShareUrl(): string`, which returns `window.location.href` with the current hash and query. Add tests with a MemoryRouter.

### 9. Wire the placeholders
- The Advisor placeholder shows "Loaded {models} models and {plans} subscription plans" (translated, with plural rules for PL).
- The Sources placeholder lists `snapshot.sources` (id, ok/failed/skipped badge, fetchedAt).
This proves the wiring works.

### 10. Tests
- `AppData.test.tsx`: mock `fetch` to serve `built-snapshot.json`, and for OpenRouter one of the raw fixtures from `scripts/__fixtures__/openrouter-models.json`. Cover ready state, live merge counts, live failure → still ready with `live.status === 'error'`, and a snapshot failure → error state.
- `hooks.test.tsx` for `useMoney` (PLN conversion + 23% VAT) and `useActiveProfile` fallback.

## Out of scope
Feature pages (beyond the two placeholder wirings above).

## Acceptance criteria
- The app loads the committed snapshot locally (`npm run dev`) and in `npm run build && npm run preview`.
- The live refresh works in a real browser, and the app still works when it fails.
- All rule-5 checks pass. The i18n key-parity test passes.

## PR title
feat(data): snapshot provider, live OpenRouter refresh, money formatting and URL state
````

---

### Task 09 — Explorer: tabela modeli i mapa koszt/jakość

````text
# Task 09 — Model Explorer: price & quality table and cost–quality map

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–08 are merged:
- `useAppData()` (models merged with live data, profiles, fx, fees, `live.newModelIds`), `useActiveProfile()`, `useMoney()`, `ProfileSelect`, `useUrlState` + codecs, `buildShareUrl`.
- The settings store (includeFreeModels, includeBatchOffers, budget, …), UI primitives, i18n namespaces (`explorer` exists with placeholder keys).
- Domain helpers: `costPerTask`, `effectivePerMTok`, `selectOffer`, `monthlyCost`, `tasksForBudget`, `qualityScore`, `paretoFrontier`, `meetsMinTier`, `formatTokens`.
- `src/features/explorer/ExplorerPage.tsx` is a placeholder.
Other tasks (profiles, budget) may run in parallel. Only touch `src/features/explorer/`, the `explorer` i18n namespace files, and (if truly needed) add exports to `src/components/ui/`.

## Goal
Build the main data exploration page: every model with its API prices, the effective cost for the user's usage profile, quality, value, and a Pareto "best deals" marker, as a sortable/filterable table and a cost–quality scatter map.

## Allowed packages
`@tanstack/react-table`, `recharts`.

## Requirements

### 1. Pure row builder (`src/features/explorer/explorerRows.ts`)
`buildExplorerRows(models, profile, settings, budgetUsd): ExplorerRow[]`. Per model:
- `offer` = `selectOffer(model, task, { includeFree, includeBatch: includeBatchOffers && profile.allowBatch })`. Skip models without an eligible offer.
- `inputPerMTok`, `outputPerMTok`, `cacheReadPerMTok` (from the offer); `effectivePerMTok`; `costPerTask`; `monthlyCost` for the profile; `tasksForBudget`.
- `quality` = `qualityScore(model, profile.qualityDimension)`; `tier`; `qualityPerDollar`.
- `isPareto`: computed across all rows using cost = costPerTask and quality.
- Flags: `isFree`, `openWeights`, `isNew` (in `live.newModelIds`), `hasDirect`, `channelsAvailable`.
- `contextLength`, `speed`.
Add unit tests: offer selection under the free/batch flags, Pareto marking, and skipping models without offers.

### 2. Page layout (`/explorer`)
- `PageHeader` with the title, subtitle, a "Copy link" button (uses `buildShareUrl`; shows a "Copied!" state) and a view switch `Tabs`: **Table | Cost–quality map**.
- A controls row: `ProfileSelect` (with a link "Edit profiles" → `#/profiles`), free/batch toggles bound to the settings, search input, provider multi-select (a popover with checkboxes + "all/none"), min tier Select (Any/S/A/B/C/D), max effective price NumberInput (in the user's currency), capability chips (tools, reasoning, image input, open weights), "Only best deals (Pareto)" toggle, "Hide models without quality data" toggle, and a "Reset filters" button.
- URL state (shareable) for: `q`, `providers` (list), `tier`, `maxPrice`, `caps` (list), `pareto`, `hideNoQ`, `sort`, `dir`, `view`, `page`.
- A summary line: "{n} of {total} models · profile: {name} · prices in {currency}{, incl. VAT x%}".

### 3. Table (TanStack Table)
- Columns: Model (name, provider name, badges: Free / Open weights / New / Batch), Input /1M, Output /1M, Cache read /1M, Effective /1M (for the profile, with a tooltip explaining the formula), Cost per task, Monthly cost (profile demand), Quality (score + tier Badge; the header tooltip says the scores are from Artificial Analysis and names the dimension), Value (★ for Pareto + quality per dollar), Context, Speed (tok/s), Channel (the offer used, with a tooltip listing every offer).
- All money is shown via `useMoney`. Unknown values show "—".
- Sortable numeric columns. Default sort: Pareto first, then quality descending. Pagination with 50 rows per page and page controls.
- Sticky header and first column; the table scrolls horizontally inside its container. Below `md`, show a card list instead of the table (same data, the key fields only).
- Clicking a row (or pressing Enter on a focused row) opens a details drawer (a right-side panel; full screen on mobile, focus-trapped, closes on Escape) showing: description, all offers in a small table (channel, vendor, in/out/cache prices, long-context pricing), quality per dimension with source, speed, context and max output, a link "View on OpenRouter" (`https://openrouter.ai/<id>`), and a link "Add to compare" to `#/compare?items=m:<id>`.

### 4. Cost–quality map (Recharts ScatterChart)
- X axis: cost per task on a log scale (user currency). Y axis: quality score. One dot per filtered row that has a quality score.
- Pareto points are highlighted and connected by a line (the frontier). Other points are muted. Dot color is by tier.
- The tooltip shows name, provider, cost per task, monthly cost and quality. Clicking a dot opens the same details drawer.
- An accessible fallback: below the chart, a collapsible "Pareto-optimal models" list. The chart container gets an `aria-label` describing what it shows.

### 5. i18n
All new strings go into `explorer.json` (en + pl), using i18next pluralization where counts appear.

### 6. Tests
- `explorerRows.test.ts`.
- `ExplorerPage.test.tsx` using `built-snapshot.json` (render inside the providers with fetch mocked): rows render; searching filters rows; "Only best deals" reduces rows; sorting by input price changes the first row; the drawer opens on row click.

## Out of scope
The compare page itself, profile editing, budget page.

## Acceptance criteria
- Smooth with ~500 models (memoize row building; no sluggish typing in search).
- Works in both languages and all three currencies.
- All rule-5 checks pass.

## PR title
feat(explorer): model price and quality explorer with cost–quality map
````

---

### Task 10 — Profile użycia i kalkulator zadań

````text
# Task 10 — Usage profiles editor and task calculator

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–08 are merged:
- `useAppData()` (profiles = presets from snapshot + `settings.customProfiles`), `useActiveProfile()`, `useMoney()`, the shared `ProfileSelect`, `useUrlState`.
- Settings store actions `upsertCustomProfile`, `deleteCustomProfile`, `setActiveProfileId`.
- The domain schema `UsageProfileSchema`; helpers `taskFromProfile`, `monthlyTasks`, `costPerTask`, `monthlyCost`, `selectOffer`, `paretoFrontier`, `qualityScore`.
- `src/features/profiles/ProfilesPage.tsx` is a placeholder.
Other tasks (explorer, budget) may run in parallel. Only touch `src/features/profiles/`, the `profiles` i18n namespace and (if truly needed) small additions to `src/components/ui/`.

## Goal
Let users understand, tune and create the usage profiles that drive every cost number in the app ("what one task means for me"), with an instant cost preview and a way to share a profile by link.

## Allowed packages
None.

## Requirements

### 1. Page `/profiles`
- `PageHeader` with the title and subtitle explaining that every cost in the app is computed from the active profile.
- A left column lists the profiles in two groups: **Presets** (read-only) and **My profiles**. Each item shows the name, a one-line summary ("80k in / 2.5k out · 90% cached · 250×/day"), an "Active" badge, and actions: Set active, Duplicate & edit (presets), Edit/Delete (custom; delete asks for confirmation in a small inline dialog).
- A right column holds the editor for the selected profile: name (one text field; it is stored as both `en` and `pl` for custom profiles), input tokens per task, output tokens per task, cached input share (a range slider 0–100% with a numeric value), tasks per day, work days per month, quality dimension (intelligence/coding/agentic, each with a short explanation), and allow batch. Validate with `UsageProfileSchema` and show inline errors. Save creates or updates a custom profile with id `custom-<slugified-name>` (add `-2`, `-3`, … on collisions) and makes it active. Cancel discards the changes.
- The live preview card updates as you type:
  - monthly tasks and monthly tokens (input/output)
  - the cost per task and monthly cost for three reference models: **Best quality** (highest quality for the dimension), **Best value** (the cheapest model on the Pareto frontier with tier ≥ B), and **Cheapest paid** (lowest cost per task with a non-free offer). Respect the free/batch settings.
  - a note when the monthly cost of the best-quality model exceeds the user's budget (`settings.budget`).
- A "Token estimator" helper (a collapsible section): two textareas, "Typical prompt/context" and "Typical response". It estimates tokens as `Math.ceil(chars / 4)`, clearly labelled as a rough approximation, with a button "Use these numbers" that fills input/output tokens in the editor.

### 2. Sharing profiles
- A "Share profile" button produces `#/profiles?import=<base64url(JSON of the profile without isPreset)>` and copies it to the clipboard.
- On load, if `import` is present: decode it, validate it with zod (errors → a friendly ErrorState), and show a confirmation card "Import profile '{name}'?" with Import / Dismiss. Import saves it as a custom profile and removes the param.
- Put the encode/decode helpers in `src/features/profiles/profileShare.ts` and unit-test them, including unicode names and invalid input.

### 3. Pure helpers (`src/features/profiles/profilePreview.ts`)
`referenceModels(models, profile, settings)` and `profileSummary(profile)`, with unit tests.

### 4. i18n
All strings go into `profiles.json` (en + pl), with pluralization where needed.

### 5. Tests
Page test: duplicate a preset, edit it, save → it appears under "My profiles" and becomes active; validation error for 0 output tokens; importing via URL works.

## Out of scope
Changing other pages (they already read the active profile through the hooks).

## Acceptance criteria
- Custom profiles persist across reloads and appear in `ProfileSelect` everywhere.
- All rule-5 checks pass. The i18n key-parity test passes.

## PR title
feat(profiles): usage profile editor, cost preview and shareable profiles
````

---

### Task 11 — Budżet: „za ile model może pracować”

````text
# Task 11 — Budget reach: "how long can each model work for my money"

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–08 are merged:
- `useAppData()`, `useActiveProfile()`, `useMoney()` (`fmt`, `toUsd`, …), `useFeeFor(offer)`, `ProfileSelect`, `useUrlState` + codecs, `buildShareUrl`.
- The settings store (`budget {amount, currency}`, includeFreeModels, includeBatchOffers, vatRatePct, …), UI primitives, i18n `budget` namespace (placeholder keys).
- Domain helpers: `selectOffer`, `costPerTask`, `tasksForBudget`, `workDaysForBudget`, `tokensForBudget`, `usableCredit`, `generationSecondsPerTask`, `monthlyTasks`, `qualityScore`, `meetsMinTier`, `paretoFrontier`.
- `src/features/budget/BudgetPage.tsx` is a placeholder.
Other tasks (explorer, profiles) may run in parallel. Only touch `src/features/budget/`, the `budget` i18n namespace, and small additions to `src/components/ui/` if truly needed.

## Goal
Answer "If I put my budget into the API, how much work does each model give me?" in units people understand (tasks, days of work, share of the month), with a comparative log scale. Account for top-up fees and minimum top-ups.

## Allowed packages
`recharts` (may already be installed by a parallel task; if `package.json` already lists it, do not change the version).

## Requirements

### 1. Pure helper (`src/features/budget/budgetRows.ts`)
`buildBudgetRows({ models, profile, budgetUsd, fees, includeFree, includeBatch, applyFees }): BudgetRow[]`. Per model with an eligible offer:
- `credit` = `applyFees ? usableCredit(budgetUsd, feeFor(offer)) : budgetUsd` (an `openrouter*` channel uses the `openrouter` fee; `direct` uses the vendor's fee).
- `belowMinTopUp` flag when the credit is 0 because of the minimum top-up.
- `tasks`, `workDays`, `coverageOfMonth` = `min(1, tasks / monthlyTasks(profile))`, `tokens` (input/output), `generationHours` = `tasks × generationSecondsPerTask / 3600` (null if the speed is unknown), `quality`, `tier`, `isPareto` (cost per task vs quality), `isFree`.
- Free offers: tasks and days are `Infinity`, flagged `rateLimited: true` (OpenRouter free models are rate-limited).
Also export `pickHighlights(rows, minTier)` → `{ bestQualityFullMonth, cheapestAcceptable, bestValue }`:
- `bestQualityFullMonth`: the highest quality with `coverageOfMonth === 1`
- `cheapestAcceptable`: the most work days among tier ≥ minTier
- `bestValue`: the Pareto row with tier ≥ minTier that has the highest `coverageOfMonth`, ties going to the higher quality
Any of these may be undefined. Unit-test it thoroughly.

### 2. Page `/budget`
- `PageHeader` with a "Copy link" button.
- Controls: budget amount NumberInput + currency Select (bound to `settings.budget`; values are converted with `toUsd`), `ProfileSelect`, min tier Select (default B), toggles "Include free models" / "Include batch prices" (settings), "Account for top-up fees" (default on), a metric switch `Tabs`: **Days of work | Tasks | Tokens**.
- URL state: `amount`, `cur`, `tier`, `metric`, `fees`.
- **Highlight cards** (3 `Stat`-like cards) from `pickHighlights`, each with the model name, tier badge, the main number in the selected metric, and a one-sentence explanation (i18n with interpolation), e.g. "Lasts the whole month (≈ {days} work days of demand) at quality tier {tier}."
- **Work-time ladder** (the "comparative scale"): a horizontal log-scale axis with tick labels 1 hour, 1 day, 1 week, 1 month, 1 year, ∞ (free), and the top 20 models (tier ≥ min) placed as labeled markers by `workDays`. One work day = `profile.tasksPerDay` tasks. Overlapping labels are stacked vertically. It must be readable on mobile (it switches to a vertical ladder below `md`). Build it with plain SVG/CSS or Recharts, whichever is cleaner, plus an accessible list alternative.
- **Bar chart** (Recharts, horizontal bars): the top 15 models by the selected metric, colored by tier, with the budget value and fee shown in the tooltip, and a reference line at "full month of your demand" for the days metric.
- **Full table** below: model, channel, usable credit after fees, tasks, work days, % of monthly demand, tokens, generation hours, quality/tier. Sortable by clicking headers (a simple `useState` sort, no table library required). Rows with `belowMinTopUp` show a warning badge "Budget below minimum top-up (${min})".
- A callout at the bottom: "There are {n} subscription plans within this budget → compare them in Subscriptions vs API" (count the plans with `priceUsdMonthly` ≤ budget), linking to `#/subscriptions`.

### 3. i18n
Everything goes into `budget.json` (en + pl), with PL plural forms for days/tasks.

### 4. Tests
`budgetRows.test.ts` (fees, minimum top-up, free rows, highlights) and `BudgetPage.test.tsx` (changing the budget changes the highlight numbers; the metric switch works; the fee toggle changes usable credit).

## Out of scope
Subscriptions logic (a later task), the compare page.

## Acceptance criteria
- With the committed snapshot, the default $20 budget and the `coding-agent` profile, the page shows sensible, non-empty highlights.
- All rule-5 checks pass. The i18n key-parity test passes.

## PR title
feat(budget): budget reach calculator with work-time ladder and fee-aware credit
````

---

### Task 12 — Subskrypcje vs API + break-even

````text
# Task 12 — Subscriptions vs API: capacity model, value leverage and break-even chart

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–11 are merged: the domain core, curated subscription plans in the snapshot (`SubscriptionPlan` with `limit` kinds window/monthly/usd-credit/unknown, `referenceUnit`, `unitLabel`, `confidence`, `lastVerified`, `localPrices`, `features`, `primaryModelId`, `includedModelIds`), the data layer hooks (`useAppData`, `useActiveProfile`, `useMoney`, `ProfileSelect`, `useUrlState`, `buildShareUrl`), Explorer (`/explorer`, with a details drawer), Profiles (`/profiles`), Budget (`/budget`). `src/features/subscriptions/SubscriptionsPage.tsx` is a placeholder. `recharts` is installed.

## Goal
Make the core "$20 dilemma" concrete: for the user's profile and working hours, estimate how many of THEIR tasks each subscription can handle, what that usage would cost on the API, how many times the money is "multiplied" (leverage), and where the break-even point lies, with honest uncertainty ranges and confidence labels.

## Allowed packages
None.

## Requirements

### 1. Domain (`src/domain/subscriptions.ts`, pure, fully unit-tested)
- `windowsPerDay(windowHours, activeHoursPerDay)` = `clamp(ceil(activeHours / windowHours), 1, floor(24 / windowHours))`.
- `monthlyUnits(plan, ctx: { activeHoursPerDay; workDaysPerMonth }): Range | null`
  - `window`: `unitsPerWindow × windowsPerDay × workDays`; if `weeklyUnitsCap` is set, cap each end at `weeklyUnitsCap × 4.345`.
  - `monthly`: `unitsPerMonth`.
  - `usd-credit` and `unknown`: `null`.
- `apiEquivalentUsd(plan, primaryOffer | undefined, ctx): Range | null`
  - `usd-credit` → `point(usdPerMonth)`.
  - Otherwise `monthlyUnits × costPerTask(plan.referenceUnit, primaryOffer)` (null if the units or the offer are missing).
- `capacityTasks(plan, profile, primaryOffer, ctx): Range | null` = `apiEquivalentUsd / costPerTask(taskFromProfile(profile), primaryOffer)`, floored.
- `coverage(capacity: Range | null, demandTasks): Range | null`: each end is `min(1, x / demand)`.
- `leverage(apiEquivalent: Range | null, priceUsd): Range | null` = `apiEquivalent / price`.
- `breakEvenTasks(priceUsd, costPerTaskUsd)` = `price / costPerTask` (Infinity when the cost is 0).
- `planPrice(plan, currency, fx, vatRatePct): { amount: number; isLocalList: boolean }`: use `localPrices[currency]` when present (already gross, so VAT is NOT added again), otherwise `convertFromUsd` + `applyVat`.
- `limitSummary(plan)`: structured data for i18n `{ key, params }`, e.g. `{ key: 'limit.window', params: { low, high, hours, unit } }`, `{ key: 'limit.weekly', … }`, `{ key: 'limit.monthly', … }`, `{ key: 'limit.usdCredit', … }`, `{ key: 'limit.unknown' }`.
- `compareVerdict({ plan, planCoverage, planPriceUsd, apiOffer, apiModel, demandTasks, profile })` → `{ winner: 'subscription' | 'api' | 'tie' | 'unknown'; apiMonthlyCostUsd; savingsUsd: Range | null; reasonKey; params }`. The subscription wins when its low coverage is ≥ 0.9 and its price is below the API monthly cost for the same demand, or when the API cost for the covered share exceeds the price. `unknown` when the plan's capacity is null. Document the rule in a comment.

### 2. Page `/subscriptions`
- `PageHeader` with a "Copy link" button.
- Controls: `ProfileSelect`, active hours per day (NumberInput bound to `settings.activeHoursPerDay`), max price filter (NumberInput, in the user's currency), provider filter (chips), toggles "Only plans with a coding agent" and "Only plans with published limits".
- URL state: `maxPrice`, `providers`, `agent`, `published`, `selected` (list of up to 3 plan ids for the chart), `hours`.
- **"Your demand" bar**: "{tasks}/month of '{profile}' ≈ {apiCost}/month on {cheapest Pareto tier≥B model} or {apiCostBest}/month on {best quality model}".
- **Plan cards**, grouped in price bands: Budget (< $15), ~$20 ($15–$40), Power ($40–$120), Max (> $120). Each card shows:
  - provider + plan name, price (`planPrice`, with "≈" when converted and "list price" when local), annual equivalent if present
  - a confidence badge (official = success, reported = warning, estimated = neutral) + "verified {date}" (a warning badge if older than 45 days)
  - feature chips (coding agents by name, image generation, deep research, API access, long context)
  - included models: up to 4 names with tier badges (a "not in current data" muted label for unknown ids)
  - limits in words (`limitSummary` → i18n) with the unit label
  - **Capacity**: "{low}–{high} of your tasks per month" and a coverage bar (low–high band) against your demand. For `unknown`: "Limits not published: capacity cannot be estimated" with a neutral bar.
  - **Value**: "≈ {apiEqLow}–{apiEqHigh} of API usage → {levLow}–{levHigh}× your money" (hidden when null).
  - a **Same money on API** line: tasks the plan price buys on the API with the plan's primary model, and with the best-value model.
  - plan notes (localized), source links, "Select for chart" checkbox, "Add to compare" link (`#/compare?items=s:<id>`).
  - If the primary model is missing from the data: a warning, and no value numbers.
- **Break-even chart** (Recharts LineChart), for the selected plans (default: the 3 best-coverage plans ≤ $25):
  - X axis: tasks per month from 0 to `max(3 × demand, max high capacity)`. Y axis: monthly cost in the user's currency.
  - Each plan is a flat line at its price, solid up to its low capacity, dashed between low and high capacity, and ends there (beyond it "limit reached").
  - API lines: the plan primary models and the best-value model (`tasks × costPerTask`).
  - A vertical reference line at the user's demand, a legend, and a tooltip with exact values.
  - An accessible summary table under the chart (collapsible): the break-even task count per plan vs each API line.
- **Verdict box** at the top for the best covered plan ≤ budget vs the best API option, built with `compareVerdict` → an i18n sentence, plus a link to the Advisor for a full recommendation.
- **Disclaimer** (always visible, small): limits are estimates from public statements and community reports; they change often; see Sources for methodology.

### 3. i18n
All strings go into `subscriptions.json` (en + pl), with plural forms and number interpolation.

### 4. Tests
- `subscriptions.test.ts`: every function, with every limit kind, the weekly cap, windows-per-day clamping, local price vs conversion + VAT, and the verdict branches.
- `SubscriptionsPage.test.tsx`: cards render; the unknown-limit card shows the not-estimable state; changing active hours changes the capacity of a window plan; selecting a plan adds a line to the chart (assert via the summary table).

## Out of scope
The advisor engine (next task), the compare page.

## Acceptance criteria
- With the committed snapshot and profile `coding-agent` at 8 h/day, Claude/ChatGPT/GLM plans show capacity ranges, and Google plans show the "not estimable" state.
- All rule-5 checks pass. The i18n key-parity test passes.

## PR title
feat(subscriptions): subscription vs API comparison with capacity model and break-even chart
````

---

### Task 13 — Advisor: silnik rekomendacji i kreator

````text
# Task 13 — Advisor: recommendation engine and wizard (home page)

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–12 are merged:
- Domain: pricing (`costPerTask`, `selectOffer`, `usableCredit`, `monthlyTasks`, …), quality (`qualityScore`, `assignTiers`, `tierWeight`, `meetsMinTier`, `paretoFrontier`), currency, range, and `src/domain/subscriptions.ts` (`monthlyUnits`, `apiEquivalentUsd`, `capacityTasks`, `coverage`, `leverage`, `planPrice`, `compareVerdict`).
- Data hooks: `useAppData`, `useActiveProfile`, `useMoney`, `useFeeFor`, `ProfileSelect`, `useUrlState`, `buildShareUrl`.
- Pages: Explorer, Profiles, Budget, Subscriptions. `src/features/advisor/AdvisorPage.tsx` is still the placeholder showing loaded counts.
Other tasks (history UI, sources page) may run in parallel. Only touch `src/domain/advisor/`, `src/features/advisor/` and the `advisor` i18n namespace.

## Goal
The home page answers the user's actual question in one place: "With {budget} and my way of using AI, what should I buy this month?". It ranks complete strategies (API only, one subscription, subscription + API top-up, two subscriptions) with transparent reasons and caveats.

## Allowed packages
None.

## Requirements

### 1. Engine (`src/domain/advisor/`, pure, deterministic, fully tested)
`advise(input: AdvisorInput, data: { models; plans; fees }): Recommendation[]`

```ts
type Needs = { codingAgent: boolean; imageGeneration: boolean; deepResearch: boolean; longContext: boolean; openWeights: boolean; toolCalling: boolean };
type AdvisorInput = {
  budgetUsd: number;            // net list-price budget in USD
  profile: UsageProfile;
  intensity: number;            // multiplier on tasksPerDay, 0.25–4
  activeHoursPerDay: number;
  needs: Needs;
  minTier: QualityTier | 'any';
  includeFree: boolean;
  preferFlexibility: boolean;   // small bonus for pay-as-you-go
};
type Strategy = 'api' | 'subscription' | 'subscription+api' | 'two-subscriptions';
type Reason = { code: string; params?: Record<string, string | number> };
type Recommendation = {
  id: string; strategy: Strategy; planIds: string[]; modelIds: string[];
  monthlyCostUsd: number; coverage: Range | null; quality: number | undefined; tier: QualityTier | undefined;
  score: number;                // 0–100
  reasons: Reason[]; warnings: Reason[];
};
```

Rules:
- Demand = `profile.tasksPerDay × intensity × workDaysPerMonth` tasks of `taskFromProfile(profile)`.
- **Eligibility (needs):**
  - API models: `codingAgent` ⇒ `capabilities.tools` (any agentic CLI can use an API key); `toolCalling` ⇒ `tools`; `longContext` ⇒ `contextLength ≥ 500000`; `openWeights` ⇒ `openWeights === true`; `imageGeneration` ⇒ `outputModalities` includes `image`; `deepResearch` is never satisfied by the bare API (add a warning instead of excluding when it is the only unmet need).
  - Plans: `features.codingAgents.length > 0`, `features.imageGeneration`, `features.deepResearch`, `longContextTokens ≥ 500000` or the primary model's context ≥ 500000, `openWeights` ⇒ the primary model is open weights.
  - The `minTier` filter applies to the main model's tier.
- **Candidates:**
  1. `api`: for each eligible model, the best offer (respecting `includeFree` and `profile.allowBatch`); credit = `usableCredit(min(budget, demandCost), fee)`; coverage = `point(min(1, credit / demandCost))`; monthlyCostUsd = `min(budget, demandCost + fee)`. Keep the top 10 by `quality × coverage` before final scoring.
  2. `subscription`: plans with `priceUsdMonthly ≤ budget`; coverage from `coverage(capacityTasks(...))` (null when unknown).
  3. `subscription+api`: for each subscription candidate with leftover = `budget − price ≥ max(5, minTopUp)`, pick the best API model for the uncovered demand (`demand × (1 − coverage.low)`). The combined coverage low = `min(1, planLow + apiShare)`, and the high end is computed the same way.
  4. `two-subscriptions`: pairs of plans from DIFFERENT providers with a total price ≤ budget; capacities add up (separate rate-limit pools). Consider only the top 6 single plans by coverage to bound the search.
- **Score:**
  - `qualityNorm` = `quality / maxQualityAmongEligibleApiModels` (for the profile's dimension). Missing quality → `tierWeight(tier)`.
  - For combos, use the coverage-weighted quality of their parts.
  - `coverageScore` = `coverage.low`, or `0.6` with the warning `limits-unpublished` when null.
  - `confidenceFactor`: api 1.0, official 1.0, reported 0.95, estimated 0.9 (for combos, the minimum of the parts).
  - `score = 100 × qualityNorm^1.5 × coverageScore^0.8 × confidenceFactor × (preferFlexibility && strategy === 'api' ? 1.05 : 1)`, clamped to [0, 100] and rounded to 1 decimal.
  - Tie-break by lower `monthlyCostUsd`, then by id.
- **Diversity of the output:** return at most 7, with at most 3 per strategy and at most 2 per provider for the main item. Always include the best `api` and the best `subscription` candidate if they exist, even when outside the top 7 (put them last).
- **Reasons** (codes the UI translates): `covers-demand {pct}`, `partial-coverage {pct}`, `best-quality-in-budget`, `best-value`, `includes-coding-agent {agents}`, `leftover-budget {usd}`, `separate-limit-pools`, `free-rate-limited`, `top-up-fee {usd}`, `limits-unpublished`, `estimate-low-confidence`, `deep-research-not-in-api`, `min-top-up-not-met {usd}`, `cheaper-than-api {usd}`.
- **Edge cases:** budget 0 → only free API options (or an empty array if `includeFree` is false); no eligible items → an empty array.

Tests must include these scenarios, using `built-snapshot.json` loaded via `parseSnapshot`:
(a) $20 + `coding-agent` → contains both an `api` and a `subscription` recommendation, sorted by score, and stable across runs;
(b) $20 + `chat-light` → coverage 1 for the top results;
(c) $0 + includeFree → only free models;
(d) the `openWeights` need → no closed-weight models or plans;
(e) $40 → at least one `two-subscriptions` or `subscription+api` candidate is evaluated (assert via an exported internal `generateCandidates`).

### 2. Page `/advisor` (home)
- Hero `PageHeader`: "What should I buy this month?" / "Co kupić w tym miesiącu?" with a short explanation.
- The wizard is a single page with 5 numbered step cards, all visible on desktop and stacked on mobile:
  1. **Budget**: amount + currency (defaults from settings; changing it updates `settings.budget`).
  2. **What do you do?**: preset profile buttons with simple inline SVG icons and short descriptions, plus a "Custom…" link to `#/profiles` (ProfileSelect for custom profiles).
  3. **How much?**: an intensity slider 0.25×–4× showing the resulting "≈ {tasks} tasks/month", and active hours per day.
  4. **Must-haves**: needs checkboxes with help tooltips.
  5. **Minimum quality**: tier segmented control (Any/D/C/B/A/S) with a tooltip explaining the tiers, and toggles "Include free models" and "Prefer pay-as-you-go".
- Results update live (debounced 200 ms):
  - The **top pick** is a large card: strategy badge, items (plan and/or model names linking to their pages), monthly cost (via `useMoney`), coverage band bar, tier, score, 2–4 reason sentences, warnings as small warning badges.
  - The remaining recommendations are a compact list with the same data.
  - Each card has the links "See in Subscriptions" / "See in Explorer" and "Compare" (`#/compare?items=s:<id>,m:<id>`).
- All wizard inputs are mirrored in the URL (`b`, `cur`, `p`, `i`, `h`, `needs` list, `tier`, `free`, `flex`), with a "Copy link to these results" button.
- Empty state when there are no results, with suggestions (raise the budget, lower the min tier, drop a need).
- Footer note: "Estimates, not financial advice. See methodology."

### 3. i18n
`advisor.json` (en + pl): all labels, a sentence template for every reason code, strategy names, plurals.

### 4. Tests
The engine tests above, plus a page test: set the budget to 20 and choose the coding-agent profile → a top pick card is rendered with a strategy badge and the URL contains `b=20`.

## Out of scope
The compare page implementation (only the links), changes to other pages.

## Acceptance criteria
- The engine is deterministic and covered (≥ 90% lines in `src/domain/advisor/`).
- The page is usable on mobile, in both languages.
- All rule-5 checks pass. The i18n key-parity test passes.

## PR title
feat(advisor): recommendation engine and advisor wizard on the home page
````

---

### Task 14 — Compare 1:1 + linki do udostępnienia

````text
# Task 14 — Compare page and shareable links across the app

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–13 are merged: Explorer, Profiles, Budget, Subscriptions, Advisor. Several pages already link to `#/compare?items=m:<modelId>` / `s:<planId>` and some have their own ad-hoc "Copy link" buttons. Available: `useAppData`, `useActiveProfile`, `useMoney`, `useUrlState` + `listCodec`, `buildShareUrl`, domain pricing/quality/subscriptions helpers. `src/features/compare/ComparePage.tsx` is a placeholder. `recharts` is installed.

## Goal
Show 2–4 models and/or subscription plans side by side for the user's profile, highlight the winner per metric, and make every main view shareable with one consistent "Copy link" button.

## Allowed packages
None.

## Requirements

### 1. Compare items helpers (`src/features/compare/compareItems.ts`, pure + tests)
- `parseItems(param: string[]): CompareRef[]`, where `CompareRef = { kind: 'model' | 'plan'; id: string }`, from the `m:<id>` / `s:<id>` tokens (ids may contain `/` and `.`). Deduplicate and cap at 4.
- `serializeItems(refs)`.
- `buildCompareHref(existingRefs, add: CompareRef)`: appends unless it is already present or the list is full (then it replaces the last item).
- `buildCompareRows(refs, data, profile, settings)`: one column per item and rows:
  - type
  - provider
  - list price (model: input/output/cache per 1M; plan: monthly price)
  - cost per task (plan: price / capacity low–high, or —)
  - monthly cost for your demand (model: demand cost; plan: price)
  - capacity / coverage
  - quality (intelligence / coding / agentic) and tier
  - context window
  - speed
  - features (coding agent, image generation, deep research, tools, open weights)
  - data confidence and source
  - last updated (snapshot date or plan `lastVerified`)
  Each numeric row declares `better: 'higher' | 'lower'`, so the UI can mark the best and worst cells.

### 2. Page `/compare`
- A picker: a combobox (input + listbox, keyboard accessible, ARIA combobox pattern) searching models and plans by name/provider, grouped "Models" / "Subscription plans". Selected items are shown as removable chips. Max 4, with an empty state that suggests popular items (the top 2 models by quality + the 2 cheapest ~$20 plans).
- Unknown ids from the URL appear as a muted chip "Not found: {id}" with a remove action.
- A comparison table with sticky first column and header; best cells get a success tint, worst cells a subtle danger tint (only when there are ≥ 2 comparable values); an "—" for not applicable. Below `md` it scrolls horizontally inside its container.
- A chart (Recharts grouped BarChart) of normalized 0–100 metrics per item: quality (profile dimension), coverage (low), value (quality per dollar normalized), speed (normalized; missing → 0, with a note).
- `ProfileSelect` at the top. URL state: `items` (list), `p`.

### 3. Shared `ShareButton` (`src/components/ShareButton.tsx`)
- Copies `buildShareUrl()` using `navigator.clipboard.writeText`, with a fallback (a hidden textarea + `document.execCommand('copy')`). If both fail, it shows the URL in a small popover for manual copying. A "Copied!" state lasts 2 s, and is announced via an `aria-live` polite region.
- Replace the existing ad-hoc copy-link buttons in Explorer, Budget, Subscriptions and Advisor with `ShareButton` (keep their position and labels; move the translations to `common`). Also add it to Compare and Profiles headers.
- Make sure every "Add to compare" link in the app uses `buildCompareHref`, so items are appended to an existing comparison rather than replacing it. Where the current comparison is not known, read it from `localStorage` key `tpa-compare-last`; the Compare page writes this key on change, wrapped in try/catch.

### 4. i18n
`compare.json` and `common.json` additions (en + pl).

### 5. Tests
`compareItems.test.ts` (parsing, dedupe, cap, `buildCompareHref`, row best/worst flags) and `ComparePage.test.tsx` (opening `#/compare?items=m:<id>,s:<id>` renders two columns; adding via the combobox; removing a chip updates the URL). Also a `ShareButton` test with mocked clipboard success and failure.

## Out of scope
New metrics or domain changes beyond what is needed for the rows.

## Acceptance criteria
- Links copied from any page reproduce the same view when opened in a new tab.
- All rule-5 checks pass. The i18n key-parity test passes.

## PR title
feat(compare): side-by-side comparison and consistent shareable links
````

---

### Task 15 — Historia cen i trendy (UI)

````text
# Task 15 — Price history and trends page

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–12 are merged (13/14 may be in progress in parallel). The daily workflow writes `public/data/history/index.json` (`HistoryIndex`) and `public/data/history/<year>.json` (`PriceHistory`: per model `firstSeen` + change-only points `[date, inputPerMTok, outputPerMTok]`, per plan `[date, priceUsdMonthly]`). Schemas live in `src/domain/schemas.ts`, helpers in `src/domain/history.ts` (`referenceOffer`, `appendSnapshotToHistory`, `priceAt`). Data hooks: `useAppData`, `useActiveProfile`, `useMoney`, `useUrlState`, `ProfileSelect`. `src/features/history/HistoryPage.tsx` is a placeholder. `recharts` is installed. Only touch `src/features/history/`, `src/data/` (one new hook file), `src/domain/history-trends.ts` (new) and the `history` i18n namespace.

## Goal
Show how prices move: what got cheaper or more expensive recently, which models are new, and price lines over time, all in the user's currency and usage profile.

## Allowed packages
None.

## Requirements

### 1. Data hook (`src/data/history.ts`)
`useHistory(years?: number[])`: loads `history/index.json`, then the current and previous year files (only when the History page is mounted). Validate with zod and merge them into one structure (concatenate points; keep the earliest `firstSeen`). It must handle missing files (404 → empty history, not an error).

### 2. Pure trends (`src/domain/history-trends.ts` + tests)
- `blendedFromPoint(point, task)`: effective $/1M tokens for the profile shape using input/output only (cache ignored; document this as an approximation).
- `priceChanges(history, { now, days, task, minAbsPct = 1 })`: for each model, compare the price in effect at `now − days` (via `priceAt`) with the latest one, and return `{ modelId, fromUsdPerMTok, toUsdPerMTok, pct, changedOn }[]`, split into `drops` and `increases`, each sorted by |pct| descending.
- `newModels(history, { now, days })`: models whose `firstSeen` is within the period, newest first.
- `planPriceChanges(history, { now, days })`.
- `seriesFor(history, modelIds, task, { from, to })`: step-series points for charts (repeating the last value at `to`).

### 3. Page `/history`
- Controls: period `Tabs` (7 / 30 / 90 / 365 days), `ProfileSelect`, `ShareButton` if it exists in `src/components/ShareButton.tsx` (otherwise skip it; do not create it).
- **What changed** cards: the top 10 price drops and top 10 increases (model name linking to the explorer drawer via `#/explorer?q=<name>`, from → to in the user's currency per 1M, % badge, date).
- **New models in this period**: a list with the date added, current quality tier and current effective price.
- **Subscription price changes**: a list, or "No changes in this period".
- **Price over time** chart: pick up to 5 models (a simple multi-select with search, preselected: the 3 most recently changed popular models, i.e. those with the highest quality among the changed ones), as a Recharts step LineChart of effective $/1M for the profile shape, converted at the CURRENT FX rate (show this as a note). X axis is dates, with a tooltip.
- Empty state when the history has fewer than 2 distinct dates: "History started on {date}. Trends appear after a few daily refreshes."
- URL state: `period`, `models` (list).

### 4. i18n
`history.json` (en + pl).

### 5. Tests
`history-trends.test.ts` (drops/increases split, minAbsPct, new models, step series) and `HistoryPage.test.tsx` with a small synthetic history fixture (`src/features/history/__fixtures__/history-2026.json`): changes render, switching the period updates the lists, and the empty state shows for a single-date history.

## Out of scope
Changes to the workflow or history format.

## Acceptance criteria
- All rule-5 checks pass. The i18n key-parity test passes.

## PR title
feat(history): price history and trends page
````

---

### Task 16 — Źródła, metodologia, atrybucja

````text
# Task 16 — Data sources, methodology, attribution and issue templates

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–12 are merged (13–15 may be in progress in parallel). The snapshot contains `sources` (SourceStatus per source), `diagnostics` (unmatched ids, warnings), subscription plans with `confidence`/`lastVerified`/`sources`, and channel fees. The Sources page is a placeholder that lists the source statuses. The footer has a placeholder line `footer.attribution`. `deploy.yml` builds with `VITE_REPO_URL` set. Only touch `src/features/sources/`, `src/components/layout/` (footer), `src/app/config.ts` (new), the `sources` and `common` i18n namespaces, `docs/methodology.md`, `.github/ISSUE_TEMPLATE/`, and README links.

## Goal
Make the app trustworthy and compliant: show where every number comes from and how fresh it is, explain the methodology in both languages, give the required attribution, and make it easy to report outdated data.

## Allowed packages
None.

## Requirements

### 1. Config (`src/app/config.ts`)
`REPO_URL = import.meta.env.VITE_REPO_URL ?? ''`, plus `newIssueUrl({ template, title, body })` → `${REPO_URL}/issues/new?template=…&title=…&body=…` (URL-encoded), or `null` when `REPO_URL` is empty. Add a unit test.

### 2. Footer attribution (every page)
"Benchmark data: Artificial Analysis (link https://artificialanalysis.ai) · Prices: OpenRouter, LiteLLM · FX: ECB via Frankfurter · Estimates, not financial advice". The links open in a new tab with `rel="noopener noreferrer"`. Translate it.

### 3. Page `/sources`
- **Sources table**: name, what we use it for, status badge (ok / failed / skipped, with the error text in a tooltip), last fetched (relative + absolute), item count, link, license/attribution note. Static descriptions per source id (i18n): openrouter (models, API prices incl. cache & batch, quality indices sourced from Artificial Analysis), litellm (first-party direct API prices, MIT), artificial-analysis (intelligence/coding/agentic indices and speed; attribution required; free API key optional), frankfurter (ECB reference FX rates), curated (subscription plans, usage profiles, channel fees maintained in this repo).
- **Curated data freshness**: a table of subscription plans (provider, plan, price, confidence badge, lastVerified with a "needs verification" warning when older than 45 days, source links), plus channel fees. The "Report outdated data" button per row (and globally) opens `newIssueUrl` with template `outdated-data.yml` and a prefilled title/body (plan id, current values). Hide the button when it returns null.
- **Methodology** (expandable sections, real prose in en AND pl, structured JSX, no `dangerouslySetInnerHTML`):
  1. Cost per task: the formula with cached/uncached/output tokens, cache writes, long-context pricing, effective $/1M.
  2. Usage profiles: what a task is, the presets, how to customize.
  3. Quality: Artificial Analysis indices, dimension per profile, tiers by percentile (S top 5%, A next 15%, B 30%, C 30%, D rest), manual overrides, the Pareto frontier.
  4. Budget reach: usable credit after top-up fees and minimum top-ups, days of work.
  5. Subscriptions: limit kinds, reference units, monthly units × reference cost on the primary model = API-equivalent value, capacity in your tasks, coverage, leverage; why ranges; confidence levels; weekly caps; that limits change often.
  6. Advisor scoring: the formula and the diversity rules, in plain words.
  7. Currency & VAT: ECB rates, local list prices, VAT toggle.
  8. Limitations & disclaimer: estimates, not financial advice, provider terms change, free models are rate-limited, data delays.
- **Diagnostics for maintainers** (collapsed by default): unmatched ids per source (counts + list, filterable), warnings, snapshot schema version and generatedAt, a link to `docs/data-pipeline.md` and `docs/curated-data.md` on GitHub (when `REPO_URL` is set).

### 4. Quality tooltips
Wherever the UI shows a quality score column or label and a tooltip/help already exists, make sure it mentions "Artificial Analysis". Add the tooltip only in `src/features/sources/` if you need a reusable `QualitySourceNote` component; export it, but do NOT edit other feature folders in this task.

### 5. Issue templates (`.github/ISSUE_TEMPLATE/`)
- `outdated-data.yml` (form): item type (subscription plan / model price / channel fee / other), item id, what is wrong, correct value, source URL (required), checked on (date).
- `bug_report.yml`: what happened, expected, steps, page URL (with the share link), browser.
- `config.yml`: `blank_issues_enabled: false`, plus a contact link to the Sources page if known.

### 6. Docs
`docs/methodology.md`: an English mirror of the methodology section. README: link to it, and an "Attribution" section.

### 7. i18n and tests
- `sources.json` / `common.json` (en + pl).
- `SourcesPage.test.tsx`: statuses render from the fixture; a stale plan shows "needs verification"; the report button is hidden when `REPO_URL` is empty and has a correct href when it is set (mock `import.meta.env` via a config indirection).

## Out of scope
Changing calculations.

## Acceptance criteria
- Attribution is visible on every page.
- All rule-5 checks pass. The i18n key-parity test passes.

## PR title
feat(sources): data sources, methodology, attribution and issue templates
````

---

### Task 17 — QA: e2e, dostępność, wydajność, README

````text
# Task 17 — QA hardening: end-to-end tests, accessibility, performance, SEO and final docs

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
Tasks 01–16 are merged: the full app (Advisor home, Explorer, Budget, Subscriptions, Compare, History, Profiles, Sources), the data pipeline, the daily refresh, i18n en/pl, currencies, and shareable links. Playwright exists with one smoke test. CI runs checks and e2e.

## Goal
Make the app robust and polished before regular use: deterministic e2e coverage of the main flows, accessibility fixes, performance budgets, error boundaries, mobile polish, meta tags and a complete README. Fix the bugs you find while doing this, but do not add new features.

## Allowed packages
`@axe-core/playwright` (dev).

## Requirements

### 1. Deterministic e2e setup
- `e2e/fixtures.ts`: a Playwright test fixture that intercepts `**/data/snapshot.json` (serves `src/domain/__fixtures__/built-snapshot.json`), `**/data/history/**` (serves a small committed fixture; create `e2e/fixtures/history/index.json` and `2026.json`), and `https://openrouter.ai/api/v1/models` (serves `scripts/__fixtures__/openrouter-models.json`). It also clears localStorage before each test, and sets a fixed locale `en-US` and timezone `UTC`.
- All specs use this fixture.

### 2. E2E specs (`e2e/*.spec.ts`)
- `advisor.spec.ts`: set budget 20 USD, choose "Agentic coding", → a top pick is visible, "Copy link" works (grant clipboard permissions, read the clipboard, the URL contains `b=20`), opening that URL in a new page reproduces the same top pick.
- `explorer.spec.ts`: search narrows rows, the Pareto toggle reduces rows, sort by input price, the details drawer opens and closes with Escape, the map tab renders.
- `budget.spec.ts`: changing the metric tabs updates the chart, and highlights are non-empty.
- `subscriptions.spec.ts`: plan cards render, an unknown-limits plan shows the not-estimable state, selecting a plan updates the break-even summary table.
- `compare.spec.ts`: opening a compare URL with 2 items renders 2 columns, adding a third via the combobox works.
- `profiles.spec.ts`: create a custom profile, it appears in the Explorer ProfileSelect after navigation and survives a reload.
- `i18n-currency.spec.ts`: switching to PL changes the UI language, switching to PLN changes the money format (`zł`), VAT 23% increases displayed prices, and the settings persist across reload.
- `mobile.spec.ts` (viewport 375×812): the nav menu opens and closes, there is no horizontal page scroll on any route (`document.documentElement.scrollWidth <= innerWidth`).
- `a11y.spec.ts`: for every route, run axe (`@axe-core/playwright`) and assert no `serious` or `critical` violations. Fix the violations in the app code (labels, contrast, roles, focus order, landmark structure, chart `aria-label`s, table headers).

### 3. Robustness
- An error boundary per route (`src/app/RouteErrorBoundary.tsx`) with a translated message, a "Reload page" button and a "Go home" link. Add a test with a throwing component.
- Guard all `localStorage` access with try/catch (audit and fix).
- The live refresh failure path shows the snapshot data with the status message (verify; fix if needed).

### 4. Performance
- Keep route-level code splitting. Make sure `recharts` is not in the initial chunk (lazy chart components where needed). Memoize the heavy row builders keyed on their inputs.
- Report the `vite build` output sizes in the PR description. Target: initial JS ≤ 300 kB gzip. If it is above that, explain why and what is in it.
- Debounce search inputs (Explorer, Compare picker) at 150–200 ms.

### 5. SEO and meta
- `public/favicon.svg` (a simple coin/token glyph in the accent color), `<link rel="icon">`, `theme-color`, an English meta description, Open Graph (`og:title`, `og:description`, `og:type=website`) and a Twitter card. Keep per-route `document.title`.
- `public/robots.txt` (allow all).

### 6. README (final)
Pitch (EN), feature list with one line per page, a screenshots section (generate screenshots with Playwright into `docs/screenshots/` for Advisor, Explorer map, Subscriptions break-even, at 1280×800, and embed them), how the data works (sources, daily refresh, history, curated data and how to update it, link to docs), local development, scripts, deployment and required repo settings (Pages source, workflow permissions, optional `AA_API_KEY`), attribution, disclaimer, and a link to `JULES_PROMPTS.md` as the development log.

### 7. CI
Make sure the e2e job installs browsers and runs all specs. Upload the report on failure (already configured; keep it).

## Out of scope
New features, data format changes.

## Acceptance criteria
- `npm run e2e` passes locally with the fixtures (no live network needed).
- No serious/critical axe violations on any route.
- All rule-5 checks pass. The i18n key-parity test passes.

## PR title
chore: QA hardening — e2e coverage, accessibility, performance, meta and README
````

---

## 5. Prompty utrzymaniowe (po zakończeniu budowy)

### M1 — Comiesięczna weryfikacja danych subskrypcji

Odpalaj raz w miesiącu albo gdy strona Sources pokazuje „needs verification”. Jules ma w VM dostęp do sieci, ale strony z cenami często renderują się JS-em, więc prompt każe mu zmieniać tylko to, co faktycznie zweryfikował.

````text
# Maintenance M1 — Verify and refresh curated subscription data

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
The app is complete. Curated data lives in `data/curated/subscriptions.json` and `data/curated/channel-fees.json` (schemas in `src/domain/schemas.ts`, docs in `docs/curated-data.md`). Validate with `npm run data:validate`.

## Goal
Bring subscription plans and channel fees up to date with the providers' official pages, changing ONLY values you can verify.

## Requirements
1. For every plan and fee, open its `url` / `sources` / `sourceUrl` (use `curl` or a headless fetch; try the provider's help-center pages if the pricing page is JS-rendered). Today's date is the date of this run.
2. For each item:
   - If you verified the price/limits/models: update the changed fields, set `lastVerified` to today, keep or raise `confidence` (official only when the provider's own page states the number), and update `notes` (en + pl) if the terms changed.
   - If you could NOT verify (page unreachable or unclear): change nothing, and list the item in the PR description under "Not verified" with the reason.
   - If a plan was discontinued: remove it, and mention it in the PR.
   - If a provider has a new consumer/coding plan relevant to the app (≈ $5–$250/month), add it following `docs/curated-data.md` (reference unit, limit kind, sources).
3. Update `primaryModelId`/`includedModelIds` to ids that exist in `public/data/snapshot.json` when the plan's models changed.
4. Run `npm run data:validate`: zero errors, and warnings explained in the PR.
5. Do not edit `public/data/` by hand.

## Acceptance criteria
- A PR whose description contains a table: item | field | old → new | evidence URL. Plus the "Not verified" list.
- All rule-5 checks pass.

## PR title
chore(data): monthly verification of subscription plans and channel fees
````

### M2 — Dodanie nowego planu / providera

Uzupełnij pola w nawiasach `<...>` przed wklejeniem.

````text
# Maintenance M2 — Add a subscription plan: <provider> <plan name>

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
The app is complete. Curated plans live in `data/curated/subscriptions.json` (schema `SubscriptionPlanSchema`, guide `docs/curated-data.md`).

## Goal
Add the plan described below so it appears in Subscriptions, Advisor and Compare.

## Plan details (from the maintainer)
- Provider / slug: <e.g. Moonshot AI / moonshotai>
- Plan name and price per month (USD, and local PLN/EUR gross price if known): <...>
- Official URL(s): <...>
- What is included (models, coding agent/CLI, image generation, deep research, API access): <...>
- Published limits (per window / per week / per month / credit), as stated: <...>
- Anything uncertain: <...>

## Requirements
1. Add the entry with a kebab-case id. Choose `limit.kind` and `referenceUnit` as described in `docs/curated-data.md` (explain the choice in the PR). Set `confidence` honestly. `lastVerified` = today. `notes` in en + pl. `sources` include the URLs above.
2. `primaryModelId`/`includedModelIds` must exist in `public/data/snapshot.json` when possible. If a model is missing, keep the best matching id and explain it.
3. If the provider slug is new and its models come from LiteLLM or Artificial Analysis under different names, add entries to `PROVIDER_SLUG_BY_SOURCE_PROVIDER` or `data/curated/model-aliases.json` as needed, with tests.
4. `npm run data:validate` passes with zero errors.

## Acceptance criteria
- The plan renders on `/subscriptions` with a capacity estimate (or the "not estimable" state if the limits are unknown).
- All rule-5 checks pass.

## PR title
feat(data): add <provider> <plan name> subscription plan
````

### M3 — Szablon bugfixa

````text
# Maintenance M3 — Fix: <short bug title>

## Ground rules (read before doing anything)

1. Project: **token-price-analyzer** — a static web app (Vite + React + TypeScript, deployed to GitHub Pages) that compares current AI model API prices, subscription plans and model quality, and answers questions like: "I have $20 this month — should I pay for an API or a subscription, which provider and which model give me the best quality for the money?". Data is fetched by Node scripts (run daily by a GitHub Action) into JSON files under `public/data/`; the browser additionally refreshes OpenRouter prices live.
2. Read `AGENTS.md` (if it exists) before planning and follow it. If this task changes a convention described there, update `AGENTS.md` in the same PR.
3. `JULES_PROMPTS.md` (if present in the repo) is the planning document for the whole project. Implement ONLY the task in this prompt. Never start, pre-build or "prepare" other tasks from that file.
4. Work on top of the latest default branch. Everything listed under "Current state" is already merged. Reuse it. Do not re-implement it, and do not rewrite it unless this task explicitly says so.
5. Keep changes valid. Before you submit, run these in order: `npm ci` (use `npm install` instead if you changed dependencies), `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Every command must finish with zero errors and zero failing tests. Never disable, skip, weaken or delete existing tests, lint rules or type checks to get a green result. (Task 01 creates these scripts. In task 01, make them exist and pass.)
6. Stay in scope. Do not refactor, rename or reformat code this task does not need to touch. Do not change public exports of existing modules unless the task says so. If you must change one, update every usage.
7. Dependencies: add only the npm packages this task explicitly allows. If you think another package is needed, implement without it and say so in the PR description.
8. Code quality: TypeScript `strict`. No `any` (use `unknown` plus narrowing, or zod). No `@ts-ignore`. A `@ts-expect-error` is allowed only with a one-line reason. Code in `src/domain/` is pure: no React, no DOM, no `fetch`, and no `Date.now()`/`new Date()` without an injectable `now` parameter.
9. Tests never touch the network. Use committed fixtures. New logic in `src/domain/` and `scripts/` needs Vitest unit tests. New UI needs at least one Testing Library component test for its main behavior.
10. Money and units: internal prices are **USD per 1,000,000 tokens** (fields named `...PerMTok`, plain JS numbers). Convert currency and apply VAT only at display time, using the helpers in `src/domain/currency.ts` (once that file exists).
11. UI text: once `src/i18n/` exists, every user-visible string goes through i18n with BOTH `en` and `pl` translations. Polish must be real, natural Polish, not copied English. Human-readable text in curated data uses `{ "en": "...", "pl": "..." }` objects.
12. Secrets: none in code or fixtures. The only secret in the project is the optional GitHub Actions secret `AA_API_KEY`, and everything must work when it is absent.
13. Deliver exactly one PR. Use the PR title given at the end of this prompt (Conventional Commits format). The PR description must cover: a summary, the changed areas, how to verify manually, assumptions, and any follow-ups you deliberately left out.
14. If this prompt conflicts with what you find in the repository, prefer the existing code's patterns, make the smallest sensible adaptation, and explain it in the PR description. Do not stop to ask questions unless you are truly blocked. Make a reasonable, documented assumption instead.

## Current state
The app is complete (Advisor, Explorer, Budget, Subscriptions, Compare, History, Profiles, Sources; data pipeline with daily refresh).

## Bug report
- Where: <page URL / share link / file>
- Steps to reproduce: <1. … 2. … 3. …>
- Expected: <…>
- Actual: <…> (screenshot/console error if any: <…>)

## Requirements
1. Reproduce the bug first with a failing automated test: a unit test if the cause is in `src/domain/` or `scripts/`, a component test or e2e spec if it is UI. Commit that test.
2. Fix the root cause with the smallest change. Do not refactor unrelated code.
3. If the fix changes a calculation, update `docs/methodology.md` and the Sources page methodology text (en + pl) accordingly.
4. Describe the root cause in the PR description.

## Acceptance criteria
- The new test fails before and passes after the fix.
- All rule-5 checks pass.

## PR title
fix: <short bug title>
````
