import { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { CITY_TIMEZONES } from "../../constants/timezones";
import { findCity, utcLabel, localNow } from "../../lib/timezone";
import { BRAND_COLOR, bc } from "../../constants/design";

interface TimezoneSettingsProps {
  tz: string;
  isAuto: boolean;
  onChange: (tz: string) => void;
}

export function TimezoneSettings({ tz, isAuto, onChange }: TimezoneSettingsProps) {
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => localNow(tz));
  const city = findCity(tz);

  useEffect(() => {
    const id = setInterval(() => setNow(localNow(tz)), 10000);
    return () => clearInterval(id);
  }, [tz]);

  const filtered = CITY_TIMEZONES.filter(c =>
    search === "" ? true :
    c.city.toLowerCase().includes(search.toLowerCase()) ||
    c.country.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between p-3.5 bg-muted rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-bold text-sm">{city.city}{city.country ? `, ${city.country}` : ""}</p>
            {isAuto && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">auto</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{utcLabel(tz)}</p>
        </div>
        <div className="text-right">
          <p className="font-extrabold text-lg leading-none" style={{ ...bc, color: BRAND_COLOR }}>{now}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">сейчас</p>
        </div>
      </div>

      <input
        placeholder="Поиск города или страны…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none placeholder-muted-foreground"
      />

      <div className="space-y-0 rounded-xl overflow-hidden border border-border" style={{ maxHeight: 220, overflowY: "auto", scrollbarWidth: "none" }}>
        {filtered.map((c, i) => {
          const selected = c.tz === tz;
          return (
            <button
              key={`${c.city}-${i}`}
              onClick={() => { onChange(c.tz); setSearch(""); }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm text-left border-t border-border first:border-t-0 transition-colors hover:bg-muted"
              style={selected ? { background: "#FFF3F0" } : { background: "#fff" }}
            >
              <div>
                <span className="font-semibold">{c.city}</span>
                <span className="text-muted-foreground ml-1.5 text-xs">{c.country}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">{utcLabel(c.tz)}</span>
                {selected && <CheckCircle2 size={14} style={{ color: BRAND_COLOR }} />}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-4">Города не найдены</p>
        )}
      </div>
    </div>
  );
}
