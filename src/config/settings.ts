import { loadEnvFile } from "./env.js";
import { IntegrationError } from "../domain/errors/integration-error.js";
import type { PickupParty } from "../domain/models/pickup.js";

loadEnvFile();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new IntegrationError(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value;
}

function requiredOneOf(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  throw new IntegrationError(
    `Variavel de ambiente obrigatoria ausente: ${names.join(" ou ")}`,
  );
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberList(value: string): number[] {
  return parseList(value).map((item) => Number(item));
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Math.floor(parseNumber(value, fallback));
  return parsed > 0 ? parsed : fallback;
}

function parseOptionalNonNegativeInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

export type PersistenceAdapter = "memory" | "postgres";

function parsePersistenceAdapter(value: string): PersistenceAdapter {
  if (value === "memory" || value === "postgres") {
    return value;
  }

  throw new IntegrationError(
    `PERSISTENCE_ADAPTER invalido: ${value}. Use memory ou postgres.`,
  );
}

export interface TotvsSettings {
  baseUrl: string;
  authUrl: string;
  salesOrderBaseUrl?: string;
  apiKey?: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  branch?: string;
  branchCodeList: number[];
  shippingCompanyCode?: number;
  orderStatusList: string[];
  orderExpand: string;
  orderPageSize: number;
  orderMaxPages: number;
}

export interface JtSettings {
  baseUrl: string;
  apiAccount: string;
  privateKey: string;
  customerCode: string;
  customerPassword: string;
  expressType: string;
  orderType: string;
  serviceType: string;
  deliveryType: string;
  payType?: string;
  goodsType: string;
  invoiceType: string;
  sendStartTime?: string;
  sendEndTime?: string;
  receiverFallbackPhone: string;
  senderFallback: PickupParty;
}

export interface PostgresSettings {
  connectionString: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
  poolMax: number;
  migrationsDirectory: string;
}

export interface OperationalSettings {
  jtSendEnabled: boolean;
  dailySendLimit?: number;
}

export interface AppSettings {
  timezone: string;
  dailySyncCron: string;
  persistenceAdapter: PersistenceAdapter;
  operational: OperationalSettings;
  postgres?: PostgresSettings;
  totvs: TotvsSettings;
  jt: JtSettings;
}

export function loadPostgresSettings(): PostgresSettings {
  return {
    connectionString: requiredOneOf(["DATABASE_URL", "POSTGRES_URL"]),
    ssl: parseBoolean(process.env.POSTGRES_SSL, false),
    sslRejectUnauthorized: parseBoolean(
      process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED,
      true,
    ),
    poolMax: parseNumber(process.env.POSTGRES_POOL_MAX || "10", 10),
    migrationsDirectory: optional("DATABASE_MIGRATIONS_DIR", "database/migrations"),
  };
}

export function loadOperationalSettings(): OperationalSettings {
  const jtSendEnabled =
    process.env.JT_SEND_ENABLED === undefined
      ? !parseBoolean(process.env.INTEGRATION_DRY_RUN, false)
      : parseBoolean(process.env.JT_SEND_ENABLED, true);

  return {
    jtSendEnabled,
    dailySendLimit: parseOptionalNonNegativeInteger(process.env.DAILY_SEND_LIMIT),
  };
}

export function loadSettings(): AppSettings {
  const persistenceAdapter = parsePersistenceAdapter(
    optional("PERSISTENCE_ADAPTER", "memory"),
  );

  return {
    timezone: optional("APP_TIMEZONE", "America/Sao_Paulo"),
    dailySyncCron: optional("DAILY_SYNC_CRON", "0 17 * * *"),
    persistenceAdapter,
    operational: loadOperationalSettings(),
    postgres:
      persistenceAdapter === "postgres" ? loadPostgresSettings() : undefined,
    totvs: {
      baseUrl: requiredOneOf(["TOTVS_BASE_URL", "VIRTUAL_AGE_BASE_URL"]),
      authUrl: requiredOneOf(["TOTVS_AUTH_URL", "VIRTUAL_AGE_AUTH_URL"]),
      salesOrderBaseUrl:
        process.env.TOTVS_SALES_ORDER_BASE_URL ||
        process.env.VIRTUAL_AGE_SALES_ORDER_BASE_URL ||
        undefined,
      apiKey: process.env.TOTVS_API_KEY || process.env.VIRTUAL_AGE_X_API_KEY || undefined,
      clientId: requiredOneOf(["TOTVS_CLIENT_ID", "VIRTUAL_AGE_CLIENT_ID"]),
      clientSecret: requiredOneOf(["TOTVS_CLIENT_SECRET", "VIRTUAL_AGE_CLIENT_SECRET"]),
      username: requiredOneOf(["TOTVS_USERNAME", "VIRTUAL_AGE_USERNAME"]),
      password: requiredOneOf(["TOTVS_PASSWORD", "VIRTUAL_AGE_PASSWORD"]),
      branch: process.env.TOTVS_BRANCH || process.env.VIRTUAL_AGE_BRANCH || undefined,
      branchCodeList: parseNumberList(
        requiredOneOf(["TOTVS_BRANCH_CODE_LIST", "VIRTUAL_AGE_BRANCH_CODES"]),
      ),
      shippingCompanyCode: (() => {
        const value =
          process.env.TOTVS_SHIPPING_COMPANY_CODE ||
          process.env.VIRTUAL_AGE_SHIPPING_COMPANY_CODE;
        return value ? parseNumber(value, 0) || undefined : undefined;
      })(),
      orderStatusList: parseList(
        requiredOneOf(["TOTVS_ORDER_STATUS_LIST", "VIRTUAL_AGE_ORDER_STATUS_LIST"]),
      ),
      orderExpand:
        process.env.TOTVS_ORDER_EXPAND ||
        process.env.VIRTUAL_AGE_ORDER_EXPAND ||
        "items,invoices,shippingAddress",
      orderPageSize: parseNumber(
        process.env.TOTVS_ORDER_PAGE_SIZE ||
          process.env.VIRTUAL_AGE_ORDER_PAGE_SIZE ||
          "100",
        100,
      ),
      orderMaxPages: parsePositiveInteger(
        process.env.TOTVS_ORDER_MAX_PAGES ||
          process.env.VIRTUAL_AGE_ORDER_MAX_PAGES ||
          "100",
        100,
      ),
    },
    jt: {
      baseUrl: required("JT_BASE_URL"),
      apiAccount: required("JT_API_ACCOUNT"),
      privateKey: required("JT_PRIVATE_KEY"),
      customerCode: required("JT_CUSTOMER_CODE"),
      customerPassword: required("JT_CUSTOMER_PASSWORD"),
      expressType: optional("JT_EXPRESS_TYPE", "standard"),
      orderType: optional("JT_ORDER_TYPE", "2"),
      serviceType: optional("JT_SERVICE_TYPE", "01"),
      deliveryType: optional("JT_DELIVERY_TYPE", "03"),
      payType: process.env.JT_PAY_TYPE || undefined,
      goodsType: optional("JT_GOODS_TYPE", "3"),
      invoiceType: optional("JT_INVOICE_TYPE", "NFe"),
      sendStartTime: process.env.JT_SEND_START_TIME || undefined,
      sendEndTime: process.env.JT_SEND_END_TIME || undefined,
      receiverFallbackPhone: optional("JT_RECEIVER_FALLBACK_PHONE", "00000000000"),
      senderFallback: {
        name: optional("JT_SENDER_NAME", "REMETENTE NAO CONFIGURADO"),
        taxNumber: optional("JT_SENDER_TAX_NUMBER", ""),
        mobile: optional("JT_SENDER_MOBILE", "00000000000"),
        phone: optional("JT_SENDER_PHONE", "00000000000"),
        postCode: optional("JT_SENDER_POST_CODE", "00000000"),
        prov: optional("JT_SENDER_STATE", "SP"),
        city: optional("JT_SENDER_CITY", "SAO PAULO"),
        area: optional("JT_SENDER_AREA", "CENTRO"),
        street: optional("JT_SENDER_STREET", "RUA NAO CONFIGURADA"),
        streetNumber: optional("JT_SENDER_STREET_NUMBER", "0"),
        address: optional("JT_SENDER_ADDRESS", "RUA NAO CONFIGURADA, 0"),
        ieNumber: optional("JT_SENDER_IE_NUMBER", ""),
      },
    },
  };
}
