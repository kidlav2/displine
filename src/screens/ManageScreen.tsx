import { useState, useRef } from "react";
import {
  CalendarDays, Award, Sliders, UserCheck, Users, ChevronRight,
  Activity, CheckSquare, LayoutGrid, Copy, CheckCircle2,
  Plus, Trash2,
} from "lucide-react";
import { useNavigate } from "react-router";
import { Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, ALL_DAYS, bc } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { createTask, createTaskTemplate, createAchievementDoc } from "../lib/firestore";
import type { AchievementConditionType } from "../types";
import { todayISO } from "../lib/dates";
import type { Task, TaskTemplate } from "../types";

type TaskType = "running" | "checklist" | "freeform";

const TASK_TYPES: { type: TaskType; Icon: React.ElementType; label: string; desc: string }[] = [
  { type: "running",   Icon: Activity,    label: "Пробежка",    desc: "Отметка + GPS" },
  { type: "checklist", Icon: CheckSquare, label: "Чеклист",     desc: "Пошаговые задания" },
  { type: "freeform",  Icon: LayoutGrid,  label: "Произвольное",desc: "Фото или текст" },
];

// ── Running form ──────────────────────────────────────────────────────────────

function RunningForm({ challengeId, onDone }: { challengeId: string; onDone: () => void }) {
  const { currentUser } = useAuthContext();
  const [title, setTitle] = useState("Утренняя пробежка");
  const [description, setDescription] = useState("");
  const [runSchedule, setRunSchedule] = useState<Record<string, string>>({ Tue: "06:00", Thu: "06:00", Sat: "06:00", Sun: "07:00" });
  const [expectedKm, setExpectedKm] = useState("");
  const [minDurationMin, setMinDurationMin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: string) => setRunSchedule(p => {
    if (d in p) { const n = { ...p }; delete n[d]; return n; }
    return { ...p, [d]: "06:00" };
  });
  const setDayTime = (d: string, t: string) => setRunSchedule(p => ({ ...p, [d]: t }));

  const canSubmit = Object.keys(runSchedule).length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !currentUser || loading) return;
    setLoading(true); setError(null);
    try {
      const fallbackDeadline = Object.values(runSchedule)[0] ?? "06:00";
      const template: Omit<TaskTemplate, "id"> = {
        title: title.trim() || "Утренняя пробежка",
        description: description.trim(),
        deadline: fallbackDeadline,
        type: "running",
        repeatDays: Object.keys(runSchedule),
        active: true,
        createdBy: currentUser.uid,
        deadlineByDay: runSchedule,
        ...(expectedKm ? { expectedKm: parseFloat(expectedKm) } : {}),
        ...(minDurationMin ? { minDurationMin: parseInt(minDurationMin) } : {}),
      };
      await createTaskTemplate(challengeId, template, currentUser.uid);
      onDone();
    } catch { setError("Не удалось сохранить. Попробуйте снова."); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="!p-4 space-y-3">
        <div>
          <SecLabel>Название</SecLabel>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" />
        </div>
        <div>
          <SecLabel>Описание (необязательно)</SecLabel>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            placeholder="Любые заметки для участников…"
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
        </div>
      </Card>

      <Card className="!p-4 space-y-2">
        <p className="font-bold text-sm">Дни пробежек и дедлайны</p>
        <p className="text-xs text-muted-foreground">Создаёт повторяющееся задание для каждого выбранного дня.</p>
        {ALL_DAYS.map(d => {
          const selected = d in runSchedule;
          return (
            <div key={d} className="flex items-center gap-2">
              <button onClick={() => toggleDay(d)}
                className="w-14 py-1.5 rounded-xl text-xs font-bold border-2 shrink-0 transition-colors"
                style={selected ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)", color: "#8C8C9A" }}>
                {d}
              </button>
              {selected && (
                <input type="time" value={runSchedule[d]} onChange={e => setDayTime(d, e.target.value)}
                  className="bg-muted rounded-xl px-3 py-1.5 text-sm font-extrabold outline-none"
                  style={{ ...bc, fontSize: 15 }} />
              )}
            </div>
          );
        })}
      </Card>

      <Card className="!p-4 space-y-3">
        <div>
          <SecLabel>Мин. длительность пробежки (авто-проверка)</SecLabel>
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" min="1" value={minDurationMin} onChange={e => setMinDurationMin(e.target.value)}
              placeholder="напр. 15"
              className="w-28 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none text-center" />
            <span className="text-sm text-muted-foreground font-semibold">мин</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Отправки менее этой длительности отклоняются автоматически.</p>
        </div>
        <div>
          <SecLabel>Ожидаемая дистанция (необязательно)</SecLabel>
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" step="0.1" min="0" value={expectedKm} onChange={e => setExpectedKm(e.target.value)}
              placeholder="напр. 5"
              className="w-28 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none text-center" />
            <span className="text-sm text-muted-foreground font-semibold">км</span>
          </div>
        </div>
      </Card>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
      <button onClick={handleSubmit} disabled={!canSubmit || loading}
        className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-35"
        style={{ background: BRAND_COLOR }}>
        {loading ? "Сохранение…" : "Создать повтор. пробежку"}
      </button>
    </div>
  );
}

// ── Checklist form ────────────────────────────────────────────────────────────

function ChecklistForm({ challengeId, onDone }: { challengeId: string; onDone: () => void }) {
  const { currentUser } = useAuthContext();
  const [title, setTitle] = useState("");
  const [items, setItems] = useState(["", ""]);
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("23:59");
  const [recurring, setRecurring] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastItemRef = useRef<HTMLInputElement>(null);

  const setItem = (i: number, v: string) => setItems(p => p.map((x, j) => j === i ? v : x));
  const removeItem = (i: number) => setItems(p => p.filter((_, j) => j !== i));
  const addItem = () => {
    setItems(p => [...p, ""]);
    setTimeout(() => lastItemRef.current?.focus(), 50);
  };
  const toggleRepeatDay = (d: string) =>
    setRepeatDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  const filledItems = items.filter(x => x.trim());
  const canSubmit = title.trim() && filledItems.length > 0 && (!recurring || repeatDays.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || !currentUser || loading) return;
    setLoading(true); setError(null);
    try {
      if (recurring) {
        const template: Omit<TaskTemplate, "id"> = {
          title: title.trim(), description: description.trim(),
          deadline, type: "checklist", repeatDays, active: true,
          createdBy: currentUser.uid, checklistItems: filledItems,
        };
        await createTaskTemplate(challengeId, template, currentUser.uid);
      } else {
        const task: Omit<Task, "id"> = {
          date, title: title.trim(), description: description.trim(),
          deadline, type: "checklist", createdBy: currentUser.uid,
          checklistItems: filledItems,
        };
        await createTask(challengeId, task, currentUser.uid);
      }
      onDone();
    } catch { setError("Не удалось сохранить. Попробуйте снова."); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="!p-4 space-y-3">
        <div>
          <SecLabel>Название</SecLabel>
          <input placeholder="напр. Утреннее ведение журнала" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" />
        </div>
        <div>
          <SecLabel>Пункты чеклиста</SecLabel>
          <div className="mt-1.5 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                <input
                  ref={i === items.length - 1 ? lastItemRef : undefined}
                  value={item}
                  onChange={e => setItem(i, e.target.value)}
                  placeholder={`Пункт ${i + 1}`}
                  className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm outline-none"
                />
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-red-500 shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addItem}
            className="mt-2 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-dashed border-border text-muted-foreground w-full justify-center">
            <Plus size={13} /> Добавить пункт
          </button>
        </div>
        <div>
          <SecLabel>Описание (необязательно)</SecLabel>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            placeholder="Любой контекст для участников…"
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
        </div>
        <div>
          <SecLabel>Дедлайн</SecLabel>
          <input type="time" value={deadline} onChange={e => setDeadline(e.target.value)}
            className="mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-extrabold outline-none"
            style={{ ...bc, fontSize: 16 }} />
        </div>
      </Card>

      <Card className="!p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">Повторяющееся</p>
            <p className="text-xs text-muted-foreground mt-0.5">Повторять в выбранные дни недели</p>
          </div>
          <button onClick={() => setRecurring(v => !v)}
            className="w-11 h-6 rounded-full relative transition-colors"
            style={{ background: recurring ? BRAND_COLOR : "var(--muted)" }}>
            <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
              style={{ left: recurring ? "calc(100% - 1.375rem)" : "0.125rem" }} />
          </button>
        </div>
        {recurring ? (
          <div>
            <SecLabel>Повторять по</SecLabel>
            <div className="flex gap-2 flex-wrap mt-2">
              {ALL_DAYS.map(d => (
                <button key={d} onClick={() => toggleRepeatDay(d)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-colors"
                  style={repeatDays.includes(d) ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)", color: "#8C8C9A" }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <SecLabel>Дата</SecLabel>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" />
          </div>
        )}
      </Card>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
      <button onClick={handleSubmit} disabled={!canSubmit || loading}
        className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-35"
        style={{ background: BRAND_COLOR }}>
        {loading ? "Сохранение…" : recurring ? "Создать повтор. задание" : "Создать задание"}
      </button>
    </div>
  );
}

// ── Freeform form ─────────────────────────────────────────────────────────────

function FreeformForm({ challengeId, onDone }: { challengeId: string; onDone: () => void }) {
  const { currentUser } = useAuthContext();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("23:59");
  const [recurring, setRecurring] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRepeatDay = (d: string) =>
    setRepeatDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  const canSubmit = title.trim() && (!recurring || repeatDays.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || !currentUser || loading) return;
    setLoading(true); setError(null);
    try {
      if (recurring) {
        const template: Omit<TaskTemplate, "id"> = {
          title: title.trim(), description: description.trim(),
          deadline, type: "freeform", repeatDays, active: true,
          createdBy: currentUser.uid,
        };
        await createTaskTemplate(challengeId, template, currentUser.uid);
      } else {
        const task: Omit<Task, "id"> = {
          date, title: title.trim(), description: description.trim(),
          deadline, type: "freeform", createdBy: currentUser.uid,
        };
        await createTask(challengeId, task, currentUser.uid);
      }
      onDone();
    } catch { setError("Не удалось сохранить. Попробуйте снова."); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="!p-4 space-y-3">
        <div>
          <SecLabel>Название</SecLabel>
          <input placeholder="напр. Читать 30 минут" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" />
        </div>
        <div>
          <SecLabel>Описание</SecLabel>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
            placeholder="Опишите, что нужно сделать и какое подтверждение требуется…"
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none resize-none leading-relaxed" />
        </div>
        <div>
          <SecLabel>Дедлайн</SecLabel>
          <input type="time" value={deadline} onChange={e => setDeadline(e.target.value)}
            className="mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-extrabold outline-none"
            style={{ ...bc, fontSize: 16 }} />
        </div>
      </Card>

      <Card className="!p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">Повторяющееся</p>
            <p className="text-xs text-muted-foreground mt-0.5">Повторять в выбранные дни недели</p>
          </div>
          <button onClick={() => setRecurring(v => !v)}
            className="w-11 h-6 rounded-full relative transition-colors"
            style={{ background: recurring ? BRAND_COLOR : "var(--muted)" }}>
            <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
              style={{ left: recurring ? "calc(100% - 1.375rem)" : "0.125rem" }} />
          </button>
        </div>
        {recurring ? (
          <div>
            <SecLabel>Повторять по</SecLabel>
            <div className="flex gap-2 flex-wrap mt-2">
              {ALL_DAYS.map(d => (
                <button key={d} onClick={() => toggleRepeatDay(d)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-colors"
                  style={repeatDays.includes(d) ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)", color: "#8C8C9A" }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <SecLabel>Дата</SecLabel>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" />
          </div>
        )}
      </Card>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
      <button onClick={handleSubmit} disabled={!canSubmit || loading}
        className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-35"
        style={{ background: BRAND_COLOR }}>
        {loading ? "Сохранение…" : recurring ? "Создать повтор. задание" : "Создать задание"}
      </button>
    </div>
  );
}

// ── Create task shell ─────────────────────────────────────────────────────────

function CreateTaskShell({ challengeId, onDone }: { challengeId: string; onDone: () => void }) {
  const [taskType, setTaskType] = useState<TaskType>("checklist");

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-8 space-y-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onDone} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          ← Назад
        </button>
        <p className="font-extrabold text-lg">Создать задание</p>
      </div>

      <div className="flex gap-2">
        {TASK_TYPES.map(t => (
          <button key={t.type} onClick={() => setTaskType(t.type)}
            className="flex-1 py-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-colors"
            style={taskType === t.type
              ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR }
              : { borderColor: "var(--border)", color: "#8C8C9A" }}>
            <t.Icon size={18} />
            <span className="text-xs font-bold">{t.label}</span>
          </button>
        ))}
      </div>

      {taskType === "running"   && <RunningForm   challengeId={challengeId} onDone={onDone} />}
      {taskType === "checklist" && <ChecklistForm challengeId={challengeId} onDone={onDone} />}
      {taskType === "freeform"  && <FreeformForm  challengeId={challengeId} onDone={onDone} />}
    </div>
  );
}

// ── Main ManageScreen ─────────────────────────────────────────────────────────

export function ManageScreen() {
  const { challenge, userRole } = useAppContext();
  const navigate = useNavigate();

  const [showCreateTask, setShowCreateTask] = useState(false);
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

  const ownerItems = userRole === "owner" ? [
    { icon: <Sliders size={20} />,   label: "Настройки челленджа",   sub: "Дни, штрафы, жизни, дедлайн",                                                     action: () => navigate("/app/settings") },
    { icon: <UserCheck size={20} />, label: "Управление участниками", sub: "Настроить жизни, зафиксировать штрафы",                                            action: () => navigate("/app/participants") },
    { icon: <Users size={20} />,     label: "Команда",               sub: `${challenge.team.length} участник${challenge.team.length !== 1 ? "ов" : ""} · пригласить помощников`, action: () => navigate("/app/team") },
  ] : [];

  const menuItems = [
    { icon: <CalendarDays size={20} />, label: "Создать задание",    sub: "Запланировать новое задание",    action: () => setShowCreateTask(true) },
    { icon: <Award size={20} />,        label: "Создать достижение", sub: "Добавить значок или веху",       action: () => setShowCreateAch(true) },
    ...ownerItems,
  ];

  if (showCreateTask) return (
    <CreateTaskShell challengeId={challenge.id} onDone={() => setShowCreateTask(false)} />
  );

  const COND_TYPES: { type: AchievementConditionType; label: string; hasThreshold: boolean; placeholder: string }[] = [
    { type: "tasks_total", label: "Заданий выполнено",  hasThreshold: true,  placeholder: "7"  },
    { type: "km_total",    label: "Км набегано",        hasThreshold: true,  placeholder: "25" },
    { type: "streak",      label: "Серия без пропусков",hasThreshold: true,  placeholder: "10" },
    { type: "first_week",  label: "Первая неделя (7 дней)", hasThreshold: false, placeholder: "" },
    { type: "days_half",   label: "Полпути пройдено",   hasThreshold: false, placeholder: "" },
    { type: "custom",      label: "Ручная отметка",     hasThreshold: false, placeholder: "" },
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
          {userRole === "owner" ? "Владелец" : "Помощник"}
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
