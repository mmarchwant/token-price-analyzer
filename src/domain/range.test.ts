import { describe, expect, it } from 'vitest';
import { addRanges, divideRange, isPoint, minRange, point, range, scaleRange } from './range';

describe('range math', () => {
  it('creates valid ranges and points', () => {
    const r = range(10, 20);
    expect(r).toEqual({ low: 10, high: 20 });
    expect(isPoint(r)).toBe(false);

    const p = point(15);
    expect(p).toEqual({ low: 15, high: 15 });
    expect(isPoint(p)).toBe(true);
  });

  it('throws on invalid range bounds', () => {
    expect(() => range(-1, 5)).toThrow();
    expect(() => range(10, 5)).toThrow();
  });

  it('scales ranges and throws on negative scale factor', () => {
    const r = range(5, 10);
    expect(scaleRange(r, 2)).toEqual({ low: 10, high: 20 });
    expect(scaleRange(r, 0)).toEqual({ low: 0, high: 0 });
    expect(() => scaleRange(r, -1)).toThrow();
  });

  it('adds ranges', () => {
    const a = range(5, 10);
    const b = range(1, 2);
    expect(addRanges(a, b)).toEqual({ low: 6, high: 12 });
  });

  it('divides ranges and throws on non-positive divisor', () => {
    const r = range(10, 20);
    expect(divideRange(r, 2)).toEqual({ low: 5, high: 10 });
    expect(() => divideRange(r, 0)).toThrow();
    expect(() => divideRange(r, -2)).toThrow();
  });

  it('caps ranges with minRange and throws on negative cap', () => {
    const r = range(10, 25);
    expect(minRange(r, 20)).toEqual({ low: 10, high: 20 });
    expect(minRange(r, 5)).toEqual({ low: 5, high: 5 });
    expect(() => minRange(r, -1)).toThrow();
  });
});
