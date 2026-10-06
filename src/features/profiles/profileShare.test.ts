import { describe, it, expect } from 'vitest';
import { encodeProfile, decodeProfile } from './profileShare';
import type { UsageProfile } from '../../domain/types';

describe('profileShare', () => {
  const sampleProfile: UsageProfile = {
    id: 'custom-test-profile',
    name: {
      en: 'Test Profile (Special & Unicode ĄĘŚĆżółń)',
      pl: 'Profil testowy (Znaki specjalne ĄĘŚĆżółń)',
    },
    description: {
      en: 'Description in English with emoji 🚀',
      pl: 'Opis po polsku z emoji 🚀',
    },
    inputTokensPerTask: 10000,
    outputTokensPerTask: 2000,
    cachedInputShare: 0.5,
    tasksPerDay: 50,
    workDaysPerMonth: 20,
    qualityDimension: 'coding',
    allowBatch: false,
    isPreset: false,
  };

  it('encodes and decodes a profile correctly', () => {
    const encoded = encodeProfile(sampleProfile);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');

    const decoded = decodeProfile(encoded);
    expect(decoded.success).toBe(true);
    if (decoded.success) {
      expect(decoded.profile).toEqual(sampleProfile);
    }
  });

  it('handles encoding preset profile by forcing isPreset to false on decode', () => {
    const presetProfile: UsageProfile = {
      ...sampleProfile,
      isPreset: true,
    };
    const encoded = encodeProfile(presetProfile);
    const decoded = decodeProfile(encoded);
    expect(decoded.success).toBe(true);
    if (decoded.success) {
      expect(decoded.profile.isPreset).toBe(false);
    }
  });

  it('returns error result for invalid base64 string', () => {
    const decoded = decodeProfile('!!!not-valid-base64!!!');
    expect(decoded.success).toBe(false);
  });

  it('returns error result for non-JSON string', () => {
    // encode "Hello World" in base64url
    const encoded = 'SGVsbG8gV29ybGQ';
    const decoded = decodeProfile(encoded);
    expect(decoded.success).toBe(false);
  });

  it('returns error result for JSON not matching UsageProfile schema', () => {
    const invalidObj = { id: 'test', name: 'not localized' };
    const encoded = btoa(JSON.stringify(invalidObj)).replace(/=/g, '');
    const decoded = decodeProfile(encoded);
    expect(decoded.success).toBe(false);
    if (!decoded.success) {
      expect(decoded.error).toContain('Invalid profile structure');
    }
  });
});
