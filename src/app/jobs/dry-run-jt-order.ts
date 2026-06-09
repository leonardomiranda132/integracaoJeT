import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadSettings } from "../../config/settings.js";
import type { CustomerPhone, SalesOrder } from "../../domain/models/order.js";
import { IdempotencyService } from "../../domain/services/idempotency-service.js";
import { OrderNormalizer } from "../../domain/services/order-normalizer.js";
import { PickupPayloadBuilder } from "../../domain/services/pickup-payload-builder.js";
import { PickupValidator } from "../../domain/validators/pickup-validator.js";
import { FetchHttpClient } from "../../infrastructure/http/fetch-http-client.js";
import { JtClient } from "../../infrastructure/http/jt-client.js";
import { JtSignatureService } from "../../infrastructure/http/jt-signature-service.js";
import { PersonClient } from "../../infrastructure/http/person-client.js";
import {
  mapTotvsOrder,
  type TotvsRawOrder,
} from "../../infrastructure/http/totvs-client.js";

function pickPhoneByType(phones: CustomerPhone[], typeName: string): string | undefined {
  return phones.find((phone) => phone.typeName?.toUpperCase() === typeName)?.number;
}

function pickDefaultPhone(phones: CustomerPhone[]): string | undefined {
  return phones.find((phone) => phone.isDefault)?.number ?? phones[0]?.number;
}

async function enrichOrderWithPhones(
  personClient: PersonClient,
  order: SalesOrder,
): Promise<SalesOrder> {
  if (!order.customerCode) {
    return order;
  }

  const phones = await personClient.searchPhonesByCustomerCode(order.customerCode);
  if (phones.length === 0) {
    return order;
  }

  return {
    ...order,
    phones,
    customerMobile:
      pickPhoneByType(phones, "CELULAR") ??
      pickPhoneByType(phones, "MOBILE") ??
      pickPhoneByType(phones, "FIXO") ??
      pickDefaultPhone(phones),
    customerPhone: pickPhoneByType(phones, "FIXO") ?? pickDefaultPhone(phones),
  };
}

async function loadOrderFromFile(filePath: string, index: number): Promise<SalesOrder> {
  const contents = await readFile(filePath, "utf8");
  const parsed = JSON.parse(contents) as { orders?: TotvsRawOrder[] };
  const rawOrder = parsed.orders?.[index];

  if (!rawOrder) {
    throw new Error(`Pedido na posicao ${index} nao encontrado em ${filePath}.`);
  }

  return mapTotvsOrder(rawOrder);
}

async function main(): Promise<void> {
  const settings = loadSettings();
  const httpClient = new FetchHttpClient();
  const personClient = new PersonClient(settings.totvs, httpClient);
  const jtClient = new JtClient(
    settings.jt,
    httpClient,
    new JtSignatureService(settings.jt),
  );
  const payloadBuilder = new PickupPayloadBuilder(settings.jt);
  const payloadValidator = new PickupValidator();
  const idempotencyService = new IdempotencyService({
    existsByTxlogisticId: async () => false,
    reserve: async () => true,
    save: async () => undefined,
    markFailed: async () => undefined,
  });
  const inputFile = resolve(
    process.cwd(),
    process.env.DRY_RUN_INPUT_FILE ?? "docs/attended-jet-orders.json",
  );
  const outputFile = resolve(
    process.cwd(),
    process.env.DRY_RUN_OUTPUT_FILE ?? "docs/jt-order-dry-run.json",
  );
  const orderIndex = Number(process.env.DRY_RUN_ORDER_INDEX ?? "0");
  const baseOrder = await loadOrderFromFile(inputFile, orderIndex);
  const order = await enrichOrderWithPhones(personClient, baseOrder);
  const normalizedOrder = new OrderNormalizer().normalize(order);
  const payload = payloadBuilder.build({
    txlogisticId: idempotencyService.buildTxlogisticId(order),
    normalizedOrder,
    bizDigest: jtClient.createBusinessDigest(),
  });

  payloadValidator.validate(payload);

  const request = jtClient.buildAddOrderRequest(payload, 1760000000000);
  const output = {
    sourceFile: inputFile,
    orderIndex,
    orderSummary: {
      branchCode: order.branchCode,
      orderCode: order.orderCode,
      customerCode: order.customerCode,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerMobile: order.customerMobile,
      weight: normalizedOrder.totalWeightKg,
      itemQuantity: normalizedOrder.totalQuantity,
      packageQuantity: payload.totalQuantity,
    },
    payload,
    bizContentJson: request.bizContentJson,
    requestHeaders: request.headers,
    formBody: request.formBody,
  };

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(output, null, 2), "utf8");
  console.log(JSON.stringify({ outputFile, orderSummary: output.orderSummary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
