export interface IntegrationErrorsRepository {
  save(error: {
    source: string;
    message: string;
    context?: Record<string, unknown>;
  }): Promise<void>;
}
