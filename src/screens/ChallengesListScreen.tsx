import { useState } from "react";
import { Plus, CheckCircle2, Copy, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { Av, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { challengeCurrentDay } from "../lib/dates";
import type { ChallengeData, ChallengeStatus } from "../types";

const STATUS_COLOR: Record<ChallengeStatus, string> = {
  active: "#22C55E", completed: "#8C8C9A", upcoming: "#3B82F6",
};
const STATUS_LABEL: Record<ChallengeStatus, string> = {
  active: "Активен", completed: "Завершён", upcoming: "Предстоящий",
};

function ChallengeCard({ ch, onSelect }: { ch: ChallengeData; onSelect: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `displine.vercel.app/join?code=${ch.inviteCode}`;
  const currentDay = challengeCurrentDay(ch.startDate, ch.duration);

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(`https://${link}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="!p-0 overflow-hidden">
      <button onClick={onSelect} className="w-full text-left p-4 flex items-start gap-3">
        <div className="text-3xl w-12 h-12 rounded-2xl bg-muted flex items-center justify-center shrink-0">{ch.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-extrabold text-base leading-none">{ch.name}</p>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: STATUS_COLOR[ch.status] + "20", color: STATUS_COLOR[ch.status] }}>
              {STATUS_LABEL[ch.status]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2 truncate">{ch.description}</p>
          {ch.status === "active" && (
            <>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className="h-full rounded-full" style={{ width: `${(currentDay / ch.duration) * 100}%`, background: BRAND_COLOR }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                <span>День {currentDay} / {ch.duration}</span>
                <span>{ch.participants.length} участников</span>
              </div>
            </>
          )}
          {ch.status !== "active" && (
            <p className="text-[10px] text-muted-foreground font-semibold">{ch.duration} дней · {ch.participants.length} участников</p>
          )}
        </div>
        <ArrowRight size={16} className="text-muted-foreground shrink-0 mt-1" />
      </button>
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/50">
        <p className="text-[11px] text-muted-foreground font-mono truncate mr-3">{link}</p>
        <button onClick={copyLink}
          className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-border bg-card transition-colors"
          style={copied ? { color: "#22C55E", borderColor: "#BBF7D0" } : { color: BRAND_COLOR }}>
          {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
          {copied ? "Скопировано!" : "Копировать"}
        </button>
      </div>
    </Card>
  );
}

export function ChallengesListScreen() {
  const { challenges, setSelectedId } = useAppContext();
  const { userProfile } = useAuthContext();
  const navigate = useNavigate();

  const onSelect = (id: string) => {
    setSelectedId(id);
    navigate("/app/home");
  };

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-8 space-y-5 max-w-[720px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground">Организатор</p>
          <h1 className="font-extrabold text-2xl leading-tight">Мои челленджи</h1>
        </div>
        <Av ini={userProfile?.ini ?? "?"} sz="md" accent admin />
      </div>

      <button onClick={() => navigate("/challenges/create")}
        className="w-full lg:w-auto lg:px-8 py-4 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2"
        style={{ background: BRAND_COLOR }}>
        <Plus size={18} /> Создать челлендж
      </button>

      {(["active", "upcoming", "completed"] as ChallengeStatus[]).map(status => {
        const group = challenges.filter(c => c.status === status);
        if (!group.length) return null;
        const labels: Record<ChallengeStatus, string> = { active: "Активные", upcoming: "Предстоящие", completed: "Завершённые" };
        return (
          <div key={status} className={status === "completed" ? "opacity-60" : ""}>
            <SecLabel>{labels[status]}</SecLabel>
            <div className="mt-2 lg:grid lg:grid-cols-2 lg:gap-3 space-y-3 lg:space-y-0">
              {group.map(ch => (
                <ChallengeCard key={ch.id} ch={ch} onSelect={() => onSelect(ch.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
