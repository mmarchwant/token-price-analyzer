import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, HttpError } from './http';

describe('fetchJson', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed json on 200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    } as Response);

    const data = await fetchJson('https://example.com/api');
    expect(data).toEqual({ hello: 'world' });
  });

  it('throws HttpError without retry on 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    globalThis.fetch = mockFetch;

    await expect(fetchJson('https://example.com/api', { retries: 2 })).rejects.toThrow(HttpError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 status and succeeds', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

    globalThis.fetch = mockFetch;

    const data = await fetchJson('https://example.com/api', { retries: 2 });
    expect(data).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws HttpError when max retries exceeded on 500', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    globalThis.fetch = mockFetch;

    await expect(fetchJson('https://example.com/api', { retries: 1 })).rejects.toThrow(HttpError);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
