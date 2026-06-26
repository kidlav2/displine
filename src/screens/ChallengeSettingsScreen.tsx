import { useState } from "react";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, ALL_DAYS, CURRENCIES, bc } from "../constants/design";
import { SCORE } from "../constants/scoring";
import { useAppContext } from "../contexts/AppContext";
import { updateChallengeDoc } from "../lib/firestore";
import type { ChallengeSettings } from "../types";

function toInputDate(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromInputDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ChallengeSettingsScreen() {
  const { challenge } = useAppContext();
  const navigate = useNavigate();

  const [s, setS] = useState<ChallengeSettings>(challenge.settings);
  const [startDate, setStartDate] = useState(toInputDate(challenge.startDate));
  const [duration, setDuration] = useState(String(challenge.duration));
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleDay = (d: string) => setS(p => {
    const next = { ...p, runSchedule: { ...p.runSchedule } };
    if (d in next.runSchedule) {
      delete next.runSchedule[d];
    } else {
      next.runSchedule[d] = "06:00";
    }
    return next;
  });

  const setDayTime = (d: string, time: string) =>
    setS(p => ({ ...p, runSchedule: { ...p.runSchedule, [d]: time } }));

  // Find the currency code from the stored symbol
  const currentCode = CURRENCIES.find(c => c.symbol === s.currency)?.code ?? "KZT";

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateChallengeDoc(challenge.id, {
        settings: s,
        ...(startDate ? { startDate: fromInputDate(startDate) } : {}),
        duration: parseInt(duration) || challenge.duration,
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
          <ChevronLeft size={16} /> Back
        </button>
        <p className="font-extrabold text-lg">Challenge settings</p>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        <Card className="!p-4 space-y-3">
          <p className="font-bold text-sm">Challenge info</p>
          <div>
            <SecLabel>Start date</SecLabel>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="mt-1.5 w-full bg-muted rounded-xl px-3 py-2 text-sm font-semibold outline-none"
              style={bc}
            />
          </div>
          <div>
            <SecLabel>Duration (days)</SecLabel>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              min={1}
              className="mt-1.5 w-full bg-muted rounded-xl px-3 py-2 text-sm font-semibold outline-none"
              style={bc}
            />
          </div>
        </Card>

        <Card className="!p-4 space-y-3">
          <p className="font-bold text-sm">Running days &amp; deadlines</p>
          <div className="space-y-2">
            {ALL_DAYS.map(d => {
              const selected = d in s.runSchedule;
              return (
                <div key={d} className="flex items-center gap-2">
                  <button onClick={() => toggleDay(d)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 w-14 shrink-0"
                    style={selected ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)", color: "#8C8C9A" }}>
                    {d}
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

        <Card className="!p-4 space-y-3">
          <p className="font-bold text-sm">Penalties</p>
          <div>
            <SecLabel>Currency</SecLabel>
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
            <span className="text-sm text-muted-foreground font-semibold">burpees alternative</span>
          </div>
        </Card>

        <Card className="!p-4">
          <p className="font-bold text-sm mb-3">Starting lives</p>
          <div className="flex items-center gap-4">
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
        </Card>

        <Card className="!p-4">
          <p className="font-bold text-sm mb-2">Scoring formula</p>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>Run on time</span><span className="font-bold" style={{ color: BRAND_COLOR }}>+{SCORE.running_on_time} pts</span></div>
            <div className="flex justify-between"><span>Run late</span><span className="font-bold" style={{ color: BRAND_COLOR }}>+{SCORE.running_late} pt</span></div>
            <div className="flex justify-between"><span>Daily task completed</span><span className="font-bold" style={{ color: BRAND_COLOR }}>+{SCORE.task_completed} pts</span></div>
            <div className="flex justify-between"><span>Missed</span><span className="font-bold text-gray-400">0 pts</span></div>
          </div>
        </Card>
      </div>

      {saved ? (
        <div className="flex items-center justify-center gap-2 py-3">
          <CheckCircle2 size={18} className="text-green-500" /><span className="font-bold text-green-600">Saved!</span>
        </div>
      ) : (
        <button onClick={handleSave} disabled={loading}
          className="w-full lg:max-w-xs py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-50" style={{ background: BRAND_COLOR }}>
          {loading ? "Saving…" : "Save settings"}
        </button>
      )}
    </div>
  );
}
