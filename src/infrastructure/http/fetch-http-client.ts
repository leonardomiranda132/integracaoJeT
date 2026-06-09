import {
  IntegrationError,
  type IntegrationErrorClassification,
} from "../../domain/errors/integration-error.js";
import type { HttpClient, HttpRequestOptions } from "./http-client.js";

interface FetchHttpClientDefaults {
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
}

interface FailedHttpResponse {
  status: number;
  responseBody: string;
}

class HttpResponseError extends Error implements FailedHttpResponse {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super("HTTP response was not ok.");
    this.name = "HttpResponseError";
  }
}

const DEFAULTS: FetchHttpClientDefaults = {
  timeoutMs: 30000,
  maxRetries: 2,
  retryBaseDelayMs: 500,
  retryMaxDelayMs: 5000,
};

function toNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function toPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function isFailedHttpResponse(error: unknown): error is FailedHttpResponse {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as FailedHttpResponse).status === "number" &&
    "responseBody" in error &&
    typeof (error as FailedHttpResponse).responseBody === "string"
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function classifyStatus(status: number): IntegrationErrorClassification {
  if (status === 401 || status === 403) {
    return "credentials";
  }

  if (status >= 400 && status < 500) {
    return "validation";
  }

  if (isRetryableStatus(status)) {
    return "external-retryable";
  }

  return "unexpected";
}

export class FetchHttpClient implements HttpClient {
  private readonly defaults: FetchHttpClientDefaults;

  constructor(defaults: Partial<FetchHttpClientDefaults> = {}) {
    this.defaults = {
      ...DEFAULTS,
      ...defaults,
    };
  }

  async request<T>(options: HttpRequestOptions): Promise<T> {
    const maxRetries = toNonNegativeInteger(
      options.maxRetries,
      this.defaults.maxRetries,
    );
    const timeoutMs = toPositiveInteger(options.timeoutMs, this.defaults.timeoutMs);
    const retryBaseDelayMs = toPositiveInteger(
      options.retryBaseDelayMs,
      this.defaults.retryBaseDelayMs,
    );
    let lastError: IntegrationError | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
      try {
        return await this.execute<T>(options, timeoutMs);
      } catch (error) {
        const integrationError = this.toIntegrationError(
          error,
          options,
          timeoutMs,
          attempt,
          maxRetries,
        );
        lastError = integrationError;

        if (
          attempt > maxRetries ||
          !this.shouldRetry(integrationError.classification)
        ) {
          throw integrationError;
        }

        await sleep(this.retryDelayMs(attempt, retryBaseDelayMs));
      }
    }

    throw (
      lastError ??
      new IntegrationError("Erro inesperado em chamada HTTP externa.", {
        classification: "unexpected",
        url: options.url,
        method: options.method,
      })
    );
  }

  private async execute<T>(
    options: HttpRequestOptions,
    timeoutMs: number,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });

      const text = await response.text();

      if (!response.ok) {
        throw new HttpResponseError(response.status, text);
      }

      return text ? (JSON.parse(text) as T) : ({} as T);
    } finally {
      clearTimeout(timeout);
    }
  }

  private toIntegrationError(
    error: unknown,
    options: HttpRequestOptions,
    timeoutMs: number,
    attempt: number,
    maxRetries: number,
  ): IntegrationError {
    const retryContext = {
      url: options.url,
      method: options.method,
      attempt,
      maxRetries,
    };

    if (isFailedHttpResponse(error)) {
      const classification = classifyStatus(error.status);

      return new IntegrationError("Falha em chamada HTTP externa.", {
        ...retryContext,
        classification,
        status: error.status,
        responseBody: error.responseBody,
        retryable: this.shouldRetry(classification),
      });
    }

    if (isAbortError(error)) {
      return new IntegrationError("Timeout em chamada HTTP externa.", {
        ...retryContext,
        classification: "external-timeout",
        timeoutMs,
        retryable: true,
      });
    }

    if (error instanceof IntegrationError) {
      return error;
    }

    if (error instanceof SyntaxError) {
      return new IntegrationError("Resposta HTTP externa invalida.", {
        ...retryContext,
        classification: "unexpected",
        errorMessage: error.message,
        retryable: false,
      });
    }

    if (error instanceof Error) {
      return new IntegrationError("Erro de rede em chamada HTTP externa.", {
        ...retryContext,
        classification: "external-retryable",
        errorName: error.name,
        errorMessage: error.message,
        retryable: true,
      });
    }

    return new IntegrationError("Erro inesperado em chamada HTTP externa.", {
      ...retryContext,
      classification: "unexpected",
      error,
      retryable: false,
    });
  }

  private shouldRetry(
    classification: IntegrationErrorClassification | undefined,
  ): boolean {
    return (
      classification === "external-timeout" ||
      classification === "external-retryable"
    );
  }

  private retryDelayMs(attempt: number, retryBaseDelayMs: number): number {
    const exponentialDelay = retryBaseDelayMs * 2 ** (attempt - 1);
    const jitterMs = Math.floor(Math.random() * retryBaseDelayMs);
    return Math.min(exponentialDelay + jitterMs, this.defaults.retryMaxDelayMs);
  }
}
