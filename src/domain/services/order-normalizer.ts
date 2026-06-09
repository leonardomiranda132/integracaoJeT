import type { SalesOrder } from "../models/order.js";

export interface NormalizedOrder {
  order: SalesOrder;
  totalQuantity: number;
  totalWeightKg: number;
}

export class OrderNormalizer {
  normalize(order: SalesOrder): NormalizedOrder {
    const totalQuantity = order.items.reduce(
      (sum, item) =>
        sum + (item.pendingQuantity && item.pendingQuantity > 0
          ? item.pendingQuantity
          : item.quantity),
      0,
    );

    const itemsWeightKg = order.items.reduce(
      (sum, item) => sum + (item.weightKg ?? 0),
      0,
    );
    const invoiceWeightKg = order.invoices?.reduce((highestWeight, invoice) => {
      const candidateWeight = invoice.grossWeightKg ?? invoice.netWeightKg ?? 0;
      return candidateWeight > highestWeight ? candidateWeight : highestWeight;
    }, 0);
    const totalWeightKg = itemsWeightKg || invoiceWeightKg || 0.01;

    return {
      order,
      totalQuantity,
      totalWeightKg,
    };
  }
}
