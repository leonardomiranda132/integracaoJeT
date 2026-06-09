import { sanitizeForLogging } from "./sanitizer.js";

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export class ConsoleLogger implements Logger {
  info(message: string, context?: Record<string, unknown>): void {
    console.log(
      JSON.stringify(sanitizeForLogging({ level: "info", message, ...context })),
    );
  }

  error(message: string, context?: Record<string, unknown>): void {
    console.error(
      JSON.stringify(sanitizeForLogging({ level: "error", message, ...context })),
    );
  }
}
