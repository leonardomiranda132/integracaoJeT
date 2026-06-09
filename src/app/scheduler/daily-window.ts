import type { TimeWindow } from "../../shared/types.js";

function getTimezoneOffset(timezone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  }).formatToParts(now);

  const timeZoneName = parts.find((part) => part.type === "timeZoneName")?.value;
  const normalized = timeZoneName?.replace("GMT", "") || "+00:00";

  if (/^[+-]\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  return "+00:00";
}

function getLocalDateParts(timezone: string, now: Date): {
  year: string;
  month: string;
  day: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "1970",
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    day: parts.find((part) => part.type === "day")?.value ?? "01",
  };
}

export async function buildDailyWindow(
  timezone: string,
  now = new Date(),
): Promise<TimeWindow> {
  const { year, month, day } = getLocalDateParts(timezone, now);
  const offset = getTimezoneOffset(timezone, now);

  return {
    startDate: `${year}-${month}-${day}T00:00:00${offset}`,
    endDate: `${year}-${month}-${day}T17:00:00${offset}`,
  };
}
