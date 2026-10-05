export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} while fetching ${url}`);
    this.name = 'HttpError';
  }
}

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
}

export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { headers, timeoutMs = 30000, retries = 2 } = options;
  const retryDelays = [500, 1500];

  let attempt = 0;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const isRetryable = response.status === 429 || response.status >= 500;
        if (isRetryable && attempt < retries) {
          const delay = retryDelays[attempt] ?? 1500;
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
          continue;
        }
        throw new HttpError(response.status, url, `HTTP ${response.status} from ${url}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof HttpError) {
        throw err;
      }

      if (attempt < retries) {
        const delay = retryDelays[attempt] ?? 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        continue;
      }

      const status = 0;
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpError(status, url, `Network error fetching ${url}: ${message}`);
    }
  }

  throw new HttpError(0, url, `Max retries reached fetching ${url}`);
}
