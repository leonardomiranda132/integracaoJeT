import { createHash } from "node:crypto";
import type { JtSettings } from "../../config/settings.js";

export class JtSignatureService {
  constructor(private readonly settings: JtSettings) {}

  createBusinessDigest(): string {
    const pwd = createHash("md5")
      .update(`${this.settings.customerPassword}jadada236t2`)
      .digest("hex")
      .toUpperCase();

    return createHash("md5")
      .update(`${this.settings.customerCode}${pwd}${this.settings.privateKey}`)
      .digest("base64");
  }

  createHeaderDigest(bizContentJson: string): string {
    return createHash("md5")
      .update(`${bizContentJson}${this.settings.privateKey}`)
      .digest("base64");
  }
}
