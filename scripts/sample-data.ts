import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeArtificialAnalysis } from '../src/domain/sources/artificial-analysis.js';
import { buildSnapshot } from '../src/domain/sources/build-snapshot.js';
import { normalizeFrankfurter } from '../src/domain/sources/fx.js';
import { normalizeLiteLlm } from '../src/domain/sources/litellm.js';
import { normalizeOpenRouter } from '../src/domain/sources/openrouter.js';
import { loadCurated } from './lib/curated.js';

function parseArgs(): { outPath: string } {
  const args = process.argv.slice(2);
  let outPath = path.resolve('public/data/snapshot.json');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      outPath = path.resolve(args[i + 1]!);
      break;
    }
  }

  return { outPath };
}

export function generateSampleSnapshot() {
  const fixedNow = new Date('2026-10-05T06:00:00Z');
  const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__');

  const openrouterRaw = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'openrouter-models.json'), 'utf-8'),
  );
  const litellmRaw = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'litellm-prices.json'), 'utf-8'),
  );
  const aaPage1Raw = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'aa-models-page1.json'), 'utf-8'),
  );
  const aaPage2Raw = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'aa-models-page2.json'), 'utf-8'),
  );
  const fxRaw = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'frankfurter-latest.json'), 'utf-8'),
  );

  const curated = loadCurated('data/curated');
  const openrouter = normalizeOpenRouter(openrouterRaw);
  const litellm = normalizeLiteLlm(litellmRaw, openrouter.models, curated.aliases);
  const aa = normalizeArtificialAnalysis(
    [aaPage1Raw, aaPage2Raw],
    openrouter.models,
    curated.aliases,
  );
  const fx = normalizeFrankfurter(fxRaw);

  const snapshot = buildSnapshot({
    now: fixedNow,
    openrouter,
    litellm,
    aa,
    fx,
    curated,
  });

  return snapshot;
}

function main() {
  const { outPath } = parseArgs();
  console.log('Generating sample snapshot from fixtures...');
  const snapshot = generateSampleSnapshot();

  const outDir = path.dirname(outPath);
  fs.mkdirSync(outDir, { recursive: true });

  const snapshotJson = JSON.stringify(snapshot);
  fs.writeFileSync(outPath, snapshotJson, 'utf-8');
  console.log(`Wrote snapshot to ${outPath}`);

  const metaPath = path.join(outDir, 'meta.json');
  const meta = {
    generatedAt: snapshot.generatedAt,
    schemaVersion: snapshot.schemaVersion,
    modelCount: snapshot.models.length,
    subscriptionCount: snapshot.subscriptions.length,
    sources: snapshot.sources,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(`Wrote meta to ${metaPath}`);

  const fixtureBuiltPath = path.resolve('src/domain/__fixtures__/built-snapshot.json');
  fs.mkdirSync(path.dirname(fixtureBuiltPath), { recursive: true });
  fs.writeFileSync(fixtureBuiltPath, snapshotJson, 'utf-8');
  console.log(`Wrote fixture copy to ${fixtureBuiltPath}`);
}

if (
  import.meta.url.startsWith('file:') &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  main();
}
