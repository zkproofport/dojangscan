import { getLocale } from "./preferences";

export function validTimeZone(value: string): boolean {
  if (!value || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  } catch {
    return "Asia/Seoul";
  }
}

// Numbers are onchain Unix seconds; strings are ISO timestamps from scan snapshots.
export function formatDateTime(
  value: number | string,
  timeZone = getTimeZone(),
  locale = getLocale(),
): string {
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  if (!Number.isFinite(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat(locale, {
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")} ${part("timeZoneName")}`;
}

// Compare local calendar dates instead of assuming every day lasts 24 hours (DST).
export function calendarDateFormatter(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (seconds: number) => {
    const parts = formatter.formatToParts(new Date(seconds * 1000));
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
}

export function formatDate(value: number | string): string {
  return formatDateTime(value).split(" ")[0];
}

export function formatTime(value: number | string): string {
  const formatted = formatDateTime(value);
  return formatted === "—" ? formatted : formatted.slice(11);
}
