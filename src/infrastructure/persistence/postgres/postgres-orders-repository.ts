import type { SalesOrder } from "../../../domain/models/order.js";
import type { OrdersRepository } from "../repositories/orders-repository.js";
import { toJsonb } from "./json.js";
import type { PostgresDatabase } from "./postgres-database.js";

export class PostgresOrdersRepository implements OrdersRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async upsert(order: SalesOrder): Promise<void> {
    await this.db.query(
      `
        INSERT INTO orders (
          branch_code,
          order_code,
          order_id,
          customer_code,
          customer_name,
          customer_cpf_cnpj,
          customer_phone,
          customer_mobile,
          shipping_company_code,
          shipping_company_name,
          shipping_service,
          status_order,
          max_change_filter_date,
          total_amount_order,
          invoice_number,
          invoice_serial_number,
          invoice_access_key,
          invoice_money,
          shipping_address,
          phones,
          items,
          invoices,
          raw_order,
          internal_status,
          last_synced_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, 'found', now()
        )
        ON CONFLICT (branch_code, order_code)
        DO UPDATE SET
          order_id = EXCLUDED.order_id,
          customer_code = EXCLUDED.customer_code,
          customer_name = EXCLUDED.customer_name,
          customer_cpf_cnpj = EXCLUDED.customer_cpf_cnpj,
          customer_phone = EXCLUDED.customer_phone,
          customer_mobile = EXCLUDED.customer_mobile,
          shipping_company_code = EXCLUDED.shipping_company_code,
          shipping_company_name = EXCLUDED.shipping_company_name,
          shipping_service = EXCLUDED.shipping_service,
          status_order = EXCLUDED.status_order,
          max_change_filter_date = EXCLUDED.max_change_filter_date,
          total_amount_order = EXCLUDED.total_amount_order,
          invoice_number = EXCLUDED.invoice_number,
          invoice_serial_number = EXCLUDED.invoice_serial_number,
          invoice_access_key = EXCLUDED.invoice_access_key,
          invoice_money = EXCLUDED.invoice_money,
          shipping_address = EXCLUDED.shipping_address,
          phones = EXCLUDED.phones,
          items = EXCLUDED.items,
          invoices = EXCLUDED.invoices,
          raw_order = EXCLUDED.raw_order,
          internal_status = EXCLUDED.internal_status,
          last_synced_at = EXCLUDED.last_synced_at,
          updated_at = now()
      `,
      [
        order.branchCode,
        order.orderCode,
        order.orderId,
        order.customerCode,
        order.customerName,
        order.customerCpfCnpj,
        order.customerPhone,
        order.customerMobile,
        order.shippingCompanyCode,
        order.shippingCompanyName,
        order.shippingService,
        order.statusOrder,
        order.maxChangeFilterDate,
        order.totalAmountOrder,
        order.invoiceNumber,
        order.invoiceSerialNumber,
        order.invoiceAccessKey,
        order.invoiceMoney,
        toJsonb(order.shippingAddress ?? null),
        toJsonb(order.phones ?? []),
        toJsonb(order.items),
        toJsonb(order.invoices ?? []),
        toJsonb(order),
      ],
    );
  }
}
