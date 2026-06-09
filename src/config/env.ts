import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let envLoaded = false;

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const normalized = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length).trim()
    : trimmed;

  const separatorIndex = normalized.indexOf("=");
  if (separatorIndex === -1) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  if (!key) {
    return null;
  }

  let value = normalized.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function loadEnvFile(filePath = resolve(process.cwd(), ".env")): void {
  if (envLoaded || !existsSync(filePath)) {
    return;
  }

  envLoaded = true;

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    const [key, value] = parsed;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
