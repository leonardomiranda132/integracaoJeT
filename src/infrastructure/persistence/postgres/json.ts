function normalizeJsonValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value === undefined) {
    return null;
  }

  return value;
}

export function toJsonb(value: unknown): string {
  return JSON.stringify(value, (_key, item) => normalizeJsonValue(item)) ?? "null";
}
