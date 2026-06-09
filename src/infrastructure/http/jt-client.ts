import type { JtSettings } from "../../config/settings.js";
import { IntegrationError } from "../../domain/errors/integration-error.js";
import type { CreatedPickup, PickupRequestPayload } from "../../domain/models/pickup.js";
import type { HttpClient } from "./http-client.js";
import { JtSignatureService } from "./jt-signature-service.js";

interface JtCreateOrderResponse {
  code: string;
  msg: string;
  data?: {
    orderList?: Array<{
      txlogisticId: string;
      billCode: string;
    }>;
  };
}

export class JtClient {
  constructor(
    private readonly settings: JtSettings,
    private readonly httpClient: HttpClient,
    private readonly signatureService: JtSignatureService,
  ) {}

  createBusinessDigest(): string {
    return this.signatureService.createBusinessDigest();
  }

  buildAddOrderRequest(payload: PickupRequestPayload, timestamp = Date.now()) {
    const bizContentJson = JSON.stringify(payload);
    const headerDigest = this.signatureService.createHeaderDigest(bizContentJson);
    const formBody = new URLSearchParams({
      bizContent: bizContentJson,
    });

    return {
      bizContentJson,
      formBody: formBody.toString(),
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=utf-8",
        apiAccount: this.settings.apiAccount,
        digest: headerDigest,
        timestamp: timestamp.toString(),
      },
    };
  }

  async addOrder(payload: PickupRequestPayload): Promise<CreatedPickup> {
    const request = this.buildAddOrderRequest(payload);

    const response = await this.httpClient.request<JtCreateOrderResponse>({
      method: "POST",
      url: `${this.settings.baseUrl}/order/addOrder`,
      headers: request.headers,
      body: request.formBody,
    });

    if (response.code !== "1") {
      throw new IntegrationError("J&T recusou a criacao do pedido.", {
        code: response.code,
        message: response.msg,
        txlogisticId: payload.txlogisticId,
      });
    }

    const created = response.data?.orderList?.[0];

    if (!created?.billCode) {
      throw new IntegrationError("J&T retornou sucesso sem billCode.", {
        txlogisticId: payload.txlogisticId,
        response,
      });
    }

    return {
      txlogisticId: created.txlogisticId ?? payload.txlogisticId,
      billCode: created.billCode,
      rawResponse: response,
    };
  }
}
