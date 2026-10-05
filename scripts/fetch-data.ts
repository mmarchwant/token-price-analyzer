import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot } from '../src/domain/sources/build-snapshot.js';
import { normalizeArtificialAnalysis } from '../src/domain/sources/artificial-analysis.js';
import { normalizeFrankfurter } from '../src/domain/sources/fx.js';
import { normalizeLiteLlm } from '../src/domain/sources/litellm.js';
import { normalizeOpenRouter } from '../src/domain/sources/openrouter.js';
import { parseSnapshot } from '../src/domain/schemas.js';
import type {
  FxRates,
  ModelEntry,
  PriceOffer,
  QualityScores,
  Snapshot,
  Speed,
} from '../src/domain/types.js';
import { loadCurated, type CuratedData } from './lib/curated.js';
import { fetchJson, type FetchJsonOptions } from './lib/http.js';

export interface FetchDataDeps {
  fetchJson: <T = unknown>(url: string, options?: FetchJsonOptions) => Promise<T>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  env: Record<string, string | undefined>;
  now: Date;
  log: (msg: string) => void;
  loadCuratedData?: () => CuratedData;
}

export async function runFetchData(deps: FetchDataDeps): Promise<Snapshot> {
  const curated = deps.loadCuratedData ? deps.loadCuratedData() : loadCurated('data/curated');

  let previous: Snapshot | undefined;
  const snapshotPath = path.join('public', 'data', 'snapshot.json');
  if (await deps.exists(snapshotPath)) {
    try {
      const prevRaw = await deps.readFile(snapshotPath);
      previous = parseSnapshot(JSON.parse(prevRaw));
    } catch {
      // Previous snapshot invalid or unreadable; leave undefined
    }
  }

  // 1. OpenRouter (Required)
  let openrouterInput: { models: ModelEntry[]; warnings: string[] } | { error: string };
  try {
    deps.log('Fetching OpenRouter models...');
    const rawOR = await deps.fetchJson('https://openrouter.ai/api/v1/models');
    openrouterInput = normalizeOpenRouter(rawOR);
  } catch (err) {
    openrouterInput = { error: err instanceof Error ? err.message : String(err) };
  }

  const baseModels =
    'models' in openrouterInput ? openrouterInput.models : (previous?.models ?? []);

  // 2. LiteLLM (Optional)
  let litellmInput:
    | { offersByModelId: Map<string, PriceOffer[]>; unmatched: string[] }
    | { error: string }
    | undefined;
  try {
    deps.log('Fetching LiteLLM prices...');
    const rawLiteLLM = await deps.fetchJson(
      'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
    );
    litellmInput = normalizeLiteLlm(rawLiteLLM, baseModels, curated.aliases);
  } catch (err) {
    litellmInput = { error: err instanceof Error ? err.message : String(err) };
  }

  // 3. Artificial Analysis (Optional, if key present)
  let aaInput:
    | { byModelId: Map<string, { quality: QualityScores; speed?: Speed }>; unmatched: string[] }
    | { error: string }
    | 'skipped';

  if (!deps.env.AA_API_KEY) {
    deps.log('AA_API_KEY not set; skipping Artificial Analysis.');
    aaInput = 'skipped';
  } else {
    try {
      deps.log('Fetching Artificial Analysis data...');
      const pages: unknown[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 5) {
        const url = `https://artificialanalysis.ai/api/v2/language/models/free?page=${page}`;
        const res = await deps.fetchJson<Record<string, unknown>>(url, {
          headers: { 'x-api-key': deps.env.AA_API_KEY },
        });
        pages.push(res);
        const pagination = res?.pagination as { has_more?: boolean } | undefined;
        hasMore = pagination?.has_more === true;
        page++;
      }
      aaInput = normalizeArtificialAnalysis(pages, baseModels, curated.aliases);
    } catch (err) {
      aaInput = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  // 4. Frankfurter FX (Optional)
  let fxInput: FxRates | { error: string } | undefined;
  try {
    deps.log('Fetching Frankfurter FX rates...');
    const rawFx = await deps.fetchJson(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=PLN,EUR',
    );
    fxInput = normalizeFrankfurter(rawFx);
  } catch (err) {
    fxInput = { error: err instanceof Error ? err.message : String(err) };
  }

  // 5. Build Snapshot
  deps.log('Building snapshot...');
  const snapshot = buildSnapshot({
    now: deps.now,
    openrouter: openrouterInput,
    litellm: litellmInput,
    aa: aaInput,
    fx: fxInput,
    previous,
    curated,
  });

  // Write snapshot and meta
  const meta = {
    generatedAt: snapshot.generatedAt,
    schemaVersion: snapshot.schemaVersion,
    modelCount: snapshot.models.length,
    subscriptionCount: snapshot.subscriptions.length,
    sources: snapshot.sources,
  };

  const snapshotJsonPath = path.join('public', 'data', 'snapshot.json');
  const metaJsonPath = path.join('public', 'data', 'meta.json');

  await deps.writeFile(snapshotJsonPath, JSON.stringify(snapshot));
  await deps.writeFile(metaJsonPath, JSON.stringify(meta, null, 2));

  // Summary Table
  const modelsWithQuality = snapshot.models.filter((m) => m.quality.source !== 'none').length;
  deps.log('\n--- Fetch Summary ---');
  deps.log(`Total Models: ${snapshot.models.length} (${modelsWithQuality} with quality scores)`);
  deps.log(`Total Subscriptions: ${snapshot.subscriptions.length}`);
  deps.log('Sources Status:');
  for (const s of snapshot.sources) {
    const statusStr = s.ok ? 'OK' : s.skipped ? 'SKIPPED' : `ERROR (${s.error})`;
    deps.log(` - ${s.id}: ${statusStr} (itemCount: ${s.itemCount})`);
  }
  for (const un of snapshot.diagnostics.unmatched) {
    deps.log(`Unmatched ${un.source}: ${un.ids.length}`);
  }
  if (snapshot.diagnostics.warnings.length > 0) {
    deps.log(`Warnings (${snapshot.diagnostics.warnings.length}):`);
    for (const w of snapshot.diagnostics.warnings) {
      deps.log(` - ${w}`);
    }
  }

  return snapshot;
}

if (
  import.meta.url.startsWith('file:') &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  runFetchData({
    fetchJson,
    readFile: (p) => fs.promises.readFile(p, 'utf-8'),
    writeFile: (p, c) => fs.promises.writeFile(p, c, 'utf-8'),
    exists: async (p) => {
      try {
        await fs.promises.stat(p);
        return true;
      } catch {
        return false;
      }
    },
    env: process.env,
    now: new Date(),
    log: console.log,
  }).catch((err) => {
    console.error('Fetch data failed:', err);
    process.exit(1);
  });
}
