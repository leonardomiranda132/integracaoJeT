export interface ShippingAddress {
  postCode: string;
  street: string;
  streetNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  complement?: string;
}

export interface CustomerPhone {
  sequence?: number;
  typeCode?: number;
  typeName?: string;
  number: string;
  isDefault?: boolean;
}

export interface OrderItem {
  sku: string;
  description: string;
  quantity: number;
  pendingQuantity?: number;
  weightKg?: number;
  unitPrice?: number;
  productCode?: number;
  referenceCode?: string;
  referenceName?: string;
  colorCode?: string;
  colorName?: string;
  sizeName?: string;
}

export interface InvoiceData {
  invoiceNumber?: string;
  invoiceSerialNumber?: string;
  invoiceAccessKey?: string;
  invoiceMoney?: number;
  grossWeightKg?: number;
  netWeightKg?: number;
}

export interface SalesOrder {
  branchCode: number;
  orderCode: number;
  orderId?: string;
  customerCode?: number;
  customerName: string;
  customerCpfCnpj?: string;
  customerPhone?: string;
  customerMobile?: string;
  phones?: CustomerPhone[];
  shippingCompanyCode?: number;
  shippingCompanyName?: string;
  shippingService?: string;
  statusOrder: string;
  maxChangeFilterDate: string;
  totalAmountOrder?: number;
  shippingAddress?: ShippingAddress;
  items: OrderItem[];
  invoiceNumber?: string;
  invoiceSerialNumber?: string;
  invoiceAccessKey?: string;
  invoiceMoney?: number;
  invoices?: InvoiceData[];
}
