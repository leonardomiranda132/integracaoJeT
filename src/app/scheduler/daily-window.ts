import type { TimeWindow } from "../../shared/types.js";

const DAILY_CUTOFF_TIME = "17:00:00";
const ONE_DAY = 1;

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

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function formatLocalDate(parts: {
  year: string;
  month: string;
  day: string;
}): string {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function buildDailyWindow(
  timezone: string,
  now = new Date(),
): Promise<TimeWindow> {
  const currentRunDate = formatLocalDate(getLocalDateParts(timezone, now));
  const previousRunDate = formatLocalDate(
    getLocalDateParts(timezone, subtractDays(now, ONE_DAY)),
  );
  const offset = getTimezoneOffset(timezone, now);

  return {
    startDate: `${previousRunDate}T${DAILY_CUTOFF_TIME}${offset}`,
    endDate: `${currentRunDate}T${DAILY_CUTOFF_TIME}${offset}`,
  };
}
