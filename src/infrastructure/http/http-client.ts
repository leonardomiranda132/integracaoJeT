export interface HttpRequestOptions {
  method: "GET" | "POST";
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export interface HttpClient {
  request<T>(options: HttpRequestOptions): Promise<T>;
}
