import fs from 'node:fs';
import path from 'node:path';
import { parseSnapshot } from '../src/domain/schemas';
import type { Snapshot } from '../src/domain/types';
import { loadCurated } from './lib/curated';
import { validateCurated } from './lib/validate-curated';

function main() {
  console.log('Loading curated datasets...');
  let curated;
  try {
    curated = loadCurated('data/curated');
  } catch (err) {
    console.error('Failed to load or parse curated datasets:');
    console.error(err);
    process.exit(1);
  }

  let snapshot: Snapshot | undefined;
  const snapshotPath = path.join('public', 'data', 'snapshot.json');
  if (fs.existsSync(snapshotPath)) {
    try {
      console.log(`Loading snapshot from ${snapshotPath}...`);
      const snapshotRaw = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
      snapshot = parseSnapshot(snapshotRaw);
    } catch (err) {
      console.error(`Could not parse ${snapshotPath}:`, err);
      process.exit(1);
    }
  } else {
    console.log('public/data/snapshot.json not found, skipping snapshot model checks.');
  }

  const { errors, warnings } = validateCurated(curated, snapshot);

  if (warnings.length > 0) {
    console.warn(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) {
      console.warn(` - [WARNING] ${w}`);
    }
  }

  if (errors.length > 0) {
    console.error(`\nErrors (${errors.length}):`);
    for (const e of errors) {
      console.error(` - [ERROR] ${e}`);
    }
    console.error('\nValidation failed.');
    process.exit(1);
  }

  console.log('\nCurated data validation passed successfully.');
}

main();
