import { useState, useEffect } from "react";
import {
  CalendarDays, Award, Sliders, UserCheck, Users, ChevronRight,
  Copy, CheckCircle2, ChevronLeft, Loader2, Trash2, Clock,
} from "lucide-react";
import { useNavigate } from "react-router";
import { Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, bc } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";
import { createAchievementDoc, getUpcomingTasks, deleteTask } from "../lib/firestore";
import type { AchievementConditionType, Task } from "../types";
import { CreateTaskShell } from "../components/CreateTaskShell";

// ── Main ManageScreen ─────────────────────────────────────────────────────────

export function ManageScreen() {
  const { challenge, userRole, setSelectedId } = useAppContext();
  const navigate = useNavigate();

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showUpcomingTasks, setShowUpcomingTasks] = useState(false);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [achForm, setAchForm] = useState({
    icon: "⭐", name: "", desc: "",
    conditionType: "tasks_total" as AchievementConditionType,
    conditionThreshold: "7",
  });
  const [achSaving, setAchSaving] = useState(false);
  const [showCreateAch, setShowCreateAch] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const copyCode = () => {
    navigator.clipboard?.writeText(challenge.inviteCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  useEffect(() => {
    if (!showUpcomingTasks) return;
    setUpcomingLoading(true);
    setUpcomingError(null);
    const todayISO = new Date().toISOString().slice(0, 10);
    getUpcomingTasks(challenge.id, todayISO)
      .then(tasks => { setUpcomingTasks(tasks); setUpcomingLoading(false); })
      .catch(() => { setUpcomingError("Не удалось загрузить задания"); setUpcomingLoading(false); });
  }, [showUpcomingTasks, challenge.id]);

  const handleDeleteTask = async (task: Task) => {
    if (!window.confirm(`Удалить задание «${task.title}»?`)) return;
    setDeletingTaskId(task.id);
    try {
      await deleteTask(challenge.id, task.id);
      setUpcomingTasks(prev => prev.filter(t => t.id !== task.id));
    } catch {
      alert("Не удалось удалить задание");
    } finally {
      setDeletingTaskId(null);
    }
  };

  const ownerItems = userRole === "owner" ? [
    { icon: <Sliders size={20} />,     label: "Настройки челленджа",   sub: "Дни, штрафы, жизни, дедлайн",                                                         action: () => navigate("/app/settings") },
    { icon: <UserCheck size={20} />,   label: "Управление участниками", sub: "Настроить жизни, зафиксировать штрафы",                                                action: () => navigate("/app/participants") },
    { icon: <Users size={20} />,       label: "Команда",               sub: `${challenge.team.length} участник${challenge.team.length !== 1 ? "ов" : ""} · пригласить помощников`, action: () => navigate("/app/team") },
    { icon: <ChevronLeft size={20} />, label: "Все челленджи",         sub: "Переключить или создать новый",                                                         action: () => { setSelectedId(null); navigate("/challenges"); } },
  ] : [];

  const menuItems = [
    { icon: <CalendarDays size={20} />, label: "Создать задание",         sub: "Запланировать новое задание",           action: () => setShowCreateTask(true) },
    { icon: <Clock size={20} />,        label: "Запланированные задания",  sub: "Просмотр и удаление будущих заданий",   action: () => setShowUpcomingTasks(true) },
    { icon: <Award size={20} />,        label: "Создать достижение",       sub: "Добавить значок или веху",              action: () => setShowCreateAch(true) },
    ...ownerItems,
  ];

  if (showCreateTask) return (
    <CreateTaskShell challengeId={challenge.id} onDone={() => setShowCreateTask(false)} />
  );

  if (showUpcomingTasks) {
    const fmtDate = (iso: string) => {
      if (!iso || iso.length < 10) return iso;
      const [y, m, d] = iso.split("-");
      return `${d}.${m}.${y}`;
    };
    const TYPE_LABELS: Record<string, string> = { running: "Пробежка", checklist: "Чеклист", freeform: "Свободный" };
    return (
      <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-4 max-w-[600px] mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setShowUpcomingTasks(false)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
            ← Назад
          </button>
          <p className="font-extrabold text-lg">Запланированные задания</p>
        </div>
        {upcomingLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {upcomingError && (
          <p className="text-sm text-red-500 text-center py-6">{upcomingError}</p>
        )}
        {!upcomingLoading && !upcomingError && upcomingTasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">Нет запланированных заданий</p>
        )}
        {!upcomingLoading && !upcomingError && upcomingTasks.length > 0 && (
          <div className="space-y-2">
            {upcomingTasks.map(task => {
              const isExpanded = expandedTaskId === task.id;
              return (
                <Card key={task.id} className="!p-0 overflow-hidden">
                  <button
                    className="w-full text-left px-4 py-3 flex items-center gap-3"
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  >
                    <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0" style={{ color: BRAND_COLOR }}>
                      <CalendarDays size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-semibold">{fmtDate(task.date)}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {TYPE_LABELS[task.type] ?? task.type}
                        </span>
                        {task.deadline && (
                          <span className="text-[10px] text-muted-foreground">до {task.deadline}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} className={`text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 space-y-3">
                      {task.description ? (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Нет описания</p>
                      )}
                      {task.checklistItems && task.checklistItems.length > 0 && (
                        <ul className="space-y-1">
                          {task.checklistItems.map((item, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={() => handleDeleteTask(task)}
                        disabled={deletingTaskId === task.id}
                        className="flex items-center gap-1.5 text-xs font-bold text-red-500 disabled:opacity-40"
                      >
                        {deletingTaskId === task.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Trash2 size={12} />}
                        Удалить задание
                      </button>
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

  const COND_TYPES: { type: AchievementConditionType; label: string; hasThreshold: boolean; placeholder: string }[] = [
    { type: "tasks_total", label: "Заданий выполнено",       hasThreshold: true,  placeholder: "7"  },
    { type: "km_total",    label: "Км набегано",             hasThreshold: true,  placeholder: "25" },
    { type: "streak",      label: "Серия без пропусков",     hasThreshold: true,  placeholder: "10" },
    { type: "first_week",  label: "Первая неделя (7 дней)",  hasThreshold: false, placeholder: ""   },
    { type: "days_half",   label: "Полпути пройдено",        hasThreshold: false, placeholder: ""   },
    { type: "custom",      label: "Ручная отметка",          hasThreshold: false, placeholder: ""   },
  ];

  const saveAch = async () => {
    if (!achForm.name.trim() || achSaving) return;
    setAchSaving(true);
    try {
      const ct = achForm.conditionType;
      const needsThreshold = COND_TYPES.find(c => c.type === ct)?.hasThreshold ?? false;
      await createAchievementDoc(challenge.id, {
        icon: achForm.icon,
        title: achForm.name.trim(),
        desc: achForm.desc.trim(),
        conditionType: ct,
        ...(needsThreshold ? { conditionThreshold: parseInt(achForm.conditionThreshold) || 1 } : {}),
      });
      setAchForm({ icon: "⭐", name: "", desc: "", conditionType: "tasks_total", conditionThreshold: "7" });
      setShowCreateAch(false);
    } finally {
      setAchSaving(false);
    }
  };

  if (showCreateAch) return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 space-y-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => setShowCreateAch(false)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          ← Назад
        </button>
        <p className="font-extrabold text-lg">Создать достижение</p>
      </div>
      <Card className="!p-4 space-y-3">
        <div>
          <SecLabel>Значок</SecLabel>
          <div className="flex gap-2 mt-2 flex-wrap">
            {["⭐", "🔥", "🏆", "💪", "🎯", "🌟", "⚡", "🦁", "🏃", "❤️"].map(ico => (
              <button key={ico} onClick={() => setAchForm(f => ({ ...f, icon: ico }))}
                className={`text-2xl w-12 h-12 rounded-xl border-2 ${achForm.icon === ico ? "border-orange-400 bg-orange-50" : "border-border bg-muted"}`}>{ico}</button>
            ))}
          </div>
        </div>
        <div>
          <SecLabel>Название</SecLabel>
          <input placeholder="напр. Клуб 25 км" value={achForm.name} onChange={e => setAchForm(f => ({ ...f, name: e.target.value }))}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none" />
        </div>
        <div>
          <SecLabel>Описание</SecLabel>
          <input placeholder="напр. Пробежали 25 км суммарно" value={achForm.desc} onChange={e => setAchForm(f => ({ ...f, desc: e.target.value }))}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none" />
        </div>
        <div>
          <SecLabel>Условие разблокировки</SecLabel>
          <div className="mt-1.5 space-y-1">
            {COND_TYPES.map(ct => (
              <button key={ct.type} onClick={() => setAchForm(f => ({ ...f, conditionType: ct.type }))}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-left"
                style={achForm.conditionType === ct.type
                  ? { background: BRAND_COLOR + "15", borderColor: BRAND_COLOR, color: BRAND_COLOR, fontWeight: 700 }
                  : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${achForm.conditionType === ct.type ? "border-current bg-current" : "border-current"}`} />
                {ct.label}
              </button>
            ))}
          </div>
        </div>
        {COND_TYPES.find(c => c.type === achForm.conditionType)?.hasThreshold && (
          <div>
            <SecLabel>Порог</SecLabel>
            <input type="number" min={1} value={achForm.conditionThreshold}
              onChange={e => setAchForm(f => ({ ...f, conditionThreshold: e.target.value }))}
              className="mt-1.5 w-28 bg-muted rounded-xl px-3 py-2 text-sm font-bold outline-none text-center" />
          </div>
        )}
        <button onClick={saveAch} disabled={!achForm.name.trim() || achSaving}
          className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-35" style={{ background: BRAND_COLOR }}>
          {achSaving ? "Сохранение…" : "Создать достижение"}
        </button>
      </Card>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <p className="font-extrabold text-xl">Управление</p>
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
          userRole === "owner"
            ? "bg-purple-50 text-purple-600 border-purple-200"
            : "bg-blue-50 text-blue-600 border-blue-200"
        }`}>
          {userRole === "owner" ? "Владелец" : "Организатор"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{challenge.emoji} {challenge.name}</p>

      <Card className="!p-4 mb-4 border-blue-100 bg-blue-50">
        <SecLabel>Код приглашения</SecLabel>
        <div className="flex items-center justify-between mt-2">
          <p style={{ ...bc, fontSize: 24, fontWeight: 900 }}>{challenge.inviteCode}</p>
          <button onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-200 bg-white text-blue-600">
            {copiedCode ? <CheckCircle2 size={12} /> : <Copy size={12} />}
            {copiedCode ? "Скопировано!" : "Копировать"}
          </button>
        </div>
        <p className="text-xs text-blue-500 mt-1 font-semibold">Поделитесь кодом, чтобы участники могли присоединиться</p>
      </Card>

      <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-2 lg:space-y-0">
        {menuItems.map(m => (
          <button key={m.label} onClick={m.action} className="w-full text-left">
            <Card className="!p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0" style={{ color: BRAND_COLOR }}>{m.icon}</div>
              <div className="flex-1 min-w-0"><p className="font-bold text-sm">{m.label}</p><p className="text-xs text-muted-foreground">{m.sub}</p></div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
