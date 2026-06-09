import { loadSettings } from "../../config/settings.js";
import { FetchHttpClient } from "../../infrastructure/http/fetch-http-client.js";
import { ConsoleLogger } from "../../infrastructure/logging/logger.js";
import { TotvsClient } from "../../infrastructure/http/totvs-client.js";
import { sanitizeForLogging } from "../../infrastructure/logging/sanitizer.js";
import type { SalesOrder } from "../../domain/models/order.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

interface SearchAttempt {
  label: string;
  payload: Record<string, unknown>;
}

interface TotvsSearchResponse {
  items?: SalesOrder[];
  data?: SalesOrder[];
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildIsoAtLocalTime(date: Date, time: string): string {
  const [hours, minutes, seconds] = time.split(":");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function pickSampleOrder(order: SalesOrder | undefined): Record<string, unknown> | null {
  if (!order) {
    return null;
  }

  return {
    branchCode: order.branchCode,
    orderCode: order.orderCode,
    orderId: order.orderId,
    customerName: order.customerName,
    customerCpfCnpj: order.customerCpfCnpj,
    shippingCompanyName: order.shippingCompanyName,
    shippingService: order.shippingService,
    statusOrder: order.statusOrder,
    maxChangeFilterDate: order.maxChangeFilterDate,
    totalAmountOrder: order.totalAmountOrder,
    shippingAddress: order.shippingAddress,
    itemsCount: order.items.length,
    firstItem: order.items[0] ?? null,
    invoicesCount: order.invoices?.length ?? 0,
    firstInvoice: order.invoices?.[0] ?? null,
  };
}

function filterByShippingCompanyCode(
  orders: SalesOrder[],
  shippingCompanyCode: number | undefined,
): SalesOrder[] {
  if (shippingCompanyCode === undefined) {
    return orders;
  }

  return orders.filter((order) => order.shippingCompanyCode === shippingCompanyCode);
}

async function main(): Promise<void> {
  const settings = loadSettings();
  const logger = new ConsoleLogger();
  const httpClient = new FetchHttpClient();
  const totvsClient = new TotvsClient(settings.totvs, httpClient);
  const shippingCompanyFilter = normalizeText(
    process.env.SMOKE_SHIPPING_COMPANY_NAME,
  );
  const shippingCompanyCodeFilter = parseOptionalNumber(
    process.env.SMOKE_SHIPPING_COMPANY_CODE,
  );
  const outputFile = process.env.SMOKE_OUTPUT_FILE
    ? resolve(process.cwd(), process.env.SMOKE_OUTPUT_FILE)
    : undefined;
  const token = await totvsClient.authenticate();
  const ordersSearchUrl = settings.totvs.salesOrderBaseUrl
    ? `${settings.totvs.salesOrderBaseUrl.replace(/\/$/, "")}/orders/search`
    : `${settings.totvs.baseUrl}/api/totvsmoda/sales-order/v2/orders/search`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };

  if (settings.totvs.apiKey) {
    headers["x-api-key"] = settings.totvs.apiKey;
  }

  const now = new Date();
  const attempts: SearchAttempt[] = [
    {
      label: "Mesmo dia com status configurado",
      payload: {
        filter: {
          branchCodeList: settings.totvs.branchCodeList,
          change: {
            startDate: buildIsoAtLocalTime(now, "00:00:00"),
            endDate: buildIsoAtLocalTime(now, "23:59:59"),
          },
          orderStatusList: settings.totvs.orderStatusList,
          shippingCompanyCode: shippingCompanyCodeFilter,
          hasShippingCompany: true,
          hasFinancialProcessed: true,
        },
        expand: settings.totvs.orderExpand,
        order: "branchCode,orderCode,maxChangeFilterDate",
        page: 1,
        pageSize: settings.totvs.orderPageSize,
      },
    },
    {
      label: "Ultimos 7 dias com status configurado",
      payload: {
        filter: {
          branchCodeList: settings.totvs.branchCodeList,
          change: {
            startDate: buildIsoAtLocalTime(subtractDays(now, 7), "00:00:00"),
            endDate: buildIsoAtLocalTime(now, "23:59:59"),
          },
          orderStatusList: settings.totvs.orderStatusList,
          shippingCompanyCode: shippingCompanyCodeFilter,
          hasShippingCompany: true,
          hasFinancialProcessed: true,
        },
        expand: settings.totvs.orderExpand,
        order: "branchCode,orderCode,maxChangeFilterDate",
        page: 1,
        pageSize: settings.totvs.orderPageSize,
      },
    },
    {
      label: "Ultimos 30 dias sem status",
      payload: {
        filter: {
          branchCodeList: settings.totvs.branchCodeList,
          change: {
            startDate: buildIsoAtLocalTime(subtractDays(now, 30), "00:00:00"),
            endDate: buildIsoAtLocalTime(now, "23:59:59"),
          },
          shippingCompanyCode: shippingCompanyCodeFilter,
          hasShippingCompany: true,
          hasFinancialProcessed: true,
        },
        expand: settings.totvs.orderExpand,
        order: "branchCode,orderCode,maxChangeFilterDate",
        page: 1,
        pageSize: settings.totvs.orderPageSize,
      },
    },
    {
      label: "Ultimos 30 dias sem filtros extras",
      payload: {
        filter: {
          branchCodeList: settings.totvs.branchCodeList,
          change: {
            startDate: buildIsoAtLocalTime(subtractDays(now, 30), "00:00:00"),
            endDate: buildIsoAtLocalTime(now, "23:59:59"),
          },
          shippingCompanyCode: shippingCompanyCodeFilter,
        },
        expand: settings.totvs.orderExpand,
        order: "branchCode,orderCode,maxChangeFilterDate",
        page: 1,
        pageSize: settings.totvs.orderPageSize,
      },
    },
  ];

  logger.info("Iniciando smoke test ampliado da consulta de pedidos no TOTVS.", {
    branchCodes: settings.totvs.branchCodeList,
    configuredOrderStatuses: settings.totvs.orderStatusList,
    shippingCompanyFilter: shippingCompanyFilter || null,
    shippingCompanyCodeFilter: shippingCompanyCodeFilter ?? null,
    attempts: attempts.map((attempt) => attempt.label),
  });

  for (const attempt of attempts) {
    logger.info("Executando tentativa de consulta.", {
      attempt: attempt.label,
      payload: attempt.payload,
    });

    const response = await httpClient.request<TotvsSearchResponse>({
      method: "POST",
      url: ordersSearchUrl,
      headers,
      body: JSON.stringify(attempt.payload),
    });

    const rawOrders = response.items ?? response.data ?? [];
    const ordersByCode = filterByShippingCompanyCode(
      rawOrders,
      shippingCompanyCodeFilter,
    );
    const orders = shippingCompanyFilter
      ? ordersByCode.filter(
          (order) =>
            normalizeText(order.shippingCompanyName) === shippingCompanyFilter,
        )
      : ordersByCode;
    logger.info("Tentativa concluida.", {
      attempt: attempt.label,
      totalOrders: orders.length,
      totalOrdersBeforeShippingFilter: rawOrders.length,
      sampleOrderCodes: orders.slice(0, 5).map((order) => order.orderCode),
    });

    if (orders.length > 0) {
      if (outputFile) {
        await mkdir(dirname(outputFile), { recursive: true });
        await writeFile(
          outputFile,
          JSON.stringify(
            {
              attempt: attempt.label,
              requestBody: attempt.payload,
              totalOrders: orders.length,
              totalOrdersBeforeShippingFilter: rawOrders.length,
              orders,
            },
            null,
            2,
          ),
          "utf8",
        );
        logger.info("Retorno salvo em arquivo JSON.", {
          outputFile,
        });
      }

      console.log(
        JSON.stringify(
          sanitizeForLogging({
            attempt: attempt.label,
            totalOrders: orders.length,
            sampleOrder: pickSampleOrder(orders[0]),
          }),
          null,
          2,
        ),
      );
      return;
    }
  }

  logger.info("Nenhum pedido encontrado nas tentativas configuradas.", {
    attempts: attempts.map((attempt) => attempt.label),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
