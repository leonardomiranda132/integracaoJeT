import type { JtSettings } from "../../config/settings.js";
import { IntegrationError } from "../errors/integration-error.js";
import type { OrderItem } from "../models/order.js";
import type { PickupItem, PickupRequestPayload } from "../models/pickup.js";
import type { NormalizedOrder } from "./order-normalizer.js";

function itemQuantity(item: OrderItem): number {
  return item.pendingQuantity && item.pendingQuantity > 0
    ? item.pendingQuantity
    : item.quantity;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function allocateItemValues(
  items: OrderItem[],
  declaredTotal: number | undefined,
): Array<string | undefined> {
  const lineValues = items.map((item) => {
    const quantity = itemQuantity(item);
    return item.unitPrice !== undefined ? item.unitPrice * quantity : undefined;
  });
  const rawTotal = lineValues.reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );

  if (!rawTotal) {
    return lineValues.map((value) =>
      value !== undefined ? formatMoney(value) : undefined,
    );
  }

  if (declaredTotal === undefined || !Number.isFinite(declaredTotal)) {
    return lineValues.map((value) =>
      value !== undefined ? formatMoney(value) : undefined,
    );
  }

  const declaredTotalCents = Math.round(declaredTotal * 100);
  const proportionalValues = lineValues.map((value) => {
    if (value === undefined) {
      return { cents: 0, remainder: 0, hasValue: false };
    }

    const exactCents = (value / rawTotal) * declaredTotalCents;
    return {
      cents: Math.floor(exactCents),
      remainder: exactCents - Math.floor(exactCents),
      hasValue: true,
    };
  });
  let remainingCents =
    declaredTotalCents -
    proportionalValues.reduce((sum, item) => sum + item.cents, 0);

  proportionalValues
    .map((value, index) => ({ ...value, index }))
    .filter((value) => value.hasValue)
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((value) => {
      if (remainingCents <= 0) {
        return;
      }

      proportionalValues[value.index].cents += 1;
      remainingCents -= 1;
    });

  return proportionalValues.map((value) =>
    value.hasValue ? formatMoney(value.cents / 100) : undefined,
  );
}

export class PickupPayloadBuilder {
  constructor(private readonly settings: JtSettings) {}

  build(input: {
    txlogisticId: string;
    normalizedOrder: NormalizedOrder;
    bizDigest: string;
  }): PickupRequestPayload {
    const { order, totalWeightKg } = input.normalizedOrder;
    const address = order.shippingAddress;
    const firstInvoice = order.invoices?.[0];
    const receiverMobile =
      order.customerMobile ??
      order.customerPhone ??
      this.settings.receiverFallbackPhone;
    const receiverPhone =
      order.customerPhone ??
      order.customerMobile ??
      this.settings.receiverFallbackPhone;
    const declaredItemsTotal =
      order.invoiceMoney ?? order.totalAmountOrder ?? firstInvoice?.invoiceMoney;
    const itemValues = allocateItemValues(order.items, declaredItemsTotal);
    const items: PickupItem[] = order.items.map((item, index) => ({
      itemType: this.settings.goodsType,
      itemName: item.description.slice(0, 30),
      number: String(itemQuantity(item)),
      itemValue: itemValues[index],
      desc: item.description.slice(0, 100),
    }));

    if (!address) {
      throw new IntegrationError("Pedido sem endereco de entrega para coleta.", {
        orderCode: order.orderCode,
      });
    }

    return {
      txlogisticId: input.txlogisticId,
      expressType: this.settings.expressType,
      orderType: this.settings.orderType,
      serviceType: this.settings.serviceType,
      deliveryType: this.settings.deliveryType,
      payType: this.settings.payType,
      customerCode: this.settings.customerCode,
      digest: input.bizDigest,
      sender: this.settings.senderFallback,
      receiver: {
        name: order.customerName,
        taxNumber: order.customerCpfCnpj,
        mobile: receiverMobile,
        phone: receiverPhone,
        postCode: address.postCode,
        prov: address.state,
        city: address.city,
        area: address.neighborhood,
        street: address.street,
        streetNumber: address.streetNumber,
        address: [
          address.street,
          address.streetNumber,
          address.complement,
          address.neighborhood,
          address.city,
          address.state,
          address.postCode,
        ]
          .filter(Boolean)
          .join(", "),
      },
      sendStartTime: this.settings.sendStartTime,
      sendEndTime: this.settings.sendEndTime,
      goodsType: this.settings.goodsType,
      weight: totalWeightKg,
      // Neste fluxo a J&T sempre recebe volume unico, mesmo quando o pedido
      // contem varios itens.
      totalQuantity: 1,
      items,
      invoiceType: this.settings.invoiceType,
      invoiceNumber: order.invoiceNumber ?? firstInvoice?.invoiceNumber,
      invoiceSerialNumber:
        order.invoiceSerialNumber ?? firstInvoice?.invoiceSerialNumber,
      taxCode: order.invoiceNumber ?? firstInvoice?.invoiceNumber,
      invoiceAccessKey: order.invoiceAccessKey ?? firstInvoice?.invoiceAccessKey,
      invoiceMoney:
        order.invoiceMoney ?? order.totalAmountOrder ?? firstInvoice?.invoiceMoney,
      remark: `Pedido ${order.branchCode}-${order.orderCode}`,
    };
  }
}
