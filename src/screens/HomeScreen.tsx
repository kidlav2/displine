import { useState, useRef, useCallback } from "react";
import {
  Camera, ExternalLink, Clock, Activity,
  Wallet, TrendingUp, MapPin, CheckCircle2, Zap, CalendarDays,
} from "lucide-react";
import { useNavigate } from "react-router";
import { Av, Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, bc } from "../constants/design";
import { SCORE } from "../constants/scoring";
import { calcScore } from "../lib/scoring";
import { useAppContext } from "../contexts/AppContext";
import type { SortKey } from "../types";

export function HomeScreen() {
  const { challenge, isRunDay, meParticipant, todayTask, todayDeadline } = useAppContext();
  const navigate = useNavigate();

  const [checkedIn, setCheckedIn] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const [lbSort, setLbSort] = useState<SortKey>("score");
  const cameraRef = useRef<HTMLInputElement>(null);
  const pct = Math.round((challenge.currentDay / challenge.duration) * 100);

  const myScore = calcScore(meParticipant?.results ?? []);

  const top3 = [...challenge.participants]
    .filter(p => p.active)
    .sort((a, b) => lbSort === "score" ? calcScore(b.results) - calcScore(a.results) : b.km - a.km)
    .slice(0, 3);

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumb(URL.createObjectURL(file)); setCheckedIn(true);
  }, []);

  const goSubmit = (t: "task" | "run") => navigate(`/app/tasks?type=${t}`);
  const onViewParticipant = (uid: string) => navigate(`/participants/${uid}`);

  const runDayLabels = Object.keys(challenge.settings.runSchedule).join(" / ") || "—";

  return (
    <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-5 lg:pt-8 space-y-4 pb-4">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Av ini={meParticipant?.ini ?? "?"} sz="md" accent />
          <div>
            <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground">{challenge.emoji} {challenge.name}</p>
            <p className="font-extrabold text-xl leading-tight">Day {challenge.currentDay}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-muted-foreground">Score</p>
          <p style={{ ...bc, color: BRAND_COLOR, fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{myScore}</p>
          <div className="flex justify-end mt-0.5">
            <Hearts n={meParticipant?.lives ?? 0} sz={16} />
          </div>
        </div>
      </div>

      <Card className="!p-4">
        <div className="flex justify-between items-center mb-2.5">
          <SecLabel>Marathon progress</SecLabel>
          <span className="text-xs font-bold text-muted-foreground">{challenge.currentDay}/{challenge.duration} · {pct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BRAND_COLOR }} />
        </div>
      </Card>

      {todayTask ? (
        <Card className="!p-5" accent>
          <div className="flex items-center gap-2 mb-3">
            <SecLabel>Today&apos;s mission</SecLabel>
            <span className="ml-auto text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Clock size={11} /> Due {todayTask.deadline}
            </span>
          </div>
          <p className="font-extrabold text-xl mb-1">{todayTask.title}</p>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{todayTask.description}</p>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={13} style={{ color: BRAND_COLOR }} />
            <span className="text-xs font-bold" style={{ color: BRAND_COLOR }}>+{SCORE.task_completed} pts on completion</span>
          </div>
          <button onClick={() => goSubmit("task")} className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white" style={{ background: BRAND_COLOR }}>
            Submit Proof
          </button>
        </Card>
      ) : (
        <Card className="!p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={15} className="text-muted-foreground" />
            <SecLabel>Today&apos;s mission</SecLabel>
          </div>
          <p className="text-sm text-muted-foreground">No task scheduled for today. Check back later or contact your organizer.</p>
        </Card>
      )}

      {isRunDay && (
        <Card className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} style={{ color: BRAND_COLOR }} />
            <SecLabel>Morning run</SecLabel>
            <span className="ml-auto text-[11px] text-muted-foreground">{runDayLabels}</span>
          </div>
          <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Zap size={10} style={{ color: BRAND_COLOR }} /><span style={{ color: BRAND_COLOR }} className="font-bold">+{SCORE.running_on_time} pts</span> on time</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1">+{SCORE.running_late} pt late</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1"><Clock size={10} /> by {todayDeadline}</span>
          </div>
          {!checkedIn ? (
            <>
              <button
                onClick={() => cameraRef.current?.click()}
                className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white flex items-center justify-center gap-2 mb-2"
                style={{ background: BRAND_COLOR }}
              >
                <Camera size={16} /> Take photo &amp; check in
              </button>
              <button
                onClick={() => { setThumb("sim"); setCheckedIn(true); }}
                className="w-full py-2 rounded-xl text-xs font-semibold text-muted-foreground border border-dashed border-border"
              >
                Simulate capture (preview only)
              </button>
              <p className="text-center text-[11px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <MapPin size={11} /> location and time will be added automatically
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3 p-3 bg-green-50 rounded-xl border border-green-200">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-green-200 flex items-center justify-center">
                  {thumb && thumb !== "sim" ? <img src={thumb} alt="check-in" className="w-full h-full object-cover" /> : <Camera size={18} className="text-green-600" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5"><CheckCircle2 size={13} className="text-green-500" /><span className="text-xs font-extrabold text-green-700">Checked in at 05:48</span></div>
                  <p className="text-[11px] text-green-600 flex items-center gap-1"><MapPin size={10} /> GPS + timestamp recorded</p>
                </div>
              </div>
              <button
                onClick={() => goSubmit("run")}
                className="w-full py-3 rounded-xl border-2 border-border bg-card flex items-center justify-center gap-2 font-semibold text-sm"
              >
                <ExternalLink size={14} /> Upload result / Connect Strava
              </button>
            </>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <div className="flex items-center gap-1.5 mb-2"><Wallet size={13} className="text-muted-foreground" /><SecLabel>Treasury</SecLabel></div>
          <p style={{ ...bc, fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{challenge.totalTreasury.toLocaleString("ru")}</p>
          <p className="text-xs text-muted-foreground mt-1">{challenge.settings.currency}</p>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-1.5 mb-2"><TrendingUp size={13} className="text-muted-foreground" /><SecLabel>My score</SecLabel></div>
          <p style={{ ...bc, fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{myScore}</p>
          <p className="text-xs text-muted-foreground mt-1">pts total</p>
        </Card>
      </div>

      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <SecLabel>Leaderboard</SecLabel>
          <div className="flex gap-1 bg-muted rounded-xl p-0.5">
            {(["score", "distance"] as SortKey[]).map(k => (
              <button key={k} onClick={() => setLbSort(k)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                style={lbSort === k ? { background: "#fff", color: "#1A1A1A" } : { color: "#8C8C9A" }}>
                {k === "score" ? "Score" : "Distance"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {top3.map((p, i) => (
            <div key={p.uid} className="flex items-center gap-3">
              <span className="text-base w-5 text-center shrink-0">{["🥇", "🥈", "🥉"][i]}</span>
              <Av ini={p.ini} sz="sm" admin={p.isAdmin} onClick={() => onViewParticipant(p.uid)} />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewParticipant(p.uid)}>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold leading-none truncate">{p.name}</p>
                  {p.isAdmin && <span className="text-[9px] font-extrabold text-blue-500">ORG</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lbSort === "score" ? `${calcScore(p.results)} pts` : `${p.km} km`}
                </p>
              </div>
              <Hearts n={p.lives} sz={14} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
