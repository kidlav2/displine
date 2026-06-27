/**
 * Compute the current day number (1-based) from a challenge's start date.
 * Returns 0 if the challenge hasn't started yet, clamped to `duration` once it ends.
 */
export function challengeCurrentDay(startDate: string, duration: number): number {
  if (!startDate) return 0;
  const startMs = new Date(startDate + "T00:00:00Z").getTime();
  const now = Date.now();
  if (now < startMs) return 0;
  return Math.min(Math.floor((now - startMs) / 86_400_000) + 1, duration);
}

/** Returns today's abbreviated weekday name in the given IANA timezone, matching runSchedule keys ("Mon"–"Sun"). */
export function todayRunDayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: tz });
}

/** Returns today's date as "YYYY-MM-DD" in the given IANA timezone. */
export function todayISOInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/** Returns today's date as "YYYY-MM-DD" in local device time (UTC fallback for server queries). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Returns the calendar date for a given challenge day number.
 * `start` must be provided by callers — use `parseChallengeStartDate(challenge.startDate)`.
 */
export function dayToDate(day: number, start: Date): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + day - 1);
  return d;
}

/** Parse a "YYYY-MM-DD" challenge startDate string to a UTC-midnight Date. */
export function parseChallengeStartDate(startDate: string): Date {
  if (!startDate) return new Date();
  return new Date(startDate + "T00:00:00Z");
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/** Compute duration in whole days between two "YYYY-MM-DD" strings (inclusive of end date). */
export function durationFromDates(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  if (ms < 0) return 0;
  return Math.round(ms / 86_400_000) + 1; // +1 so start==end → 1 day
}

/** Add N days to a "YYYY-MM-DD" string, return new "YYYY-MM-DD". */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
