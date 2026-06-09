export interface DashboardMetrics {
  runs: number;
  ordersRead: number;
  pickupsDryRun: number;
  pickupsCreated: number;
  errors: number;
  openIssues: number;
  pendingReprocess: number;
}

export interface LatestRunSummary {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  windowStart: string;
  windowEnd: string;
  pagesRead: number;
  ordersRead: number;
  pickupsCreated: number;
  errors: number;
}

export interface FlowBlock {
  id: string;
  label: string;
  description: string;
  count: number;
  tone: "default" | "success" | "warning" | "danger";
  href?: string;
}

export interface OrderListItem {
  branchCode: number;
  orderCode: string;
  txlogisticId: string;
  customerName: string;
  statusOrder: string;
  internalStatus: string;
  shippingCompanyCode: number | null;
  shippingCompanyName: string | null;
  invoiceNumber: string | null;
  totalAmountOrder: string | null;
  lastSyncedAt: string;
  pickupStatus: string | null;
  billCode: string | null;
  openIssueReason: string | null;
  openIssueSeverity: string | null;
}

export interface IssueListItem {
  id: string;
  branchCode: number;
  orderCode: string;
  txlogisticId: string | null;
  issueType: string;
  severity: string;
  status: string;
  reason: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolutionNote: string | null;
}

export interface ReprocessRequestItem {
  id: string;
  branchCode: number;
  orderCode: string;
  txlogisticId: string | null;
  status: string;
  reason: string;
  requestedBy: string;
  attempts: number;
  jtSendEnabled: boolean;
  forceSend: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
}

export interface OrderDetail {
  order: Record<string, unknown> | null;
  pickups: Record<string, unknown>[];
  operationalIssues: Record<string, unknown>[];
  integrationErrors: Record<string, unknown>[];
  processingEvents: Record<string, unknown>[];
  orderOverrides: Record<string, unknown>[];
  reprocessRequests: Record<string, unknown>[];
  reprocessAttempts: Record<string, unknown>[];
  canReprocess: boolean;
  reprocessBlockReason: string | null;
}

export interface OrdersFilters {
  branchCode?: number;
  orderCode?: number;
  statusOrder?: string;
  issueStatus?: "open" | "resolved" | "ignored";
  issueSeverity?: string;
  query?: string;
  limit?: number;
}
