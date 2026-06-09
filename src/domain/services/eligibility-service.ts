import type { SalesOrder } from "../models/order.js";

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export class EligibilityService {
  evaluate(order: SalesOrder): EligibilityResult {
    const reasons: string[] = [];
    const hasInvoice =
      Boolean(order.invoiceNumber) ||
      Boolean(order.invoiceAccessKey) ||
      Boolean(order.invoices?.length);

    if (!order.shippingAddress) {
      reasons.push("missing-shipping-address");
    }

    if (order.items.length === 0) {
      reasons.push("missing-items");
    }

    if (!hasInvoice) {
      reasons.push("missing-invoice");
    }

    if (order.statusOrder === "Canceled") {
      reasons.push("canceled");
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  isEligible(order: SalesOrder): boolean {
    return this.evaluate(order).eligible;
  }
}
