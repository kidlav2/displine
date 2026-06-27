import { useState, useRef } from "react";
import { Activity, CheckSquare, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { Card, SecLabel } from "./atoms";
import { BRAND_COLOR, ALL_DAYS, DAY_LABELS, bc } from "../constants/design";
import { useAuthContext } from "../contexts/AuthContext";
import { createTask, createTaskTemplate } from "../lib/firestore";
import { todayISO } from "../lib/dates";
import type { Task, TaskTemplate } from "../types";

type TaskType = "running" | "checklist" | "freeform";

const TASK_TYPES: { type: TaskType; Icon: React.ElementType; label: string }[] = [
  { type: "running",   Icon: Activity,    label: "Пробежка"     },
  { type: "checklist", Icon: CheckSquare, label: "Чеклист"      },
  { type: "freeform",  Icon: LayoutGrid,  label: "Произвольное" },
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
                {DAY_LABELS[d]}
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
                  {DAY_LABELS[d]}
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
                  {DAY_LABELS[d]}
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

// ── Shell (type picker + form router) ─────────────────────────────────────────

export function CreateTaskShell({ challengeId, onDone }: { challengeId: string; onDone: () => void }) {
  const [taskType, setTaskType] = useState<TaskType>("running");

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
