// TODO: remove CHALLENGE_START default once Firebase is wired — callers will pass challenge.startDate
export const CHALLENGE_START = new Date(2026, 5, 14);

/** Returns today's abbreviated weekday name matching the runSchedule keys ("Mon"–"Sun"). */
export function getTodayRunDay(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "short" });
}

/** Returns today's date as "YYYY-MM-DD" (local time). Used to query today's task from Firestore. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayToDate(day: number, start = CHALLENGE_START): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + day - 1);
  return d;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
