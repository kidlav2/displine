import type React from "react";

// TODO: replace BRAND_COLOR with var(--primary) everywhere once CSS-var usage is standardised
export const BRAND_COLOR = "#F0614A";

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
