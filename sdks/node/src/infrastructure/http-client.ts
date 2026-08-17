/**
 * Lightweight HTTP client wrapper around native fetch.
 * Handles timeout, error extraction, and JSON parsing.
 */
export interface HttpResponse {
  ok: boolean;
  status: number;
  body: string;
}

export class HttpClient {
  private readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs;
  }

  async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.request('GET', url, undefined, headers);
  }

  async post(url: string, body: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.request('POST', url, body, headers);
  }

  private async request(
    method: string,
    url: string,
    body?: string,
    headers?: Record<string, string>,
  ): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body,
        signal: controller.signal,
      });

      const responseBody = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        body: responseBody,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { ok: false, status: 0, body: 'Request timed out' };
      }
      const message = error instanceof Error ? error.message : 'Network error';
      return { ok: false, status: 0, body: message };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Extracts an error message from a JSON response body.
 * Looks for "error" or "detail" properties.
 */
export function extractError(responseBody: string, fallbackStatus: number): string {
  try {
    const parsed = JSON.parse(responseBody);
    if (typeof parsed.error === 'string') return parsed.error;
    if (typeof parsed.detail === 'string') return parsed.detail;
  } catch {
    // Not JSON
  }
  return `HTTP ${fallbackStatus}`;
}
