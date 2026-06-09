export interface OrderProcessingEventInput {
  syncRunId?: string;
  eventType: string;
  branchCode?: number;
  orderCode?: number;
  txlogisticId?: string;
  status: string;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface OrderProcessingEventsRepository {
  record(event: OrderProcessingEventInput): Promise<void>;
}
