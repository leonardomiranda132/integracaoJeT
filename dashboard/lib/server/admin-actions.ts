import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export function getOperationsToken(): string {
  const token = process.env.OPERATIONS_ACTION_TOKEN;

  if (!token) {
    throw new Error("OPERATIONS_ACTION_TOKEN nao esta configurado no ambiente do painel.");
  }

  return token;
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function assertOperationsToken(request: NextRequest, bodyToken?: unknown): void {
  const expected = getOperationsToken();
  const provided =
    request.headers.get("x-operations-token") ??
    (typeof bodyToken === "string" ? bodyToken : "");

  if (!provided || !safeCompare(provided, expected)) {
    throw new Error("Senha operacional invalida.");
  }
}

export function assertConfirmation(value: unknown, expected: string): void {
  if (typeof value !== "string" || value.trim() !== expected) {
    throw new Error(`Digite ${expected} para confirmar.`);
  }
}
