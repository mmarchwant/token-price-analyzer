import { UsageProfileSchema } from '../../domain/schemas';
import type { UsageProfile } from '../../domain/types';

export function encodeBase64Url(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]!);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64Url(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeProfile(profile: UsageProfile): string {
  // Omit isPreset from exported JSON
  const profileObj = { ...profile } as Record<string, unknown>;
  delete profileObj.isPreset;
  return encodeBase64Url(JSON.stringify(profileObj));
}

export type DecodeResult =
  { success: true; profile: UsageProfile } | { success: false; error: string };

export function decodeProfile(encoded: string): DecodeResult {
  try {
    const jsonStr = decodeBase64Url(encoded);
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid profile payload' };
    }
    const withPreset = {
      ...parsed,
      isPreset: false,
    };
    const result = UsageProfileSchema.safeParse(withPreset);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const issuePath = firstIssue?.path.join('.') || 'payload';
      return {
        success: false,
        error: `Invalid profile structure (${issuePath}: ${firstIssue?.message ?? 'invalid'})`,
      };
    }
    return { success: true, profile: result.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to decode profile payload',
    };
  }
}
