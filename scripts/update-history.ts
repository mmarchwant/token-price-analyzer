import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendSnapshotToHistory, updateHistoryIndex } from '../src/domain/history.js';
import { parseHistoryIndex, parsePriceHistory, parseSnapshot } from '../src/domain/schemas.js';
import type { HistoryIndex, PriceHistory } from '../src/domain/types.js';

export interface UpdateHistoryDeps {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  now: Date;
  log: (msg: string) => void;
}

export async function runUpdateHistory(deps: UpdateHistoryDeps): Promise<void> {
  const snapshotPath = path.join('public', 'data', 'snapshot.json');
  if (!(await deps.exists(snapshotPath))) {
    throw new Error(`Snapshot file not found at ${snapshotPath}`);
  }

  const snapshotRaw = await deps.readFile(snapshotPath);
  const snapshot = parseSnapshot(JSON.parse(snapshotRaw));

  const genDate = new Date(snapshot.generatedAt);
  const dateStr = genDate.toISOString().slice(0, 10);
  const year = genDate.getUTCFullYear();

  const historyDir = path.join('public', 'data', 'history');
  const indexPath = path.join(historyDir, 'index.json');
  const yearPath = path.join(historyDir, `${year}.json`);
  const prevYearPath = path.join(historyDir, `${year - 1}.json`);

  let index: HistoryIndex | undefined;
  if (await deps.exists(indexPath)) {
    try {
      const rawIndex = await deps.readFile(indexPath);
      index = parseHistoryIndex(JSON.parse(rawIndex));
    } catch (err) {
      deps.log(`Failed to parse history index: ${err}`);
    }
  }

  let currentHistory: PriceHistory | undefined;
  if (await deps.exists(yearPath)) {
    try {
      const rawYear = await deps.readFile(yearPath);
      currentHistory = parsePriceHistory(JSON.parse(rawYear));
    } catch (err) {
      deps.log(`Failed to parse price history for ${year}: ${err}`);
    }
  }

  let carryFrom: PriceHistory | undefined;
  if (await deps.exists(prevYearPath)) {
    try {
      const rawPrevYear = await deps.readFile(prevYearPath);
      carryFrom = parsePriceHistory(JSON.parse(rawPrevYear));
    } catch (err) {
      deps.log(`Failed to parse price history for ${year - 1}: ${err}`);
    }
  }

  deps.log(`Updating price history for ${dateStr} (year ${year})...`);
  const updatedHistory = appendSnapshotToHistory(currentHistory, snapshot, dateStr, carryFrom);
  const updatedIndex = updateHistoryIndex(index, year, snapshot.generatedAt);

  await deps.writeFile(yearPath, JSON.stringify(updatedHistory));
  await deps.writeFile(indexPath, JSON.stringify(updatedIndex, null, 2));

  deps.log(`Successfully updated history for year ${year}.`);
}

if (
  import.meta.url.startsWith('file:') &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  runUpdateHistory({
    readFile: (p) => fs.promises.readFile(p, 'utf-8'),
    writeFile: async (p, c) => {
      await fs.promises.mkdir(path.dirname(p), { recursive: true });
      await fs.promises.writeFile(p, c, 'utf-8');
    },
    exists: async (p) => {
      try {
        await fs.promises.stat(p);
        return true;
      } catch {
        return false;
      }
    },
    now: new Date(),
    log: console.log,
  }).catch((err) => {
    console.error('Update history failed:', err);
    process.exit(1);
  });
}
