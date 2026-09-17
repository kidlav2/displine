import { CalendarDays, LayoutGrid, Settings, Trophy, type LucideIcon } from "lucide-react";

export interface TabDef {
  path: string;
  Icon: LucideIcon;
  label: string;
  /** Other routes that belong to this tab (detail screens). */
  match?: string[];
}

export const TABS: TabDef[] = [
  { path: "/app/day",      Icon: CalendarDays, label: "День" },
  { path: "/app/grid",     Icon: LayoutGrid,   label: "Таблица" },
  { path: "/app/rating",   Icon: Trophy,       label: "Рейтинг" },
  { path: "/app/settings", Icon: Settings,     label: "Настройки", match: ["/app/team", "/app/profile"] },
];

export function isTabActive(tab: TabDef, pathname: string): boolean {
  return pathname === tab.path || (tab.match ?? []).some(p => pathname.startsWith(p));
}
