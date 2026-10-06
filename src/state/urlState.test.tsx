import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useSearchParams } from 'react-router';
import {
  useUrlState,
  stringCodec,
  numberCodec,
  booleanCodec,
  enumCodec,
  listCodec,
  buildShareUrl,
} from './urlState';

describe('codecs', () => {
  it('stringCodec serializes and deserializes correctly', () => {
    expect(stringCodec.serialize('hello')).toBe('hello');
    expect(stringCodec.deserialize('hello')).toBe('hello');
    expect(stringCodec.deserialize(null)).toBeUndefined();
  });

  it('numberCodec handles valid numbers, min/max bounds and invalid inputs', () => {
    const codec = numberCodec({ min: 10, max: 100 });
    expect(codec.serialize(42)).toBe('42');
    expect(codec.deserialize('42')).toBe(42);
    expect(codec.deserialize('5')).toBeUndefined(); // < min
    expect(codec.deserialize('105')).toBeUndefined(); // > max
    expect(codec.deserialize('abc')).toBeUndefined();
    expect(codec.deserialize(null)).toBeUndefined();
  });

  it('booleanCodec handles true, false, and invalid values', () => {
    expect(booleanCodec.serialize(true)).toBe('true');
    expect(booleanCodec.serialize(false)).toBe('false');
    expect(booleanCodec.deserialize('true')).toBe(true);
    expect(booleanCodec.deserialize('false')).toBe(false);
    expect(booleanCodec.deserialize('yes')).toBeUndefined();
    expect(booleanCodec.deserialize(null)).toBeUndefined();
  });

  it('enumCodec validates against allowed enum values', () => {
    const codec = enumCodec(['USD', 'PLN', 'EUR'] as const);
    expect(codec.serialize('PLN')).toBe('PLN');
    expect(codec.deserialize('PLN')).toBe('PLN');
    expect(codec.deserialize('GBP')).toBeUndefined();
    expect(codec.deserialize(null)).toBeUndefined();
  });

  it('listCodec handles comma separated items', () => {
    const codec = listCodec(stringCodec);
    expect(codec.serialize(['a', 'b,c'])).toBe('a,b%2Cc');
    expect(codec.deserialize('a,b%2Cc')).toEqual(['a', 'b,c']);
    expect(codec.deserialize('')).toBeUndefined();
    expect(codec.deserialize(null)).toBeUndefined();
  });
});

describe('useUrlState', () => {
  it('reads initial value from URL search params', () => {
    function wrapper({ children }: { children: React.ReactNode }) {
      return <MemoryRouter initialEntries={['/?q=hello&count=5']}>{children}</MemoryRouter>;
    }

    const { result: qResult } = renderHook(() => useUrlState('q', stringCodec, 'default'), {
      wrapper,
    });
    const { result: countResult } = renderHook(() => useUrlState('count', numberCodec(), 0), {
      wrapper,
    });

    expect(qResult.current[0]).toBe('hello');
    expect(countResult.current[0]).toBe(5);
  });

  it('falls back to default value when param is missing or invalid', () => {
    function wrapper({ children }: { children: React.ReactNode }) {
      return <MemoryRouter initialEntries={['/?count=invalid']}>{children}</MemoryRouter>;
    }

    const { result: qResult } = renderHook(() => useUrlState('q', stringCodec, 'default'), {
      wrapper,
    });
    const { result: countResult } = renderHook(
      () => useUrlState('count', numberCodec({ min: 1 }), 10),
      { wrapper },
    );

    expect(qResult.current[0]).toBe('default');
    expect(countResult.current[0]).toBe(10);
  });

  it('updates state and URL, preserving other params', () => {
    function wrapper({ children }: { children: React.ReactNode }) {
      return <MemoryRouter initialEntries={['/?other=keep']}>{children}</MemoryRouter>;
    }

    const { result } = renderHook(
      () => {
        const [q, setQ] = useUrlState('q', stringCodec, 'default');
        const [searchParams] = useSearchParams();
        return { q, setQ, searchParams };
      },
      { wrapper },
    );

    expect(result.current.q).toBe('default');
    expect(result.current.searchParams.get('other')).toBe('keep');

    act(() => {
      result.current.setQ('new-value');
    });

    expect(result.current.q).toBe('new-value');
    expect(result.current.searchParams.get('q')).toBe('new-value');
    expect(result.current.searchParams.get('other')).toBe('keep');
  });

  it('removes param from URL when value equals default value', () => {
    function wrapper({ children }: { children: React.ReactNode }) {
      return <MemoryRouter initialEntries={['/?q=custom']}>{children}</MemoryRouter>;
    }

    const { result } = renderHook(
      () => {
        const [q, setQ] = useUrlState('q', stringCodec, 'default');
        const [searchParams] = useSearchParams();
        return { q, setQ, searchParams };
      },
      { wrapper },
    );

    expect(result.current.q).toBe('custom');
    expect(result.current.searchParams.get('q')).toBe('custom');

    act(() => {
      result.current.setQ('default');
    });

    expect(result.current.q).toBe('default');
    expect(result.current.searchParams.has('q')).toBe(false);
  });
});

describe('buildShareUrl', () => {
  it('returns window.location.href when available', () => {
    expect(buildShareUrl()).toBe(window.location.href);
  });
});
