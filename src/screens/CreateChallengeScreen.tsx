import { useState } from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import { useNavigate } from "react-router";
import { Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, ALL_DAYS, CURRENCIES, DAY_LABELS, bc } from "../constants/design";
import { DEFAULT_SCORING } from "../constants/scoring";
import { useAuthContext } from "../contexts/AuthContext";
import { createChallenge } from "../lib/firestore";
import { durationFromDates, addDays } from "../lib/dates";
import type { ScoringEntry } from "../types";

const EMOJIS = ["🔥", "❄️", "🍂", "💪", "🧘", "📚", "🏃", "⚡", "🎯", "🌟"];

export function CreateChallengeScreen() {
  const { currentUser, userProfile } = useAuthContext();
  const navigate = useNavigate();

  const [step, setStep] = useState<"form" | "done">("form");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🔥");
  const [desc, setDesc] = useState("");
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate]     = useState("2026-08-19"); // 50 days from Jul 1
  const [runSchedule, setRunSchedule] = useState<Record<string, string>>({ Tue: "06:00", Thu: "06:00", Sat: "06:00", Sun: "07:00" });
  const [penaltyAmount, setPenaltyAmount] = useState("5000");
  const [currency, setCurrency] = useState("KZT");
  const [burpees, setBurpees] = useState("20");
  const [startingLives, setStartingLives] = useState(5);
  const [scoring, setScoring] = useState<ScoringEntry[]>([...DEFAULT_SCORING]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: string) => setRunSchedule(p => {
    if (d in p) {
      const next = { ...p };
      delete next[d];
      return next;
    }
    return { ...p, [d]: "06:00" };
  });

  const setDayTime = (d: string, time: string) =>
    setRunSchedule(p => ({ ...p, [d]: time }));

  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol ?? currency;

  const submit = async () => {
    if (!name.trim() || !currentUser || !userProfile || loading) return;
    setLoading(true);
    setError(null);
    try {
      const inviteCode = `${name.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await createChallenge(
        currentUser.uid,
        { name: userProfile.name, ini: userProfile.ini, timezone: userProfile.timezone, telegramUsername: userProfile.telegramUsername },
        {
          name: name.trim(), emoji, description: desc.trim(),
          startDate, endDate, duration: durationFromDates(startDate, endDate) || 50, currentDay: 0,
          status: "upcoming", inviteCode,
          settings: {
            runSchedule,
            penaltyAmount: parseInt(penaltyAmount) || 5000,
            currency: currencySymbol,
            burpees: parseInt(burpees) || 20,
            startingLives,
            scoring,
          },
        }
      );
      setStep("done");
    } catch {
      setError("Не удалось создать челлендж. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
      <p className="text-5xl">{emoji}</p>
      <p className="font-extrabold text-2xl">{name}</p>
      <p className="text-sm text-muted-foreground">Челлендж создан! Участники могут присоединиться с помощью кода приглашения.</p>
      <button onClick={() => navigate("/challenges")} className="mt-4 px-8 py-3 rounded-xl font-extrabold text-sm text-white" style={{ background: BRAND_COLOR }}>Готово</button>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-8 space-y-4 max-w-[600px] mx-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ChevronLeft size={16} /> Назад
        </button>
        <p className="font-extrabold text-lg">Создать челлендж</p>
      </div>

      <Card className="!p-4 space-y-3">
        <div>
          <SecLabel>Эмодзи</SecLabel>
          <div className="flex gap-2 mt-2 flex-wrap">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                className={`text-2xl w-11 h-11 rounded-xl border-2 ${emoji === e ? "border-orange-400 bg-orange-50" : "border-border bg-muted"}`}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <SecLabel>Название челленджа</SecLabel>
          <input placeholder="напр. Летняя дисциплина" value={name} onChange={e => setName(e.target.value)}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" />
        </div>
        <div>
          <SecLabel>Описание</SecLabel>
          <textarea placeholder="О чём этот челлендж?" value={desc} onChange={e => setDesc(e.target.value)} rows={2}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
        </div>
      </Card>

      <Card className="!p-4 space-y-3">
        <p className="font-bold text-sm">Расписание</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <SecLabel>Дата начала</SecLabel>
            <input
              type="date" value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                if (e.target.value && endDate && e.target.value > endDate)
                  setEndDate(addDays(e.target.value, 49));
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
          <SecLabel>Дни пробежек и дедлайны</SecLabel>
          <div className="mt-2 space-y-2">
            {ALL_DAYS.map(d => {
              const selected = d in runSchedule;
              return (
                <div key={d} className="flex items-center gap-2">
                  <button onClick={() => toggleDay(d)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 w-14 shrink-0 transition-colors"
                    style={selected ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)", color: "#8C8C9A" }}>
                    {DAY_LABELS[d]}
                  </button>
                  {selected && (
                    <input
                      type="time"
                      value={runSchedule[d]}
                      onChange={e => setDayTime(d, e.target.value)}
                      className="bg-muted rounded-xl px-3 py-1.5 text-sm font-extrabold outline-none text-center"
                      style={{ ...bc, fontSize: 15 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="!p-4 space-y-3">
        <p className="font-bold text-sm">Штрафы и жизни</p>
        <div>
          <SecLabel>Финансовый штраф</SecLabel>
          <div className="flex gap-2 mt-1.5">
            <div className="flex gap-1 bg-muted rounded-xl p-0.5 flex-wrap">
              {CURRENCIES.map(cur => (
                <button key={cur.code} onClick={() => setCurrency(cur.code)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold"
                  style={currency === cur.code ? { background: "#fff", color: "#1A1A1A" } : { color: "#8C8C9A" }}>
                  {cur.symbol}
                </button>
              ))}
            </div>
            <input type="number" value={penaltyAmount} onChange={e => setPenaltyAmount(e.target.value)}
              className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
          </div>
        </div>
        <div>
          <SecLabel>Альтернатива (бёрпи)</SecLabel>
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" value={burpees} onChange={e => setBurpees(e.target.value)}
              className="w-24 bg-muted rounded-xl px-3 py-2 text-sm font-semibold outline-none text-center" />
            <span className="text-sm text-muted-foreground font-semibold">бёрпи</span>
          </div>
        </div>
        <div>
          <SecLabel>Начальные жизни</SecLabel>
          <div className="flex items-center gap-4 mt-2">
            <button onClick={() => setStartingLives(v => Math.max(1, v - 1))}
              className="w-9 h-9 rounded-xl border-2 border-border flex items-center justify-center font-bold text-lg">−</button>
            <Hearts n={startingLives} sz={22} />
            <button onClick={() => setStartingLives(v => Math.min(5, v + 1))}
              className="w-9 h-9 rounded-xl border-2 border-border flex items-center justify-center font-bold text-lg">+</button>
          </div>
        </div>
      </Card>

      <Card className="!p-4 space-y-3">
        <p className="font-bold text-sm">Формула очков</p>
        {scoring.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={entry.label}
              onChange={e => setScoring(s => { const n = [...s]; n[i] = { ...n[i], label: e.target.value }; return n; })}
              placeholder="Описание…"
              className="flex-1 bg-muted rounded-lg px-2.5 py-1.5 text-sm outline-none min-w-0"
            />
            <div className="flex items-center gap-0.5 shrink-0">
              <span className="text-xs text-muted-foreground">+</span>
              <input
                type="number" min={0} value={entry.points}
                onChange={e => setScoring(s => { const n = [...s]; n[i] = { ...n[i], points: parseInt(e.target.value) || 0 }; return n; })}
                className="w-14 bg-muted rounded-lg px-2 py-1.5 text-sm font-bold outline-none text-center"
                style={bc}
              />
              <span className="text-xs text-muted-foreground">оч.</span>
            </div>
            <button onClick={() => setScoring(s => s.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
        <button onClick={() => setScoring(s => [...s, { key: `custom_${Date.now()}`, label: "", points: 0 }])}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <Plus size={12} /> Добавить строку
        </button>
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-sm text-muted-foreground">Пропущено</span>
          <span className="text-sm font-bold text-gray-400">0 оч. (всегда)</span>
        </div>
      </Card>

      <div className="pb-2">
        {error && <p className="text-xs font-bold text-red-500 mb-3">{error}</p>}
        <button onClick={submit} disabled={!name.trim() || loading}
          className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-35"
          style={{ background: BRAND_COLOR }}>
          {loading ? "Создание…" : "Создать челлендж"}
        </button>
      </div>
    </div>
  );
}
