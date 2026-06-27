import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { Av, Hearts, Card, Chip, FeedCard } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { calcScore } from "../lib/scoring";
import { useAppContext } from "../contexts/AppContext";
import { checkAchievement } from "../lib/achievements";
import type { CommTab, SortKey, FeedItem } from "../types";

export function CommunityScreen() {
  const { challenge, updateChallenge, isAdmin, adminTz, scoring, achievements, meParticipant } = useAppContext();
  const navigate = useNavigate();

  const [tab, setTab] = useState<CommTab>("feed");
  const [sort, setSort] = useState<SortKey>("score");

  const sorted = [...challenge.participants].sort((a, b) =>
    sort === "score" ? calcScore(b.results, scoring) - calcScore(a.results, scoring) : b.km - a.km
  );

  const onViewParticipant = (uid: string) => navigate(`/participants/${uid}`);

  const handleLike = (id: string) => updateChallenge(challenge.id,
    { feed: challenge.feed.map((f: FeedItem) => f.id === id ? { ...f, likes: [...f.likes] } : f) }
  );

  const handleComment = (id: string, text: string) => updateChallenge(challenge.id,
    { feed: challenge.feed.map((f: FeedItem) => f.id === id ? { ...f, socialComments: [...f.socialComments, { ini: "ЕС", name: "Ерлан С.", text }] } : f) }
  );

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 max-w-[720px] mx-auto">
      <h2 className="font-extrabold text-xl mb-4">Сообщество</h2>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {(["feed", "leaderboard", "achievements"] as CommTab[]).map(t => (
          <Chip key={t} label={t === "feed" ? "Активность" : t === "leaderboard" ? "Таблица лидеров" : "Достижения"}
            active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>

      {tab === "feed" && (
        <div className="pb-4">
          <p className="text-xs text-muted-foreground font-semibold mb-3">Все отправки — одобренные, отклонённые и ожидающие. Полная прозрачность.</p>
          <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-3 lg:space-y-0">
            {challenge.feed.map(f => (
              <FeedCard key={f.id} item={f} onLike={handleLike} onComment={handleComment}
                onViewParticipant={onViewParticipant} participants={challenge.participants}
                isAdmin={isAdmin} adminTz={adminTz} />
            ))}
          </div>
        </div>
      )}

      {tab === "leaderboard" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">{challenge.participants.length} участников</p>
            <div className="flex gap-1 bg-muted rounded-xl p-0.5">
              {(["score", "distance"] as SortKey[]).map(k => (
                <button key={k} onClick={() => setSort(k)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                  style={sort === k ? { background: "#fff", color: "#1A1A1A" } : { color: "#8C8C9A" }}>
                  {k === "score" ? "Очки" : "Дистанция"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 pb-4">
            {sorted.map((p, i) => (
              <div key={p.uid} className="flex items-center gap-3 p-3 rounded-2xl border"
                style={{ background: p.active ? "#fff" : "var(--muted)", borderColor: "var(--border)", opacity: p.active ? 1 : 0.55 }}>
                <span className="text-base w-6 text-center shrink-0">
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>}
                </span>
                <Av ini={p.ini} sz="sm" admin={p.isAdmin} onClick={() => onViewParticipant(p.uid)} />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewParticipant(p.uid)}>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold leading-none truncate">{p.name}</p>
                    {p.isAdmin && <span className="text-[9px] font-extrabold text-blue-500">ORG</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sort === "score" ? `${calcScore(p.results, scoring)} оч.` : `${p.km} км`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Hearts n={p.lives} sz={14} />
                  {!p.active && <span className="text-[10px] font-bold text-red-400">Выбыл</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "achievements" && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
          {achievements.length === 0 && (
            <p className="col-span-2 lg:col-span-3 text-sm text-muted-foreground text-center py-6">
              {isAdmin
                ? "Достижения ещё не созданы. Добавьте их в разделе «Управление»."
                : "Достижения ещё не созданы."}
            </p>
          )}
          {achievements.map(a => {
            const unlocked = meParticipant
              ? checkAchievement(a, meParticipant, challenge)
              : false;
            return (
              <Card key={a.id} className={`!p-4 ${!unlocked ? "opacity-40" : ""}`}>
                <p className="text-2xl mb-2">{a.icon}</p>
                <p className="font-extrabold text-sm leading-tight mb-1">{a.title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{a.desc}</p>
                {unlocked && (
                  <div className="flex items-center gap-1 mt-2">
                    <CheckCircle2 size={11} style={{ color: BRAND_COLOR }} />
                    <span className="text-[10px] font-bold" style={{ color: BRAND_COLOR }}>Разблокировано</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
