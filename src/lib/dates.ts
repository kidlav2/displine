// TODO: remove CHALLENGE_START default once Firebase is wired — callers will pass challenge.startDate
export const CHALLENGE_START = new Date(2026, 5, 14);

/** Returns today's abbreviated weekday name matching the runDays format ("Mon"–"Sun"). */
export function getTodayRunDay(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "short" });
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
