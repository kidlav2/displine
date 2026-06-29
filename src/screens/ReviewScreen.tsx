import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Camera, Activity, CheckSquare, Layers, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router";
import { Av, Card, Chip, SecLabel, StatusBadge, DualTimestamp, Lightbox } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { findCity, utcLabel, localNow } from "../lib/timezone";
import { fmtDate, dayToDate, parseChallengeStartDate } from "../lib/dates";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { reviewSubmission, logPenalty, resolvePostponement, type FeedActor } from "../lib/firestore";
import { CreateTaskShell } from "../components/CreateTaskShell";
import type { PostponementRequest, ReviewFilter, ReviewItem } from "../types";

export function ReviewScreen() {
  const { challenge, adminTz, meParticipant, postponementQueue } = useAppContext();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();

  const [reviewDay, setReviewDay] = useState(challenge.currentDay);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState("");
  const [actLoading, setActLoading] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const onViewParticipant = (uid: string) => navigate(`/participants/${uid}`);

  const challengeStart = parseChallengeStartDate(challenge.startDate);
  const d = dayToDate(reviewDay, challengeStart);
  const counts = {
    all:          challenge.queue.length,
    running:      challenge.queue.filter(q => q.type === "running").length,
    task:         challenge.queue.filter(q => q.type === "checklist" || q.type === "freeform").length,
    postponements: postponementQueue.length,
  };
  const filtered = challenge.queue.filter(q =>
    filter === "all" ||
    q.type === filter ||
    (filter === "task" && (q.type === "checklist" || q.type === "freeform"))
  );

  const FILTER_LABELS: { key: ReviewFilter; label: string }[] = [
    { key: "all",          label: `Все (${counts.all})`                         },
    { key: "running",      label: `Пробежка (${counts.running})`                },
    { key: "task",         label: `Задание (${counts.task})`                    },
    { key: "postponements", label: `Переносы (${counts.postponements})`         },
  ];

  const act = async (item: ReviewItem, status: "approved" | "rejected", latePenalty = false) => {
    setActLoading(true);
    try {
      await reviewSubmission(
        challenge.id,
        item.id,
        item.participantId,
        status,
        draftComment.trim(),
        item.scoreKey,
        latePenalty
      );
      if (latePenalty && status === "approved" && currentUser) {
        const actor: FeedActor | undefined = meParticipant ? {
          uid: currentUser.uid,
          name: meParticipant.name,
          ini: meParticipant.ini,
          isAdmin: meParticipant.isAdmin,
        } : undefined;
        await logPenalty(
          challenge.id,
          item.participantId,
          {
            reason: "Опоздание на пробежку",
            livesLost: 1,
            amount: challenge.settings.penaltyAmount,
            burpees: challenge.settings.burpees > 0 ? challenge.settings.burpees : undefined,
            loggedBy: currentUser.uid,
          },
          actor,
          item.name
        );
      }
    } catch (e) {
      console.error("[ReviewScreen] act failed:", e);
    } finally {
      setActLoading(false);
      setExpanded(null);
      setDraftComment("");
    }
  };

  const actPostponement = async (p: PostponementRequest, decision: "approved" | "rejected") => {
    setActLoading(true);
    try {
      await resolvePostponement(challenge.id, p.id, decision, draftComment.trim() || undefined);
    } catch (e) {
      console.error("[ReviewScreen] resolvePostponement failed:", e);
    } finally {
      setActLoading(false);
      setExpanded(null);
      setDraftComment("");
    }
  };

  const dateNav = (
    <div className="flex items-center gap-2">
      <button onClick={() => setReviewDay(v => Math.max(1, v - 1))}
        className="w-8 h-8 rounded-xl border border-border bg-card flex items-center justify-center"><ChevronLeft size={16} /></button>
      <div className="text-center">
        <p className="font-extrabold text-sm leading-none">{fmtDate(d)}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 font-semibold">День {reviewDay} / {challenge.duration}</p>
      </div>
      <button onClick={() => setReviewDay(v => Math.min(challenge.duration, v + 1))}
        className="w-8 h-8 rounded-xl border border-border bg-card flex items-center justify-center"><ChevronRight size={16} /></button>
    </div>
  );

  const filterPills = (
    <div className="flex flex-wrap gap-2">
      {FILTER_LABELS.map(f => (
        <Chip key={f.key} label={f.label} active={filter === f.key}
          onClick={() => { setFilter(f.key); setExpanded(null); }} />
      ))}
    </div>
  );

  const statusSummary = (
    <div className="space-y-1">
      {[
        { label: "На проверке",      count: challenge.queue.filter(q => q.status === "pending" || q.status === "in_progress").length, color: "#F59E0B" },
        { label: "Одобрено",         count: challenge.queue.filter(q => q.status === "approved").length,                               color: "#22C55E" },
        { label: "Отклонено / Оп.",  count: challenge.queue.filter(q => q.status === "rejected" || q.status === "late" || q.status === "missing").length, color: "#EF4444" },
      ].map(s => (
        <div key={s.label} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{s.label}</span>
          <span className="font-extrabold" style={{ color: s.color }}>{s.count}</span>
        </div>
      ))}
    </div>
  );

  const expandDetail = (item: ReviewItem) => {
    const runPhotos = ([item.checkInPhotoUrl, item.photoUrl].filter(Boolean)) as string[];
    const taskPhotos = ([item.photoUrl].filter(Boolean)) as string[];

    return (
    <div className="p-4 border-t border-border bg-muted/30">
      {/* Type-specific content */}
      {item.type === "running" && (
        <div className="mb-3">
          <div className="flex gap-2 mb-3">
            {runPhotos.length >= 2 ? (
              runPhotos.map((src, i) => (
                <button
                  key={i}
                  className="relative rounded-xl overflow-hidden bg-muted shrink-0"
                  style={{ width: 112, height: 80 }}
                  onClick={() => { setLightboxPhotos(runPhotos); setLightboxIdx(i); }}
                >
                  <img src={src} alt={i === 0 ? "Отм." : "Рез."} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/60 px-1 py-0.5 rounded">
                    {i === 0 ? "Отм." : "Рез."}
                  </span>
                </button>
              ))
            ) : runPhotos.length === 1 ? (
              <button
                className="rounded-xl overflow-hidden bg-muted shrink-0"
                style={{ width: 96, height: 64 }}
                onClick={() => { setLightboxPhotos(runPhotos); setLightboxIdx(0); }}
              >
                <img src={runPhotos[0]} alt="submission" className="w-full h-full object-cover" />
              </button>
            ) : (
              <div className="w-24 h-16 lg:w-32 lg:h-20 bg-muted rounded-xl flex items-center justify-center shrink-0">
                <Camera size={18} className="text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex gap-4 text-xs flex-wrap">
                <div>
                  <p className="text-muted-foreground mb-1">Отметка</p>
                  <DualTimestamp time={item.checkIn} participantTz={item.participantTz} adminTz={adminTz} />
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Результат</p>
                  <DualTimestamp time={item.resultT} participantTz={item.participantTz} adminTz={adminTz} />
                </div>
                {item.km && (
                  <div>
                    <p className="text-muted-foreground mb-1">Дистанция</p>
                    <p className="font-bold">{item.km} км</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground mb-1">Опоздание</p>
                  <p className={`font-bold ${item.isLate ? "text-orange-500" : "text-green-500"}`}>
                    {item.isLate ? "Да" : "Нет"}
                  </p>
                </div>
              </div>
              {item.stravaSource && (
                <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold text-white" style={{ background: "#FC5200" }}>
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                  </svg>
                  Strava
                </span>
              )}
              {item.text && <p className="text-xs text-muted-foreground leading-snug">{item.text}</p>}
            </div>
          </div>
        </div>
      )}

      {item.type === "checklist" && (
        <div className="mb-3">
          {item.photoUrl && (
            <button className="w-full mb-2" onClick={() => { setLightboxPhotos(taskPhotos); setLightboxIdx(0); }}>
              <img src={item.photoUrl} alt="submission" className="w-full max-h-40 rounded-xl object-cover" />
            </button>
          )}
          {item.text && (
            <div className="bg-muted rounded-xl px-3 py-2.5 text-sm text-muted-foreground leading-snug">
              {item.text}
            </div>
          )}
          {!item.text && !item.photoUrl && (
            <p className="text-xs text-muted-foreground">Нет текста или фото</p>
          )}
        </div>
      )}

      {item.type === "freeform" && (
        <div className="mb-3">
          {item.photoUrl && (
            <button className="w-full mb-2" onClick={() => { setLightboxPhotos(taskPhotos); setLightboxIdx(0); }}>
              <img src={item.photoUrl} alt="submission" className="w-full max-h-40 rounded-xl object-cover" />
            </button>
          )}
          {item.text && (
            <div className="bg-muted rounded-xl px-3 py-2.5 text-sm text-muted-foreground leading-snug">
              {item.text}
            </div>
          )}
        </div>
      )}

      {/* Organizer comment */}
      <div className="mb-3">
        <div className="flex items-center gap-1 mb-1"><SecLabel>Комментарий организатора</SecLabel></div>
        <textarea placeholder="Причина — видна только участнику…"
          value={draftComment} onChange={e => setDraftComment(e.target.value)} rows={2}
          className="w-full text-xs bg-muted rounded-xl px-3 py-2 outline-none resize-none placeholder-muted-foreground" />
      </div>

      {/* Actions */}
      {(item.status === "pending" || item.status === "in_progress" || item.status === "late") && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={() => act(item, "rejected")} disabled={actLoading}
              className="flex-1 py-2 rounded-xl border-2 border-red-200 text-red-500 font-bold text-sm disabled:opacity-50">
              Отклонить
            </button>
            <button onClick={() => act(item, "approved")} disabled={actLoading}
              className="flex-1 py-2 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ background: BRAND_COLOR }}>
              {actLoading ? "…" : "Одобрить"}
            </button>
          </div>
          <button onClick={() => act(item, "approved", true)} disabled={actLoading}
            className="w-full py-2 rounded-xl border-2 border-orange-200 bg-orange-50 text-orange-600 font-bold text-sm disabled:opacity-50">
            ⚡ Опоздание (принять, −1 жизнь)
          </button>
        </div>
      )}

      {lightboxPhotos.length > 0 && (
        <Lightbox photos={lightboxPhotos} initialIndex={lightboxIdx} onClose={() => setLightboxPhotos([])} />
      )}
    </div>
  );
  };

  const typeIcon = (type: ReviewItem["type"]) => {
    if (type === "running") return <Activity size={13} className="text-blue-400 shrink-0" />;
    if (type === "checklist") return <CheckSquare size={13} className="text-green-500 shrink-0" />;
    return <Layers size={13} className="text-purple-400 shrink-0" />;
  };

  const createTaskModal = showCreate && (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-card">
      <CreateTaskShell challengeId={challenge.id} onDone={() => setShowCreate(false)} />
    </div>
  );

  return (
    <>
      {createTaskModal}

      {/* ── MOBILE layout ── */}
      <div className="lg:hidden px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          {dateNav}
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs text-white" style={{ background: BRAND_COLOR }}>
            <Plus size={13} /> Создать задание
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-3 mb-2" style={{ scrollbarWidth: "none" }}>{filterPills}</div>

        {filter === "postponements" ? (
          <>
            {postponementQueue.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">Нет запросов на перенос</p>
            )}
            <div className="space-y-2">
              {postponementQueue.map(p => (
                <PostponementItem key={p.id} p={p} expanded={expanded === p.id}
                  onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                  draftComment={draftComment} onCommentChange={setDraftComment}
                  loading={actLoading} onAct={actPostponement} />
              ))}
            </div>
          </>
        ) : (
          <>
            {filter === "all" && postponementQueue.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground">Запросы на перенос</p>
                {postponementQueue.map(p => (
                  <PostponementItem key={p.id} p={p} expanded={expanded === p.id}
                    onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                    draftComment={draftComment} onCommentChange={setDraftComment}
                    loading={actLoading} onAct={actPostponement} />
                ))}
              </div>
            )}
            {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">Нет отправок</p>}
            <div className="space-y-2">
              {filtered.map(item => (
                <div key={item.id}>
                  <button onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="w-full text-left">
                    <Card className={`!p-3.5 ${expanded === item.id ? "rounded-b-none" : ""}`}
                      style={expanded === item.id ? { borderBottomColor: "transparent" } : {}}>
                      <div className="flex items-center gap-3">
                        <Av ini={item.ini} sz="sm" admin={item.isAdmin} onClick={e => { e.stopPropagation(); onViewParticipant(item.participantId); }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <button className="text-sm font-bold hover:underline leading-none" onClick={e => { e.stopPropagation(); onViewParticipant(item.participantId); }}>{item.name}</button>
                            {item.isAdmin && <span className="text-[9px] font-extrabold text-blue-500">ORG</span>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">{typeIcon(item.type)}{item.task || (item.type === "running" ? "Пробежка" : item.type === "checklist" ? "Чеклист" : "Произвольное")}</span>
                            {item.isLate && <span className="text-[10px] font-bold text-orange-400">оп.</span>}
                            {item.checkIn !== "—" && <DualTimestamp time={item.checkIn} participantTz={item.participantTz} adminTz={adminTz} label={false} />}
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    </Card>
                  </button>
                  {expanded === item.id && (
                    <Card className="rounded-t-none border-t-0">{expandDetail(item)}</Card>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden lg:flex h-[calc(100vh-0px)] overflow-hidden">
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto bg-card/50 px-5 py-6 space-y-5"
          style={{ scrollbarWidth: "none" }}>
          <div>
            <p className="font-extrabold text-lg mb-4">Проверка</p>
            {dateNav}
          </div>
          <div>
            <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground mb-2">Фильтр по типу</p>
            {filterPills}
          </div>
          <div>
            <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground mb-2">Сводка статусов</p>
            {statusSummary}
          </div>
          <div>
            <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground mb-2">Ваш часовой пояс</p>
            <div className="text-xs bg-muted rounded-xl px-3 py-2.5">
              <p className="font-semibold">{findCity(adminTz).city}</p>
              <p className="text-muted-foreground font-mono">{utcLabel(adminTz)} · now {localNow(adminTz)}</p>
              <p className="text-muted-foreground mt-1 text-[10px]">Метки показывают время участника + ваше время</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="w-full py-3 rounded-xl font-extrabold text-sm text-white flex items-center justify-center gap-2"
            style={{ background: BRAND_COLOR }}>
            <Plus size={14} /> Создать задание
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {filter === "postponements" ? (
            <div className="p-6 space-y-3">
              {postponementQueue.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Нет запросов на перенос</div>
              ) : postponementQueue.map(p => (
                <PostponementItem key={p.id} p={p} expanded={expanded === p.id}
                  onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                  draftComment={draftComment} onCommentChange={setDraftComment}
                  loading={actLoading} onAct={actPostponement} />
              ))}
            </div>
          ) : (
            <>
            {filter === "all" && postponementQueue.length > 0 && (
              <div className="p-6 pb-0 space-y-2">
                <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground mb-2">Запросы на перенос</p>
                {postponementQueue.map(p => (
                  <PostponementItem key={p.id} p={p} expanded={expanded === p.id}
                    onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                    draftComment={draftComment} onCommentChange={setDraftComment}
                    loading={actLoading} onAct={actPostponement} />
                ))}
              </div>
            )}
            {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Нет отправок за этот день</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                <tr className="text-left">
                  {["Участник", "Задание", "Отметка", "Результат", "Фото", "Статус", "Действия"].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-extrabold tracking-widest uppercase text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <>
                    <tr key={item.id}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Av ini={item.ini} sz="sm" admin={item.isAdmin}
                            onClick={e => { e.stopPropagation(); onViewParticipant(item.participantId); }} />
                          <div>
                            <button className="font-semibold hover:underline leading-none text-sm"
                              onClick={e => { e.stopPropagation(); onViewParticipant(item.participantId); }}>
                              {item.name}
                            </button>
                            {item.isAdmin && <span className="ml-1.5 text-[9px] font-extrabold text-blue-500">ORG</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {typeIcon(item.type)}
                          <span className="text-sm">{item.task || (item.type === "running" ? "Пробежка" : item.type === "checklist" ? "Чеклист" : "Произвольное")}</span>
                          {item.isLate && <span className="text-[10px] font-bold text-orange-400 ml-1">оп.</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3"><DualTimestamp time={item.checkIn} participantTz={item.participantTz} adminTz={adminTz} /></td>
                      <td className="px-4 py-3">
                        <DualTimestamp time={item.resultT} participantTz={item.participantTz} adminTz={adminTz} />
                        {item.km && <p className="text-xs text-muted-foreground mt-0.5">{item.km} км</p>}
                      </td>
                      <td className="px-4 py-3">
                        {item.photoUrl
                          ? <img src={item.photoUrl} alt="proof" className="w-10 h-10 rounded-lg object-cover" />
                          : <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Camera size={14} className="text-muted-foreground" /></div>
                        }
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3">
                        {(item.status === "pending" || item.status === "in_progress" || item.status === "late") ? (
                          <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setExpanded(item.id)}
                              className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-muted-foreground hover:bg-muted">
                              Проверить
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground capitalize">{item.status}</span>
                        )}
                      </td>
                    </tr>
                    {expanded === item.id && (
                      <tr key={`${item.id}-expand`} className="bg-muted/20">
                        <td colSpan={7} className="px-4 pb-3">
                          {expandDetail(item)}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Postponement review item ──────────────────────────────────────────────────
function PostponementItem({
  p, expanded, onToggle, draftComment, onCommentChange, loading, onAct,
}: {
  p: PostponementRequest;
  expanded: boolean;
  onToggle: () => void;
  draftComment: string;
  onCommentChange: (v: string) => void;
  loading: boolean;
  onAct: (p: PostponementRequest, decision: "approved" | "rejected") => void;
}) {
  const fmt = (iso: string) => {
    if (!iso || iso.length < 10) return iso;
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  };
  const typeLabel = p.type === "running" ? "Пробежка" : "Задание";

  return (
    <div>
      <button onClick={onToggle} className="w-full text-left">
        <Card className={`!p-3.5 ${expanded ? "rounded-b-none" : ""}`}
          style={expanded ? { borderBottomColor: "transparent" } : {}}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <CalendarDays size={14} className="text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold leading-none">{p.participantName}</p>
              </div>
              <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{typeLabel} · {p.taskTitle}</span>
                <span className="text-[10px] font-bold text-purple-600">{fmt(p.dateISO)} → до {fmt(p.targetDateISO)}</span>
              </div>
              {p.reason && (
                <p className="text-[11px] italic text-muted-foreground mt-0.5 truncate">«{p.reason}»</p>
              )}
            </div>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
              Ожидает
            </span>
          </div>
        </Card>
      </button>
      {expanded && (
        <Card className="rounded-t-none border-t-0">
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground mb-0.5">Участник</p>
                <p className="font-bold">{p.participantName}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Тип</p>
                <p className="font-bold">{typeLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Задание</p>
                <p className="font-bold">{p.taskTitle}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Оригинальная дата</p>
                <p className="font-bold">{fmt(p.dateISO)}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Запрошен перенос до</p>
                <p className="font-bold text-purple-700">{fmt(p.targetDateISO)}</p>
              </div>
            </div>
            {p.reason && (
              <div className="bg-muted rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-extrabold text-muted-foreground mb-1">ПРИЧИНА</p>
                <p className="text-xs text-foreground leading-snug">{p.reason}</p>
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground">Комментарий организатора (необязательно)</label>
              <textarea
                placeholder="Видна участнику после решения…"
                value={draftComment}
                onChange={e => onCommentChange(e.target.value)}
                rows={2}
                className="w-full mt-1 text-xs bg-muted rounded-xl px-3 py-2 outline-none resize-none placeholder-muted-foreground"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => onAct(p, "rejected")} disabled={loading}
                className="flex-1 py-2 rounded-xl border-2 border-red-200 text-red-500 font-bold text-sm disabled:opacity-50">
                Отклонить
              </button>
              <button onClick={() => onAct(p, "approved")} disabled={loading}
                className="flex-1 py-2 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                style={{ background: "#7C3AED" }}>
                {loading ? "…" : "Одобрить"}
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
