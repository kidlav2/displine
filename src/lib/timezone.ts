import { CITY_TIMEZONES, type CityTz } from "../constants/timezones";

export function detectTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
}

export function getOffsetMin(tz: string): number {
  const now   = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const utc   = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((local.getTime() - utc.getTime()) / 60000);
}

export function utcLabel(tz: string): string {
  const off = getOffsetMin(tz);
  const h   = Math.floor(Math.abs(off) / 60);
  const m   = Math.abs(off) % 60;
  return `UTC${off >= 0 ? "+" : "-"}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

export function localNow(tz: string): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function convertTime(timeStr: string, fromTz: string, toTz: string): string {
  if (!timeStr || timeStr === "—") return "—";
  const [hh, mm] = timeStr.split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) return timeStr;
  const totalMin = hh * 60 + mm + getOffsetMin(toTz) - getOffsetMin(fromTz);
  const wrapped  = ((totalMin % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function findCity(tz: string): CityTz {
  return (
    CITY_TIMEZONES.find(c => c.tz === tz) ??
    { city: tz.split("/").pop()?.replace(/_/g, " ") ?? tz, country: "", tz }
  );
}
