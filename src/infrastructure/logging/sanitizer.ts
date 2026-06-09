const REDACTED = "[REDACTED]";
const CIRCULAR = "[Circular]";

const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CNPJ_PATTERN = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const FORMATTED_PHONE_PATTERN =
  /(?:\+?55[\s-]*)?(?:\(\d{2}\)|\b\d{2})[\s-]*9?\d{4}[\s-]?\d{4}\b/g;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(password|passwd|pwd|senha|token|access_token|refresh_token|client_secret|privateKey|private_key|api_key|authorization|digest|bizDigest|signature)\b\s*[:=]\s*["']?([^"',\s}]+)/gi;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSecretKey(key: string): boolean {
  const normalized = normalizedKey(key);

  return [
    "password",
    "passwd",
    "pwd",
    "senha",
    "token",
    "accesstoken",
    "refreshtoken",
    "secret",
    "clientsecret",
    "privatekey",
    "apikey",
    "authorization",
    "digest",
    "bizdigest",
    "signature",
  ].some((sensitiveKey) => normalized.includes(sensitiveKey));
}

function isCpfKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return normalized.includes("cpf") || normalized.includes("taxid");
}

function isCnpjKey(key: string): boolean {
  return normalizedKey(key).includes("cnpj");
}

function isPhoneKey(key: string): boolean {
  const normalized = normalizedKey(key);

  return ["phone", "telefone", "celular", "mobile", "whatsapp"].some(
    (phoneKey) => normalized.includes(phoneKey),
  );
}

function isAddressKey(key: string): boolean {
  const normalized = normalizedKey(key);

  return [
    "address",
    "endereco",
    "shippingaddress",
    "street",
    "logradouro",
    "streetnumber",
    "numero",
    "neighborhood",
    "bairro",
    "complement",
    "complemento",
    "postcode",
    "postalcode",
    "cep",
  ].some((addressKey) => normalized.includes(addressKey));
}

function maskCpf(value: string): string {
  const digits = onlyDigits(value);

  if (digits.length !== 11) {
    return sanitizeString(value);
  }

  return `***.***.***-${digits.slice(-2)}`;
}

function maskCnpj(value: string): string {
  const digits = onlyDigits(value);

  if (digits.length !== 14) {
    return sanitizeString(value);
  }

  return `**.***.***/****-${digits.slice(-2)}`;
}

function maskPhone(value: string): string {
  const digits = onlyDigits(value);

  if (digits.length < 8) {
    return sanitizeString(value);
  }

  return `***${digits.slice(-2)}`;
}

function sanitizeString(value: string): string {
  return value
    .replace(
      SECRET_ASSIGNMENT_PATTERN,
      (_match, key: string) => `${key}=${REDACTED}`,
    )
    .replace(CNPJ_PATTERN, (match) => maskCnpj(match))
    .replace(CPF_PATTERN, (match) => maskCpf(match))
    .replace(FORMATTED_PHONE_PATTERN, (match) => {
      const digits = onlyDigits(match);
      return digits.length >= 10 ? maskPhone(match) : match;
    });
}

function sanitizeByKey(key: string, value: unknown, seen: WeakSet<object>): unknown {
  if (isSecretKey(key)) {
    return REDACTED;
  }

  if (isCpfKey(key) && typeof value === "string") {
    return maskCpf(value);
  }

  if (isCnpjKey(key) && typeof value === "string") {
    return maskCnpj(value);
  }

  if (isPhoneKey(key) && typeof value === "string") {
    return maskPhone(value);
  }

  if (isAddressKey(key)) {
    return REDACTED;
  }

  return sanitizeValue(value, seen);
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return CIRCULAR;
  }

  seen.add(value);

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    const sanitized = value.map((item) => sanitizeValue(item, seen));
    seen.delete(value);
    return sanitized;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    sanitized[key] = sanitizeByKey(key, item, seen);
  }

  seen.delete(value);
  return sanitized;
}

export function sanitizeForLogging<T>(value: T): T {
  return sanitizeValue(value, new WeakSet<object>()) as T;
}
