import type React from "react";

// Colors live in src/styles/theme.css as CSS variables (light + dark).
// These constants point at those variables for the few places that need a
// color in an inline style; prefer the Tailwind token classes (bg-brand,
// text-success-text, …) everywhere else.
export const BRAND_COLOR    = "var(--brand)";
export const BRAND_TINT     = "var(--brand-subtle)";
export const NAV_INACTIVE   = "var(--muted-foreground)";
export const POSTPONE_COLOR = "var(--postpone)";
export const SUCCESS_COLOR  = "var(--success)";
export const ERROR_COLOR    = "var(--danger)";

/** Brand colors of third-party services — used only on their own sign-in/connect buttons. */
export const TELEGRAM_COLOR = "#2AABEE";
export const STRAVA_COLOR   = "#FC5200";

export const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Russian display labels for the English weekday keys used in runSchedule. */
export const DAY_LABELS: Record<string, string> = {
  Mon: "Пн", Tue: "Вт", Wed: "Ср", Thu: "Чт", Fri: "Пт", Sat: "Сб", Sun: "Вс",
};

export const DAY_LABELS_FULL: Record<string, string> = {
  Mon: "Понедельник", Tue: "Вторник", Wed: "Среда", Thu: "Четверг",
  Fri: "Пятница", Sat: "Суббота", Sun: "Воскресенье",
};

export const CURRENCIES = [
  { symbol: "₸",   code: "KZT", label: "Tenge" },
  { symbol: "₽",   code: "RUB", label: "Ruble" },
  { symbol: "сум", code: "UZS", label: "Som" },
  { symbol: "C$",  code: "CAD", label: "CAD" },
  { symbol: "₴",   code: "UAH", label: "Hryvnia" },
  { symbol: "€",   code: "EUR", label: "Euro" },
] as const;

/** Role names shown in the interface. */
export const ROLE_LABELS = { owner: "Владелец", helper: "Помощник", participant: "Участник" } as const;

// The app uses the system font stack (see theme.css). These remain for older
// screens that still spread them into inline styles.
export const jk: React.CSSProperties = {};
export const bc: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };
