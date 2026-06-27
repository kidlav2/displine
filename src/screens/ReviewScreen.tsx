import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Camera, XCircle, CheckCircle2, Activity, CheckSquare, Layers } from "lucide-react";
import { useNavigate } from "react-router";
import { Av, Card, Chip, SecLabel, StatusBadge, DualTimestamp } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { findCity, utcLabel, localNow } from "../lib/timezone";
import { fmtDate, dayToDate, parseChallengeStartDate, todayISO } from "../lib/dates";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { reviewSubmission, createTask } from "../lib/firestore";
import type { ReviewFilter, ReviewItem } from "../types";

export function ReviewScreen() {
  const { challenge, adminTz } = useAppContext();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();

  const [reviewDay, setReviewDay] = useState(challenge.currentDay);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState("");
  const [actLoading, setActLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [taskForm, setTaskForm] = useState({
    date: todayISO(),
    type: "checklist", title: "", desc: "", deadline: "23:59",
  });
  const [taskCreated, setTaskCreated] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const onViewParticipant = (uid: string) => navigate(`/participants/${uid}`);

  const challengeStart = parseChallengeStartDate(challenge.startDate);
  const d = dayToDate(reviewDay, challengeStart);
  const counts = {
    all:       challenge.queue.length,
    running:   challenge.queue.filter(q => q.type === "running").length,
    checklist: challenge.queue.filter(q => q.type === "checklist").length,
  };
  const filtered = challenge.queue.filter(q => filter === "all" || q.type === filter);

  const FILTER_LABELS: { key: ReviewFilter; label: string }[] = [
    { key: "all",       label: `Все (${counts.all})`             },
    { key: "running",   label: `Пробежка (${counts.running})`    },
    { key: "checklist", label: `Чеклист (${counts.checklist})`   },
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
    } catch (e) {
      console.error("[ReviewScreen] reviewSubmission failed:", e);
    } finally {
      setActLoading(false);
      setExpanded(null);
      setDraftComment("");
    }
  };

  const submitTask = async () => {
    if (!taskForm.title.trim() || !currentUser) return;
    setTaskError(null);
    try {
      await createTask(challenge.id, {
        date:        taskForm.date,
        title:       taskForm.title.trim(),
        description: taskForm.desc.trim(),
        deadline:    taskForm.deadline,
        type:        taskForm.type as "running" | "checklist" | "freeform",
        createdBy:   currentUser.uid,
      }, currentUser.uid);
      setTaskCreated(true);
      setTimeout(() => {
        setShowCreate(false);
        setTaskCreated(false);
        setTaskForm(f => ({ ...f, title: "", desc: "" }));
      }, 1500);
    } catch {
      setTaskError("Не удалось создать задание. Попробуйте снова.");
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

  const expandDetail = (item: ReviewItem) => (
    <div className="p-4 border-t border-border bg-muted/30">
      {/* Type-specific content */}
      {item.type === "running" && (
        <div className="flex gap-3 mb-3">
          {item.photoUrl ? (
            <img src={item.photoUrl} alt="submission" className="w-24 h-16 lg:w-32 lg:h-20 rounded-xl object-cover shrink-0" />
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
            {item.text && <p className="text-xs text-muted-foreground leading-snug">{item.text}</p>}
          </div>
        </div>
      )}

      {item.type === "checklist" && (
        <div className="mb-3">
          {item.photoUrl && (
            <img src={item.photoUrl} alt="submission" className="w-full max-h-40 rounded-xl object-cover mb-2" />
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
            <img src={item.photoUrl} alt="submission" className="w-full max-h-40 rounded-xl object-cover mb-2" />
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
    </div>
  );

  const typeIcon = (type: ReviewItem["type"]) => {
    if (type === "running") return <Activity size={13} className="text-blue-400 shrink-0" />;
    if (type === "checklist") return <CheckSquare size={13} className="text-green-500 shrink-0" />;
    return <Layers size={13} className="text-purple-400 shrink-0" />;
  };

  const createTaskModal = showCreate && (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 lg:p-8">
      <div className="bg-card rounded-t-3xl lg:rounded-3xl w-full lg:max-w-[480px] px-5 pt-5 pb-8 lg:pb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-extrabold text-lg">Создать задание</p>
          <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-xl border border-border flex items-center justify-center"><XCircle size={16} className="text-muted-foreground" /></button>
        </div>
        {taskCreated ? (
          <div className="flex flex-col items-center py-8 gap-3"><CheckCircle2 size={40} className="text-green-500" /><p className="font-bold text-lg">Задание создано!</p></div>
        ) : (
          <div className="space-y-3">
            <div><SecLabel>Тип задания</SecLabel>
              <div className="flex gap-2 mt-1.5">
                {[["running","Пробежка"],["checklist","Чеклист"],["freeform","Произвольное"]].map(([t, label]) => (
                  <button key={t} onClick={() => setTaskForm(f => ({ ...f, type: t }))}
                    className="flex-1 py-2 rounded-xl text-xs font-bold border-2"
                    style={taskForm.type === t ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)" }}>{label}</button>
                ))}</div></div>
            <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-3 lg:space-y-0">
              <div><SecLabel>Название</SecLabel>
                <input placeholder="напр. Читать 30 минут" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none" /></div>
              <div><SecLabel>Дедлайн</SecLabel>
                <input value={taskForm.deadline} onChange={e => setTaskForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none" /></div>
            </div>
            <div><SecLabel>Описание</SecLabel>
              <textarea placeholder="Инструкции…" value={taskForm.desc} onChange={e => setTaskForm(f => ({ ...f, desc: e.target.value }))} rows={2}
                className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none resize-none" /></div>
            {taskError && <p className="text-xs font-bold text-red-500 text-center">{taskError}</p>}
            <button onClick={submitTask} disabled={!taskForm.title.trim()}
              className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-35" style={{ background: BRAND_COLOR }}>Создать задание</button>
          </div>
        )}
      </div>
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
        </div>
      </div>
    </>
  );
}
