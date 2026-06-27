import { Globe } from "lucide-react";
import { Av, Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, bc } from "../constants/design";
import { SCORE } from "../constants/scoring";
import { TimezoneSettings } from "../components/atoms";
import { calcScore } from "../lib/scoring";
import { useAppContext } from "../contexts/AppContext";

export function ProfileScreen() {
  const { challenge, meParticipant, adminTz, adminTzAuto, setAdminTz, setAdminTzAuto } = useAppContext();

  const results = meParticipant?.results ?? [];
  const myScore = calcScore(results);
  const pct = Math.round((challenge.currentDay / challenge.duration) * 100);

  return (
    <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-5 lg:pt-8 space-y-4 pb-6">
      <div className="flex flex-col items-center text-center pt-2">
        <Av ini={meParticipant?.ini ?? "?"} sz="lg" accent />
        <p className="font-extrabold text-2xl mt-3">{meParticipant?.name ?? "—"}</p>
        <p className="text-sm text-muted-foreground">{challenge.emoji} {challenge.name}</p>
      </div>

      <Card className="!p-4">
        <div className="flex justify-between items-baseline mb-2.5">
          <SecLabel>Прогресс</SecLabel>
          <span className="text-xs font-bold" style={{ color: BRAND_COLOR }}>День {challenge.currentDay} / {challenge.duration}</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BRAND_COLOR }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">осталось {challenge.duration - challenge.currentDay} дней</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Очки в челлендже", value: myScore, unit: "очков всего" },
          { label: "Разбивка", value: `${results.filter(r => r.scoreKey !== "missed").length}/${results.length}`, unit: "заданий выполнено" },
          { label: "Очки за бег", value: results.filter(r => r.type === "running").reduce((a, r) => a + SCORE[r.scoreKey], 0), unit: `+${SCORE.running_on_time} вовремя / +${SCORE.running_late} с оп.` },
          { label: "Очки за задания", value: results.filter(r => r.type === "task").reduce((a, r) => a + SCORE[r.scoreKey], 0), unit: `+${SCORE.task_completed} за задание` },
        ].map(s => (
          <Card key={s.label} className="!p-4">
            <SecLabel>{s.label}</SecLabel>
            <p style={{ ...bc, fontSize: 30, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.unit}</p>
          </Card>
        ))}
      </div>

      <Card className="!p-4">
        <SecLabel>Оставшиеся жизни</SecLabel>
        <div className="flex gap-3 justify-center py-3">
          <Hearts n={meParticipant?.lives ?? 0} sz={28} />
        </div>
      </Card>

      <Card className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={15} className="text-muted-foreground" />
          <SecLabel>Часовой пояс</SecLabel>
          {adminTzAuto && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 ml-1">авто</span>
          )}
        </div>
        <TimezoneSettings tz={adminTz} isAuto={adminTzAuto} onChange={tz => { setAdminTz(tz); setAdminTzAuto(false); }} />
        <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
          Используется для отображения вашего местного времени рядом со временем отправки участников в разделе проверки и ленте активности.
        </p>
      </Card>
    </div>
  );
}
