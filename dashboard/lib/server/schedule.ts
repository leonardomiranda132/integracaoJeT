const SAO_PAULO_OFFSET = "-03:00";

function saoPauloDateParts(date: Date): { day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: value.day,
    month: value.month,
    year: value.year,
  };
}

function dailyRunFor(date: Date): Date {
  const parts = saoPauloDateParts(date);
  return new Date(`${parts.year}-${parts.month}-${parts.day}T17:00:00${SAO_PAULO_OFFSET}`);
}

export function getNextDailyRunAt(now = new Date()): string {
  const todayRun = dailyRunFor(now);

  if (todayRun.getTime() > now.getTime()) {
    return todayRun.toISOString();
  }

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return dailyRunFor(tomorrow).toISOString();
}
