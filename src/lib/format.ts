import { weekdayFromISO } from "./dates";

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS: Record<string, string> = {
  Mon: "понедельник", Tue: "вторник", Wed: "среда", Thu: "четверг",
  Fri: "пятница", Sat: "суббота", Sun: "воскресенье",
};
const WEEKDAYS_SHORT: Record<string, string> = {
  Mon: "пн", Tue: "вт", Wed: "ср", Thu: "чт", Fri: "пт", Sat: "сб", Sun: "вс",
};

function parts(iso: string): [number, number, number] | null {
  const [y, m, d] = (iso ?? "").split("-").map(Number);
  return y && m && d ? [y, m, d] : null;
}

/** "16 сентября" */
export function formatDateLong(iso: string): string {
  const p = parts(iso);
  return p ? `${p[2]} ${MONTHS_GENITIVE[p[1] - 1]}` : "";
}

/** "16 сен" */
export function formatDateShort(iso: string): string {
  const p = parts(iso);
  return p ? `${p[2]} ${MONTHS_SHORT[p[1] - 1]}` : "";
}

/** "Среда, 16 сентября" */
export function formatWeekdayDate(iso: string): string {
  if (!parts(iso)) return "";
  const wd = WEEKDAYS[weekdayFromISO(iso)] ?? "";
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${formatDateLong(iso)}`;
}

/** "ср" */
export function formatWeekdayShort(iso: string): string {
  return parts(iso) ? WEEKDAYS_SHORT[weekdayFromISO(iso)] ?? "" : "";
}

/** "5 000 ₸" — the space before the currency never breaks. */
export function formatMoney(amount: number, currency: string): string {
  return `${Math.round(amount).toLocaleString("ru-RU")} ${currency}`;
}

/** Russian plural: plural(5, ["участник", "участника", "участников"]) → "участников" */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** Local calendar date as "YYYY-MM-DD". */
export function localISODate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
