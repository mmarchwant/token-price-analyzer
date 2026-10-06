import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

export interface Codec<T> {
  serialize: (value: T) => string;
  deserialize: (raw: string | null) => T | undefined;
}

export const stringCodec: Codec<string> = {
  serialize: (v) => v,
  deserialize: (raw) => (raw !== null ? raw : undefined),
};

export function numberCodec(opts?: { min?: number; max?: number }): Codec<number> {
  return {
    serialize: (v) => String(v),
    deserialize: (raw) => {
      if (raw === null || raw.trim() === '') return undefined;
      const n = Number(raw);
      if (Number.isNaN(n)) return undefined;
      if (opts?.min !== undefined && n < opts.min) return undefined;
      if (opts?.max !== undefined && n > opts.max) return undefined;
      return n;
    },
  };
}

export const booleanCodec: Codec<boolean> = {
  serialize: (v) => (v ? 'true' : 'false'),
  deserialize: (raw) => {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return undefined;
  },
};

export function enumCodec<T extends string>(values: readonly T[]): Codec<T> {
  return {
    serialize: (v) => v,
    deserialize: (raw) => {
      if (raw !== null && (values as readonly string[]).includes(raw)) {
        return raw as T;
      }
      return undefined;
    },
  };
}

export function listCodec<T>(itemCodec: Codec<T>): Codec<T[]> {
  return {
    serialize: (list) =>
      list.map((item) => encodeURIComponent(itemCodec.serialize(item))).join(','),
    deserialize: (raw) => {
      if (raw === null || raw.trim() === '') return undefined;
      const parts = raw.split(',');
      const items: T[] = [];
      for (const part of parts) {
        if (!part) continue;
        const decoded = decodeURIComponent(part);
        const val = itemCodec.deserialize(decoded);
        if (val !== undefined) {
          items.push(val);
        }
      }
      return items;
    },
  };
}

export function useUrlState<T>(
  key: string,
  codec: Codec<T>,
  defaultValue: T,
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get(key);
  const deserialized = codec.deserialize(raw);
  const value = deserialized !== undefined ? deserialized : defaultValue;

  const setValue = useCallback(
    (newValue: T) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const serializedNew = codec.serialize(newValue);
          const serializedDefault = codec.serialize(defaultValue);

          if (serializedNew === serializedDefault) {
            next.delete(key);
          } else {
            next.set(key, serializedNew);
          }
          return next;
        },
        { replace: true },
      );
    },
    [key, codec, defaultValue, setSearchParams],
  );

  return [value, setValue];
}

export function buildShareUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.href;
  }
  return '';
}
