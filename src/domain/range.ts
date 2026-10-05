import type { Range } from './types';

export function range(low: number, high: number): Range {
  if (low < 0 || high < 0 || low > high) {
    throw new Error(`Invalid range bounds: low=${low}, high=${high}`);
  }
  return { low, high };
}

export function point(x: number): Range {
  return range(x, x);
}

export function scaleRange(r: Range, k: number): Range {
  if (k < 0) {
    throw new Error(`Scale factor k must be >= 0, got ${k}`);
  }
  return range(r.low * k, r.high * k);
}

export function addRanges(a: Range, b: Range): Range {
  return range(a.low + b.low, a.high + b.high);
}

export function divideRange(r: Range, d: number): Range {
  if (d <= 0) {
    throw new Error(`Divisor d must be > 0, got ${d}`);
  }
  return range(r.low / d, r.high / d);
}

export function minRange(r: Range, cap: number): Range {
  if (cap < 0) {
    throw new Error(`Cap must be >= 0, got ${cap}`);
  }
  return range(Math.min(r.low, cap), Math.min(r.high, cap));
}

export function isPoint(r: Range): boolean {
  return r.low === r.high;
}
