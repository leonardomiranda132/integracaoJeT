export type IntegrationErrorClassification =
  | "external-timeout"
  | "external-retryable"
  | "credentials"
  | "validation"
  | "unexpected";

export interface IntegrationErrorContext extends Record<string, unknown> {
  classification?: IntegrationErrorClassification;
}

export class IntegrationError extends Error {
  readonly classification?: IntegrationErrorClassification;

  constructor(
    message: string,
    readonly context?: IntegrationErrorContext,
  ) {
    super(message);
    this.name = "IntegrationError";
    this.classification = context?.classification;
  }
}
