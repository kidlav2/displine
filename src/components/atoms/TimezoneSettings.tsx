import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { CITY_TIMEZONES } from "../../constants/timezones";
import { findCity, localNow, utcLabel } from "../../lib/timezone";
import { cn } from "../../lib/cn";
import { Badge } from "./Badge";
import { Input } from "./Field";

interface TimezoneSettingsProps {
  tz: string;
  isAuto: boolean;
  onChange: (tz: string) => void;
}

export function TimezoneSettings({ tz, isAuto, onChange }: TimezoneSettingsProps) {
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => localNow(tz));
  const city = findCity(tz);

  useEffect(() => {
    setNow(localNow(tz));
    const id = setInterval(() => setNow(localNow(tz)), 10_000);
    return () => clearInterval(id);
  }, [tz]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? CITY_TIMEZONES.filter(c => c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      : CITY_TIMEZONES;
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 rounded-lg bg-muted px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-medium sm:text-sm">
              {city.city}{city.country ? `, ${city.country}` : ""}
            </p>
            {isAuto && <Badge>авто</Badge>}
          </div>
          <p className="text-[13px] text-muted-foreground tabular">{utcLabel(tz)}</p>
        </div>
        <p className="text-xl font-semibold tabular" aria-label={`Сейчас ${now}`}>{now}</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Найти город или страну"
          placeholder="Город или страна"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <ul className="max-h-60 divide-y divide-border overflow-y-auto overscroll-contain rounded-lg border border-border" aria-label="Часовые пояса">
        {filtered.map((c, i) => {
          const selected = c.tz === tz;
          return (
            <li key={`${c.city}-${i}`}>
              <button
                type="button"
                onClick={() => { onChange(c.tz); setQuery(""); }}
                aria-current={selected || undefined}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-hover",
                  selected && "font-medium",
                )}
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{c.city}</span>
                  <span className="ml-1.5 text-[13px] text-muted-foreground">{c.country}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[13px] text-muted-foreground tabular">
                  {utcLabel(c.tz)}
                  {selected && <Check className="size-4 text-brand-text" aria-hidden />}
                </span>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3.5 py-5 text-center text-[13px] text-muted-foreground">Ничего не найдено</li>
        )}
      </ul>
    </div>
  );
}
