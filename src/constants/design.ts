import type React from "react";

// Single source of truth for brand and semantic colors.
// These match the CSS variables in theme.css — both must be updated together.
export const BRAND_COLOR    = "#F0614A"; // --primary
export const BRAND_TINT     = "#FFF3F0"; // --brand-tint
export const NAV_INACTIVE   = "#9BA5B4"; // --nav-inactive
export const POSTPONE_COLOR = "#7C3AED"; // --postpone
export const SUCCESS_COLOR  = "#22C55E"; // green-500
export const ERROR_COLOR    = "#EF4444"; // --destructive / red-500

export const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Russian display labels for the English weekday keys used in runSchedule. */
export const DAY_LABELS: Record<string, string> = {
  Mon: "Пн", Tue: "Вт", Wed: "Ср", Thu: "Чт", Fri: "Пт", Sat: "Сб", Sun: "Вс",
};

export const CURRENCIES = [
  { symbol: "₸",   code: "KZT", label: "Tenge" },
  { symbol: "₽",   code: "RUB", label: "Ruble" },
  { symbol: "сум", code: "UZS", label: "Som" },
  { symbol: "C$",  code: "CAD", label: "CAD" },
  { symbol: "₴",   code: "UAH", label: "Hryvnia" },
  { symbol: "€",   code: "EUR", label: "Euro" },
] as const;

export const jk: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
export const bc: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };
