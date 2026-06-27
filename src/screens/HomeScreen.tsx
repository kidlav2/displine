import { useState, useRef, useCallback, useEffect } from "react";
import {
  Camera, ExternalLink, Clock, Activity, Loader2,
  Wallet, TrendingUp, MapPin, CheckCircle2, Zap, CalendarDays,
} from "lucide-react";
import { useNavigate } from "react-router";
import { Av, Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, DAY_LABELS, bc } from "../constants/design";
import { calcScore } from "../lib/scoring";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { checkInForRun, subscribeToTodayCheckIn, runCheckInSubId } from "../lib/firestore";
import { localNow, detectTz } from "../lib/timezone";
import { todayISOInTz } from "../lib/dates";
import type { SortKey } from "../types";

export function HomeScreen() {
  const { challenge, isRunDay, meParticipant, todayTask, todayDeadline, scoring } = useAppContext();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();

  const [checkedIn, setCheckedIn] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const [checkinTime, setCheckinTime] = useState<string | null>(null);
  const [checkInSubId, setCheckInSubId] = useState<string | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [lbSort, setLbSort] = useState<SortKey>("score");
  const cameraRef = useRef<HTMLInputElement>(null);
  const pct = Math.round((challenge.currentDay / challenge.duration) * 100);

  // Subscribe to today's persisted check-in so state survives browser reloads.
  // On component mount, if a checked_in submission exists for today, restore
  // the checked-in UI immediately without re-uploading anything.
  const participantTodayISO = todayISOInTz(meParticipant?.tz ?? detectTz());
  useEffect(() => {
    if (!challenge?.id || !currentUser?.uid || !isRunDay) return;
    return subscribeToTodayCheckIn(
      challenge.id,
      currentUser.uid,
      participantTodayISO,
      (data) => {
        if (data && !checkedIn) {
          setCheckedIn(true);
          setCheckInSubId(data.subId);
          if (data.checkInAt) {
            setCheckinTime(data.checkInAt.toLocaleTimeString("ru-RU", {
              timeZone: meParticipant?.tz ?? "UTC",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }));
          }
        }
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id, currentUser?.uid, isRunDay]);

  const myScore = calcScore(meParticipant?.results ?? [], scoring);
  const totalKm = challenge.participants.reduce((sum, p) => sum + (p.km ?? 0), 0);

  const top3 = [...challenge.participants]
    .filter(p => p.active)
    .sort((a, b) => lbSort === "score" ? calcScore(b.results, scoring) - calcScore(a.results, scoring) : b.km - a.km)
    .slice(0, 3);

  const handleCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid || !challenge?.id || !meParticipant) return;

    // Show check-in state immediately (optimistic) so the UI feels instant
    const now = localNow(meParticipant.tz);
    setThumb(URL.createObjectURL(file));
    setCheckinTime(now);
    setCheckedIn(true);
    setCheckInLoading(true);

    const subId = runCheckInSubId(currentUser.uid, participantTodayISO);
    setCheckInSubId(subId);

    try {
      await checkInForRun(
        challenge.id,
        subId,
        { uid: meParticipant.uid, ini: meParticipant.ini, name: meParticipant.name,
          isAdmin: meParticipant.isAdmin, tz: meParticipant.tz },
        file
      );
    } catch (err) {
      console.error("[HomeScreen] checkInForRun failed:", err);
      // Keep the optimistic UI — the user can still proceed to submit their result
    } finally {
      setCheckInLoading(false);
    }
  }, [challenge?.id, currentUser?.uid, meParticipant]);

  const goSubmit = (t: "task" | "run") => {
    const url = t === "run" && checkInSubId
      ? `/app/tasks?type=run&subId=${checkInSubId}`
      : `/app/tasks?type=${t}`;
    navigate(url);
  };
  const onViewParticipant = (uid: string) => navigate(`/participants/${uid}`);

  const runDayLabels = Object.keys(challenge.settings.runSchedule).map(d => DAY_LABELS[d] ?? d).join(" / ") || "—";
  const runOnTimePts = scoring.find(e => e.key === "running_on_time")?.points ?? 2;
  const runLatePts   = scoring.find(e => e.key === "running_late")?.points    ?? 1;
  const taskPts      = scoring.find(e => e.key === "task_completed")?.points  ?? 5;

  return (
    <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-5 lg:pt-8 space-y-4 pb-4">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Av ini={meParticipant?.ini ?? "?"} photoUrl={meParticipant?.photoUrl} sz="md" accent />
          <div>
            <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground">{challenge.emoji} {challenge.name}</p>
            <p className="font-extrabold text-xl leading-tight">День {challenge.currentDay}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-muted-foreground">Очки</p>
          <p style={{ ...bc, color: BRAND_COLOR, fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{myScore}</p>
          <div className="flex justify-end mt-0.5">
            <Hearts n={meParticipant?.lives ?? 0} sz={16} />
          </div>
        </div>
      </div>

      <Card className="!p-4">
        <div className="flex justify-between items-center mb-2.5">
          <SecLabel>Прогресс марафона</SecLabel>
          <span className="text-xs font-bold text-muted-foreground">{challenge.currentDay}/{challenge.duration} · {pct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BRAND_COLOR }} />
        </div>
      </Card>

      {todayTask ? (
        <Card className="!p-5" accent>
          <div className="flex items-center gap-2 mb-3">
            <SecLabel>Задание на сегодня</SecLabel>
            <span className="ml-auto text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Clock size={11} /> До {todayTask.deadline}
            </span>
          </div>
          <p className="font-extrabold text-xl mb-1">{todayTask.title}</p>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{todayTask.description}</p>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={13} style={{ color: BRAND_COLOR }} />
            <span className="text-xs font-bold" style={{ color: BRAND_COLOR }}>+{taskPts} оч. за выполнение</span>
          </div>
          <button onClick={() => goSubmit("task")} className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white" style={{ background: BRAND_COLOR }}>
            Отправить подтверждение
          </button>
        </Card>
      ) : (
        <Card className="!p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={15} className="text-muted-foreground" />
            <SecLabel>Задание на сегодня</SecLabel>
          </div>
          <p className="text-sm text-muted-foreground">На сегодня задание не запланировано. Проверьте позже или свяжитесь с организатором.</p>
        </Card>
      )}

      {isRunDay && (
        <Card className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} style={{ color: BRAND_COLOR }} />
            <SecLabel>Утренняя пробежка</SecLabel>
            <span className="ml-auto text-[11px] text-muted-foreground">{runDayLabels}</span>
          </div>
          <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Zap size={10} style={{ color: BRAND_COLOR }} /><span style={{ color: BRAND_COLOR }} className="font-bold">+{runOnTimePts} оч.</span> вовремя</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1">+{runLatePts} оч. с оп.</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1"><Clock size={10} /> до {todayDeadline}</span>
          </div>
          {!checkedIn ? (
            <>
              <button
                onClick={() => cameraRef.current?.click()}
                className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white flex items-center justify-center gap-2 mb-2"
                style={{ background: BRAND_COLOR }}
              >
                <Camera size={16} /> Фото и отметиться
              </button>
              <p className="text-center text-[11px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <MapPin size={11} /> геолокация и время добавятся автоматически
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3 p-3 bg-green-50 rounded-xl border border-green-200">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-green-200 flex items-center justify-center">
                  {thumb ? <img src={thumb} alt="check-in" className="w-full h-full object-cover" /> : <Camera size={18} className="text-green-600" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {checkInLoading
                      ? <Loader2 size={13} className="text-green-500 animate-spin" />
                      : <CheckCircle2 size={13} className="text-green-500" />}
                    <span className="text-xs font-extrabold text-green-700">
                      {checkInLoading ? "Сохранение…" : `Отмечено в ${checkinTime ?? "—"}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-green-600 flex items-center gap-1"><MapPin size={10} /> GPS + время записаны</p>
                </div>
              </div>
              <button
                onClick={() => goSubmit("run")}
                className="w-full py-3 rounded-xl border-2 border-border bg-card flex items-center justify-center gap-2 font-semibold text-sm"
              >
                <ExternalLink size={14} /> Загрузить результат / Подключить Strava
              </button>
            </>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <div className="flex items-center gap-1.5 mb-2"><Wallet size={13} className="text-muted-foreground" /><SecLabel>Казна</SecLabel></div>
          <p style={{ ...bc, fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{challenge.totalTreasury.toLocaleString("ru")}</p>
          <p className="text-xs text-muted-foreground mt-1">{challenge.settings.currency}</p>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-1.5 mb-2"><TrendingUp size={13} className="text-muted-foreground" /><SecLabel>Дистанция</SecLabel></div>
          <p style={{ ...bc, fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{totalKm % 1 === 0 ? totalKm : totalKm.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">км всего</p>
        </Card>
      </div>

      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <SecLabel>Таблица лидеров</SecLabel>
          <div className="flex gap-1 bg-muted rounded-xl p-0.5">
            {(["score", "distance"] as SortKey[]).map(k => (
              <button key={k} onClick={() => setLbSort(k)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                style={lbSort === k ? { background: "#fff", color: "#1A1A1A" } : { color: "#8C8C9A" }}>
                {k === "score" ? "Очки" : "Дистанция"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {top3.map((p, i) => (
            <div key={p.uid} className="flex items-center gap-3">
              <span className="text-base w-5 text-center shrink-0">{["🥇", "🥈", "🥉"][i]}</span>
              <Av ini={p.ini} photoUrl={p.photoUrl} sz="sm" admin={p.isAdmin} onClick={() => onViewParticipant(p.uid)} />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewParticipant(p.uid)}>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold leading-none truncate">{p.name}</p>
                  {p.role === "owner" && <span className="text-[9px] font-extrabold text-purple-500">Орг.</span>}
                  {p.role === "helper" && <span className="text-[9px] font-extrabold text-blue-500">Пом.</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lbSort === "score" ? `${calcScore(p.results, scoring)} оч.` : `${p.km} км`}
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
