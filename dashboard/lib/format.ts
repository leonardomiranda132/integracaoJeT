function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: unknown): string {
  const date = toDate(value);
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatCurrency(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return String(value);
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

export function formatNumber(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("pt-BR").format(number);
}

export function cx(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}
