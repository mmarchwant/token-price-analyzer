import { describe, expect, it } from 'vitest';
import sampleSnapshot from './__fixtures__/sample-snapshot.json';
import { SnapshotSchema, parseSnapshot } from './schemas';

describe('schemas', () => {
  it('parses sample-snapshot.json successfully', () => {
    const parsed = parseSnapshot(sampleSnapshot);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.models).toHaveLength(8);
    expect(parsed.subscriptions).toHaveLength(4);
    expect(parsed.usageProfiles).toHaveLength(2);
    expect(parsed.channelFees).toHaveLength(2);
  });

  it('throws formatted error on invalid snapshot listing up to 5 issues', () => {
    const invalidData = {
      schemaVersion: 2, // invalid version
      generatedAt: 123, // invalid type
      sources: 'not-an-array',
      fx: { base: 'EUR' }, // invalid base
      models: [],
      subscriptions: [],
      usageProfiles: [],
      channelFees: [],
      diagnostics: { unmatched: [], warnings: [] },
    };

    expect(() => parseSnapshot(invalidData)).toThrowError(/Invalid snapshot:\nschemaVersion: /);

    try {
      parseSnapshot(invalidData);
    } catch (e) {
      const err = e as Error;
      const lines = err.message.split('\n');
      // "Invalid snapshot:" line + at most 5 issue lines = at most 6 lines
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.length).toBeLessThanOrEqual(6);
    }
  });

  it('directly validates SnapshotSchema.safeParse', () => {
    const result = SnapshotSchema.safeParse(sampleSnapshot);
    expect(result.success).toBe(true);
  });
});
