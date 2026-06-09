import type { TotvsSettings } from "../../config/settings.js";
import type { CustomerPhone } from "../../domain/models/order.js";
import type { HttpClient } from "./http-client.js";

interface TotvsTokenResponse {
  access_token: string;
}

interface PersonPhoneResponseItem {
  Sequence?: number;
  typeCode?: number;
  typeName?: string;
  number?: string | null;
  isDefault?: boolean;
}

interface IndividualSearchResponse {
  items?: Array<{
    phones?: PersonPhoneResponseItem[] | null;
  }>;
}

function normalizePhone(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\D/g, "");
  return normalized || undefined;
}

function mapPhone(phone: PersonPhoneResponseItem): CustomerPhone | null {
  const number = normalizePhone(phone.number);

  if (!number) {
    return null;
  }

  return {
    sequence: phone.Sequence,
    typeCode: phone.typeCode,
    typeName: phone.typeName,
    number,
    isDefault: phone.isDefault,
  };
}

export class PersonClient {
  private readonly phoneCache = new Map<number, CustomerPhone[]>();

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

  async searchPhonesByCustomerCode(customerCode: number): Promise<CustomerPhone[]> {
    const cachedPhones = this.phoneCache.get(customerCode);
    if (cachedPhones) {
      return cachedPhones;
    }

    const token = await this.authenticate();
    const response = await this.httpClient.request<IndividualSearchResponse>({
      method: "POST",
      url: `${this.settings.baseUrl}/api/totvsmoda/person/v2/individuals/search`,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filter: {
          personCodeList: [customerCode],
          isCustomer: true,
        },
        expand: "phones",
        order: "personCode",
        page: 1,
        pageSize: 1,
      }),
    });

    const phones =
      response.items?.[0]?.phones?.map(mapPhone).filter((phone) => Boolean(phone)) ?? [];
    const normalizedPhones = phones as CustomerPhone[];
    this.phoneCache.set(customerCode, normalizedPhones);
    return normalizedPhones;
  }
}
