import type { TotvsSettings } from "../../config/settings.js";
import type {
  CustomerPhone,
  InvoiceData,
  OrderItem,
  SalesOrder,
  ShippingAddress,
} from "../../domain/models/order.js";
import { IntegrationError } from "../../domain/errors/integration-error.js";
import type { TimeWindow } from "../../shared/types.js";
import type { HttpClient } from "./http-client.js";

interface TotvsTokenResponse {
  access_token: string;
}

interface TotvsRawShippingAddress {
  address?: string | null;
  number?: string | number | null;
  complement?: string | null;
  neighborhood?: string | null;
  cityName?: string | null;
  stateAbbreviation?: string | null;
  cep?: string | number | null;
}

interface TotvsRawItem {
  productCode?: number | null;
  productSku?: string | null;
  name?: string | null;
  quantity?: number | null;
  pendingQuantity?: number | null;
  price?: number | null;
  referenceCode?: string | null;
  referenceName?: string | null;
  colorCode?: string | null;
  colorName?: string | null;
  sizeName?: string | null;
}

interface TotvsRawInvoice {
  code?: string | number | null;
  serial?: string | null;
  accessKey?: string | null;
  totalValue?: number | null;
  productValue?: number | null;
  grossWeight?: number | null;
  netWeight?: number | null;
}

export interface TotvsRawOrder {
  branchCode: number;
  orderCode: number;
  orderId?: string;
  customerCode?: number | null;
  customerName?: string | null;
  customerCpfCnpj?: string | null;
  shippingCompanyCode?: number | null;
  shippingCompanyName?: string | null;
  shippingService?: string | null;
  statusOrder?: string | null;
  maxChangeFilterDate?: string | null;
  totalAmountOrder?: number | null;
  shippingAddress?: TotvsRawShippingAddress | null;
  items?: TotvsRawItem[] | null;
  invoices?: TotvsRawInvoice[] | null;
}

interface TotvsRawSearchResponse {
  items?: TotvsRawOrder[] | null;
  data?: TotvsRawOrder[] | null;
  count?: number | null;
  hasNext?: boolean | null;
  totalItems?: number | null;
  totalPages?: number | null;
}

export interface TotvsSearchOrdersResult {
  orders: SalesOrder[];
  pagesRead: number;
}

export interface TotvsSearchOrdersOptions {
  onPageRead?: (page: number, ordersRead: number) => void;
  orderCodeList?: number[];
  useChangeFilter?: boolean;
}

function getResponseOrders(response: TotvsRawSearchResponse): TotvsRawOrder[] {
  if (Array.isArray(response.items)) {
    return response.items;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return [];
}

function shouldReadNextPage(
  response: TotvsRawSearchResponse,
  page: number,
  pageSize: number,
  itemsCount: number,
): boolean {
  if (response.hasNext === false) {
    return false;
  }

  if (
    typeof response.totalPages === "number" &&
    Number.isFinite(response.totalPages) &&
    page >= response.totalPages
  ) {
    return false;
  }

  if (itemsCount === 0) {
    return false;
  }

  if (itemsCount < pageSize) {
    return false;
  }

  return true;
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

function toOptionalString(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
}

function toOptionalNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapShippingAddress(
  rawAddress: TotvsRawShippingAddress | null | undefined,
): ShippingAddress | undefined {
  if (!rawAddress) {
    return undefined;
  }

  const postCode = toOptionalString(rawAddress.cep);
  const street = toOptionalString(rawAddress.address);
  const streetNumber = toOptionalString(rawAddress.number);
  const neighborhood = toOptionalString(rawAddress.neighborhood);
  const city = toOptionalString(rawAddress.cityName);
  const state = toOptionalString(rawAddress.stateAbbreviation);

  if (!postCode || !street || !streetNumber || !neighborhood || !city || !state) {
    return undefined;
  }

  return {
    postCode,
    street,
    streetNumber,
    neighborhood,
    city,
    state,
    complement: toOptionalString(rawAddress.complement),
  };
}

function mapOrderItem(rawItem: TotvsRawItem): OrderItem {
  return {
    sku:
      toOptionalString(rawItem.productSku) ??
      toOptionalString(rawItem.productCode) ??
      "SKU_NAO_INFORMADO",
    description:
      toOptionalString(rawItem.name) ??
      toOptionalString(rawItem.referenceName) ??
      "ITEM_NAO_INFORMADO",
    quantity: toOptionalNumber(rawItem.quantity) ?? 0,
    pendingQuantity: toOptionalNumber(rawItem.pendingQuantity),
    unitPrice: toOptionalNumber(rawItem.price),
    productCode: toOptionalNumber(rawItem.productCode),
    referenceCode: toOptionalString(rawItem.referenceCode),
    referenceName: toOptionalString(rawItem.referenceName),
    colorCode: toOptionalString(rawItem.colorCode),
    colorName: toOptionalString(rawItem.colorName),
    sizeName: toOptionalString(rawItem.sizeName),
  };
}

function mapInvoice(rawInvoice: TotvsRawInvoice): InvoiceData {
  return {
    invoiceNumber: toOptionalString(rawInvoice.code),
    invoiceSerialNumber: toOptionalString(rawInvoice.serial),
    invoiceAccessKey: toOptionalString(rawInvoice.accessKey),
    invoiceMoney:
      toOptionalNumber(rawInvoice.totalValue) ??
      toOptionalNumber(rawInvoice.productValue),
    grossWeightKg: toOptionalNumber(rawInvoice.grossWeight),
    netWeightKg: toOptionalNumber(rawInvoice.netWeight),
  };
}

export function mapTotvsOrder(rawOrder: TotvsRawOrder): SalesOrder {
  const invoices = (rawOrder.invoices ?? []).map(mapInvoice);
  const firstInvoice = invoices[0];
  const phones: CustomerPhone[] | undefined = undefined;

  return {
    branchCode: rawOrder.branchCode,
    orderCode: rawOrder.orderCode,
    orderId: rawOrder.orderId,
    customerCode: toOptionalNumber(rawOrder.customerCode),
    customerName: toOptionalString(rawOrder.customerName) ?? "CLIENTE_NAO_INFORMADO",
    customerCpfCnpj: toOptionalString(rawOrder.customerCpfCnpj),
    phones,
    shippingCompanyCode: toOptionalNumber(rawOrder.shippingCompanyCode),
    shippingCompanyName: toOptionalString(rawOrder.shippingCompanyName),
    shippingService: toOptionalString(rawOrder.shippingService),
    statusOrder: toOptionalString(rawOrder.statusOrder) ?? "UNKNOWN",
    maxChangeFilterDate: toOptionalString(rawOrder.maxChangeFilterDate) ?? "",
    totalAmountOrder: toOptionalNumber(rawOrder.totalAmountOrder),
    shippingAddress: mapShippingAddress(rawOrder.shippingAddress),
    items: (rawOrder.items ?? []).map(mapOrderItem),
    invoiceNumber: firstInvoice?.invoiceNumber,
    invoiceSerialNumber: firstInvoice?.invoiceSerialNumber,
    invoiceAccessKey: firstInvoice?.invoiceAccessKey,
    invoiceMoney: firstInvoice?.invoiceMoney,
    invoices,
  };
}

export class TotvsClient {
  constructor(
    private readonly settings: TotvsSettings,
    private readonly httpClient: HttpClient,
  ) {}

  async authenticate(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: this.settings.clientId,
      client_secret: this.settings.clientSecret,
      username: this.settings.username,
      password: this.settings.password,
    });

    if (this.settings.branch) {
      body.set("branch", this.settings.branch);
    }

    const response = await this.httpClient.request<TotvsTokenResponse>({
      method: "POST",
      url: this.settings.authUrl,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    return response.access_token;
  }

  async searchOrders(window: TimeWindow): Promise<SalesOrder[]> {
    const result = await this.searchOrdersWithMetadata(window);
    return result.orders;
  }

  async searchOrdersWithMetadata(
    window: TimeWindow,
    options: TotvsSearchOrdersOptions = {},
  ): Promise<TotvsSearchOrdersResult> {
    const token = await this.authenticate();
    const ordersSearchUrl = this.settings.salesOrderBaseUrl
      ? `${this.settings.salesOrderBaseUrl.replace(/\/$/, "")}/orders/search`
      : `${this.settings.baseUrl}/api/totvsmoda/sales-order/v2/orders/search`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    };

    if (this.settings.apiKey) {
      headers["x-api-key"] = this.settings.apiKey;
    }

    const orders: SalesOrder[] = [];
    let pagesRead = 0;

    for (let page = 1; page <= this.settings.orderMaxPages; page += 1) {
      const response = await this.httpClient.request<TotvsRawSearchResponse>({
        method: "POST",
        url: ordersSearchUrl,
        headers,
        body: JSON.stringify({
          filter: {
            branchCodeList: this.settings.branchCodeList,
            change: options.useChangeFilter === false ? undefined : window,
            orderCodeList:
              options.orderCodeList && options.orderCodeList.length > 0
                ? options.orderCodeList
                : undefined,
            orderStatusList: this.settings.orderStatusList,
            shippingCompanyCode: this.settings.shippingCompanyCode,
            hasShippingCompany: true,
            hasFinancialProcessed: true,
          },
          expand: this.settings.orderExpand,
          order: "branchCode,orderCode,maxChangeFilterDate",
          page,
          pageSize: this.settings.orderPageSize,
        }),
      });

      const pageOrders = getResponseOrders(response);
      pagesRead = page;
      options.onPageRead?.(page, pageOrders.length);
      orders.push(
        ...filterByShippingCompanyCode(
          pageOrders.map(mapTotvsOrder),
          this.settings.shippingCompanyCode,
        ),
      );

      if (
        !shouldReadNextPage(
          response,
          page,
          this.settings.orderPageSize,
          pageOrders.length,
        )
      ) {
        return {
          orders,
          pagesRead,
        };
      }
    }

    throw new IntegrationError("Limite maximo de paginas TOTVS atingido.", {
      orderMaxPages: this.settings.orderMaxPages,
      orderPageSize: this.settings.orderPageSize,
      pagesRead,
      ordersRead: orders.length,
    });
  }
}
