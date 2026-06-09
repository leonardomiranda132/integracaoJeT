export interface PickupParty {
  name: string;
  taxNumber?: string;
  mobile?: string;
  phone?: string;
  postCode: string;
  prov: string;
  city: string;
  area: string;
  street: string;
  streetNumber: string;
  address: string;
  ieNumber?: string;
}

export interface PickupItem {
  itemType: string;
  itemName: string;
  number: string;
  itemValue?: string;
  priceCurrency?: string;
  desc?: string;
  itemNcm?: string;
}

export interface PickupRequestPayload {
  txlogisticId: string;
  expressType: string;
  orderType: string;
  serviceType: string;
  deliveryType: string;
  payType?: string;
  customerCode: string;
  digest: string;
  sender: PickupParty;
  receiver: PickupParty;
  sendStartTime?: string;
  sendEndTime?: string;
  goodsType: string;
  weight: number;
  totalQuantity: number;
  itemsValue?: string;
  priceCurrency?: string;
  items?: PickupItem[];
  invoiceType: string;
  invoiceNumber?: string;
  invoiceSerialNumber?: string;
  taxCode?: string;
  invoiceAccessKey?: string;
  invoiceMoney?: number;
  remark?: string;
}

export interface CreatedPickup {
  txlogisticId: string;
  billCode: string;
  rawResponse: unknown;
}
