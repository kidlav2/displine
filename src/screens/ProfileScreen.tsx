import { Globe } from "lucide-react";
import { Av, Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, bc } from "../constants/design";
import { SCORE } from "../constants/scoring";
import { TimezoneSettings } from "../components/atoms";
import { useAppContext } from "../contexts/AppContext";
import { ME, ME_RESULTS, ME_SCORE } from "../data/mock";

export function ProfileScreen() {
  const { challenge, adminTz, adminTzAuto, setAdminTz, setAdminTzAuto } = useAppContext();
  const pct = Math.round((ME.day / ME.total) * 100);

  return (
    <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-5 lg:pt-8 space-y-4 pb-6">
      <div className="flex flex-col items-center text-center pt-2">
        <Av ini={ME.ini} sz="lg" accent />
        <p className="font-extrabold text-2xl mt-3">{ME.name}</p>
        <p className="text-sm text-muted-foreground">{challenge.emoji} {challenge.name}</p>
      </div>

      <Card className="!p-4">
        <div className="flex justify-between items-baseline mb-2.5">
          <SecLabel>Progress</SecLabel>
          <span className="text-xs font-bold" style={{ color: BRAND_COLOR }}>Day {ME.day} / {ME.total}</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BRAND_COLOR }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{ME.total - ME.day} days remaining</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Challenge score", value: ME_SCORE, unit: "pts total" },
          { label: "Breakdown", value: `${ME_RESULTS.filter(r => r.scoreKey !== "missed").length}/${ME_RESULTS.length}`, unit: "tasks done" },
          { label: "Run pts", value: ME_RESULTS.filter(r => r.type === "running").reduce((a, r) => a + SCORE[r.scoreKey], 0), unit: `+${SCORE.running_on_time} on time / +${SCORE.running_late} late` },
          { label: "Task pts", value: ME_RESULTS.filter(r => r.type === "task").reduce((a, r) => a + SCORE[r.scoreKey], 0), unit: `+${SCORE.task_completed} per task` },
        ].map(s => (
          <Card key={s.label} className="!p-4">
            <SecLabel>{s.label}</SecLabel>
            <p style={{ ...bc, fontSize: 30, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.unit}</p>
          </Card>
        ))}
      </div>

      <Card className="!p-4">
        <SecLabel>Lives remaining</SecLabel>
        <div className="flex gap-3 justify-center py-3">
          <Hearts n={ME.lives} sz={28} />
        </div>
      </Card>

      <Card className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={15} className="text-muted-foreground" />
          <SecLabel>Timezone</SecLabel>
          {adminTzAuto && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 ml-1">auto-detected</span>
          )}
        </div>
        <TimezoneSettings tz={adminTz} isAuto={adminTzAuto} onChange={tz => { setAdminTz(tz); setAdminTzAuto(false); }} />
        <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
          Used to show your local time alongside participants' submission times in Organizer Review and activity feed.
        </p>
      </Card>
    </div>
  );
}
