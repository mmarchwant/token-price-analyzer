import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runFetchData, type FetchDataDeps } from './fetch-data';

const openrouterFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'openrouter-models.json'), 'utf-8'),
);
const litellmFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'litellm-prices.json'), 'utf-8'),
);
const aaPage1Fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'aa-models-page1.json'), 'utf-8'),
);
const aaPage2Fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'aa-models-page2.json'), 'utf-8'),
);
const fxFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'frankfurter-latest.json'), 'utf-8'),
);

function createMockDeps(overrides?: Partial<FetchDataDeps>): {
  deps: FetchDataDeps;
  writtenFiles: Map<string, string>;
} {
  const writtenFiles = new Map<string, string>();

  const defaultDeps: FetchDataDeps = {
    fetchJson: vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('openrouter.ai')) return openrouterFixture;
      if (url.includes('litellm')) return litellmFixture;
      if (url.includes('artificialanalysis.ai')) {
        if (url.includes('page=2')) return aaPage2Fixture;
        return aaPage1Fixture;
      }
      if (url.includes('frankfurter.dev')) return fxFixture;
      throw new Error(`Unhandled mock URL: ${url}`);
    }),
    readFile: vi.fn().mockRejectedValue(new Error('File not found')),
    writeFile: vi.fn().mockImplementation(async (filepath: string, content: string) => {
      writtenFiles.set(filepath, content);
    }),
    exists: vi.fn().mockResolvedValue(false),
    env: { AA_API_KEY: 'test-key' },
    now: new Date('2026-10-05T06:00:00Z'),
    log: vi.fn(),
    ...overrides,
  };

  return { deps: defaultDeps, writtenFiles };
}

describe('runFetchData', () => {
  it('runs happy path and writes snapshot and meta files', async () => {
    const { deps, writtenFiles } = createMockDeps();

    const snapshot = await runFetchData(deps);

    expect(snapshot.models.length).toBeGreaterThan(0);
    const snapshotPath = path.join('public', 'data', 'snapshot.json');
    const metaPath = path.join('public', 'data', 'meta.json');

    expect(writtenFiles.has(snapshotPath)).toBe(true);
    expect(writtenFiles.has(metaPath)).toBe(true);

    const writtenMeta = JSON.parse(writtenFiles.get(metaPath)!);
    expect(writtenMeta.modelCount).toBe(snapshot.models.length);
    expect(writtenMeta.schemaVersion).toBe(1);
  });

  it('skips Artificial Analysis when AA_API_KEY is missing', async () => {
    const { deps, writtenFiles } = createMockDeps({ env: {} });

    const snapshot = await runFetchData(deps);

    const aaStatus = snapshot.sources.find((s) => s.id === 'artificial-analysis');
    expect(aaStatus?.skipped).toBe(true);
    expect(writtenFiles.size).toBe(2);
  });

  it('continues and writes snapshot when LiteLLM fetch fails', async () => {
    const { deps, writtenFiles } = createMockDeps({
      fetchJson: vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('openrouter.ai')) return openrouterFixture;
        if (url.includes('litellm')) throw new Error('LiteLLM Network Error');
        if (url.includes('frankfurter.dev')) return fxFixture;
        throw new Error(`Unhandled mock URL: ${url}`);
      }),
      env: {},
    });

    const snapshot = await runFetchData(deps);

    const litellmStatus = snapshot.sources.find((s) => s.id === 'litellm');
    expect(litellmStatus?.ok).toBe(false);
    expect(litellmStatus?.error).toBe('LiteLLM Network Error');
    expect(writtenFiles.size).toBe(2);
  });

  it('throws error and does not write files when OpenRouter fails without previous snapshot', async () => {
    const { deps, writtenFiles } = createMockDeps({
      fetchJson: vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('openrouter.ai')) throw new Error('OpenRouter 500');
        return {};
      }),
    });

    await expect(runFetchData(deps)).rejects.toThrow(/OpenRouter failed/);
    expect(writtenFiles.size).toBe(0);
  });
});
