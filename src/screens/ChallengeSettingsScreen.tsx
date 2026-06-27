import { useState } from "react";
import { ChevronLeft, CheckCircle2, Plus, X } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, ALL_DAYS, CURRENCIES, DAY_LABELS, bc } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";
import { updateChallengeDoc } from "../lib/firestore";
import { durationFromDates, addDays } from "../lib/dates";
import type { ChallengeSettings, ScoringEntry } from "../types";

function toInputDate(s: string): string {
  if (!s) return "";
  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Legacy English format stored in Firestore (e.g. "Jun 14, 2026")
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Store dates as ISO strings so they parse reliably regardless of locale
function fromInputDate(iso: string): string {
  return iso;
}

export function ChallengeSettingsScreen() {
  const { challenge } = useAppContext();
  const navigate = useNavigate();

  const [s, setS] = useState<ChallengeSettings>(challenge.settings);
  const [startDate, setStartDate] = useState(toInputDate(challenge.startDate));
  const [endDate, setEndDate]     = useState(
    challenge.endDate
      ? toInputDate(challenge.endDate)
      : (challenge.startDate ? addDays(toInputDate(challenge.startDate), challenge.duration - 1) : "")
  );
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleDay = (d: string) => setS(p => {
    const next = { ...p, runSchedule: { ...p.runSchedule } };
    if (d in next.runSchedule) delete next.runSchedule[d];
    else next.runSchedule[d] = "06:00";
    return next;
  });

  const setDayTime = (d: string, time: string) =>
    setS(p => ({ ...p, runSchedule: { ...p.runSchedule, [d]: time } }));

  const updateEntry = (i: number, patch: Partial<ScoringEntry>) =>
    setS(p => {
      const scoring = [...p.scoring];
      scoring[i] = { ...scoring[i], ...patch };
      return { ...p, scoring };
    });

  const removeEntry = (i: number) =>
    setS(p => ({ ...p, scoring: p.scoring.filter((_, j) => j !== i) }));

  const addEntry = () =>
    setS(p => ({
      ...p,
      scoring: [...p.scoring, { key: `custom_${Date.now()}`, label: "", points: 0 }],
    }));

  const currentCode = CURRENCIES.find(c => c.symbol === s.currency)?.code ?? "KZT";

  const handleSave = async () => {
    setLoading(true);
    try {
      const dur = (startDate && endDate) ? durationFromDates(startDate, endDate) : challenge.duration;
      await updateChallengeDoc(challenge.id, {
        settings: s,
        ...(startDate ? { startDate: fromInputDate(startDate) } : {}),
        ...(endDate   ? { endDate:   fromInputDate(endDate)   } : {}),
        duration: dur || challenge.duration,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); navigate(-1); }, 1000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-8 space-y-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ChevronLeft size={16} /> Назад
        </button>
        <p className="font-extrabold text-lg">Настройки челленджа</p>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* Challenge info — dates + starting lives */}
        <Card className="!p-4 space-y-3">
          <p className="font-bold text-sm">Информация о челлендже</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <SecLabel>Дата начала</SecLabel>
              <input
                type="date" value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  if (e.target.value && endDate && e.target.value > endDate)
                    setEndDate(addDays(e.target.value, challenge.duration - 1));
                }}
                className="mt-1.5 w-full bg-muted rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                style={bc}
              />
            </div>
            <div>
              <SecLabel>Дата окончания</SecLabel>
              <input
                type="date" value={endDate} min={startDate}
                onChange={e => setEndDate(e.target.value)}
                className="mt-1.5 w-full bg-muted rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                style={bc}
              />
            </div>
          </div>
          {startDate && endDate && (
            <p className="text-xs text-muted-foreground">
              Продолжительность: <span className="font-bold" style={{ color: BRAND_COLOR }}>{durationFromDates(startDate, endDate)} дн.</span>
            </p>
          )}
          <div>
            <SecLabel>Начальные жизни</SecLabel>
            <div className="flex items-center gap-4 mt-2">
              <button onClick={() => setS(p => ({ ...p, startingLives: Math.max(1, p.startingLives - 1) }))} className="w-10 h-10 rounded-xl border-2 border-border flex items-center justify-center font-bold text-xl">−</button>
              <div className="flex-1 flex justify-center">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-2xl ${i < s.startingLives ? "opacity-100" : "opacity-20"}`}>❤️</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setS(p => ({ ...p, startingLives: Math.min(5, p.startingLives + 1) }))} className="w-10 h-10 rounded-xl border-2 border-border flex items-center justify-center font-bold text-xl">+</button>
            </div>
          </div>
        </Card>

        {/* Run schedule */}
        <Card className="!p-4 space-y-3">
          <p className="font-bold text-sm">Дни пробежек и дедлайны</p>
          <div className="space-y-2">
            {ALL_DAYS.map(d => {
              const selected = d in s.runSchedule;
              return (
                <div key={d} className="flex items-center gap-2">
                  <button onClick={() => toggleDay(d)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 w-14 shrink-0"
                    style={selected ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)", color: "#8C8C9A" }}>
                    {DAY_LABELS[d]}
                  </button>
                  {selected && (
                    <input
                      type="time"
                      value={s.runSchedule[d]}
                      onChange={e => setDayTime(d, e.target.value)}
                      className="bg-muted rounded-xl px-3 py-1.5 text-sm font-extrabold outline-none text-center"
                      style={{ ...bc, fontSize: 15 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Penalties */}
        <Card className="!p-4 space-y-3">
          <p className="font-bold text-sm">Штрафы</p>
          <div>
            <SecLabel>Валюта</SecLabel>
            <div className="flex gap-1 bg-muted rounded-xl p-0.5 mt-1.5 flex-wrap">
              {CURRENCIES.map(cur => (
                <button key={cur.code} onClick={() => setS(p => ({ ...p, currency: cur.symbol }))}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold"
                  style={currentCode === cur.code ? { background: "#fff", color: "#1A1A1A" } : { color: "#8C8C9A" }}>
                  {cur.symbol}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" value={s.penaltyAmount} onChange={e => setS(p => ({ ...p, penaltyAmount: parseInt(e.target.value) || 0 }))}
              className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
            <span className="text-sm text-muted-foreground font-semibold">{s.currency}</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" value={s.burpees} onChange={e => setS(p => ({ ...p, burpees: parseInt(e.target.value) || 0 }))}
              className="w-24 bg-muted rounded-xl px-3 py-2 text-sm font-semibold outline-none text-center" />
            <span className="text-sm text-muted-foreground font-semibold">бёрпи (альтернатива)</span>
          </div>
        </Card>

        {/* Scoring formula — dynamic list */}
        <Card className="!p-4 space-y-3">
          <p className="font-bold text-sm">Формула очков</p>
          {s.scoring.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={entry.label}
                onChange={e => updateEntry(i, { label: e.target.value })}
                placeholder="Описание…"
                className="flex-1 bg-muted rounded-lg px-2.5 py-1.5 text-sm outline-none min-w-0"
              />
              <div className="flex items-center gap-0.5 shrink-0">
                <span className="text-xs text-muted-foreground">+</span>
                <input
                  type="number" min={0} value={entry.points}
                  onChange={e => updateEntry(i, { points: parseInt(e.target.value) || 0 })}
                  className="w-14 bg-muted rounded-lg px-2 py-1.5 text-sm font-bold outline-none text-center"
                  style={bc}
                />
                <span className="text-xs text-muted-foreground">оч.</span>
              </div>
              <button onClick={() => removeEntry(i)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
          <button onClick={addEntry} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <Plus size={12} /> Добавить строку
          </button>
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-sm text-muted-foreground">Пропущено</span>
            <span className="text-sm font-bold text-gray-400">0 оч. (всегда)</span>
          </div>
        </Card>
      </div>

      {saved ? (
        <div className="flex items-center justify-center gap-2 py-3">
          <CheckCircle2 size={18} className="text-green-500" /><span className="font-bold text-green-600">Сохранено!</span>
        </div>
      ) : (
        <button onClick={handleSave} disabled={loading}
          className="w-full lg:max-w-xs py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-50" style={{ background: BRAND_COLOR }}>
          {loading ? "Сохранение…" : "Сохранить настройки"}
        </button>
      )}
    </div>
  );
}
