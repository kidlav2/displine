import { useEffect, useId, useState, type FormEvent } from "react";
import { ClipboardPaste } from "lucide-react";
import { Button, Textarea } from "./atoms";
import { setDayGoal } from "../lib/firestore";
import { formatDateLong, formatDateShort } from "../lib/format";
import { notify } from "../lib/notify";
import { cn } from "../lib/cn";

/** One morning's goal for one person — the text they sent, saved by the organizer. */
export function DayGoalEditor({ challengeId, uid, iso, text }: {
  challengeId: string;
  uid: string;
  iso: string;
  text: string;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(text); }, [text, iso]);

  const dirty = draft.trim() !== text.trim();

  const paste = async () => {
    try {
      const clipped = (await navigator.clipboard.readText()).trim();
      if (!clipped) {
        notify.error("В буфере пусто.");
        return;
      }
      setDraft(prev => prev.trim() ? `${prev.trim()}\n${clipped}` : clipped);
    } catch (err) {
      console.error("[DayGoal] clipboard read failed:", err);
      notify.error("Не удалось вставить. Разрешите доступ к буферу или нажмите ⌘V.");
    }
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await setDayGoal(challengeId, uid, iso, draft);
      notify.success(draft.trim() ? "Цель записана" : "Цель убрана");
    } catch (err) {
      console.error("[DayGoal] setDayGoal failed:", err);
      notify.error("Не удалось сохранить цель.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={fieldId} className="text-[13px] font-medium text-muted-foreground">
          Цель на {formatDateLong(iso)}
        </label>
        <Button type="button" variant="secondary" size="sm" onClick={() => void paste()}>
          <ClipboardPaste />
          Вставить
        </Button>
      </div>
      <Textarea
        id={fieldId}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save(); }}
        placeholder="Вставьте сообщение: что хочет сделать сегодня"
        rows={4}
        className="max-h-60 overflow-y-auto"
      />
      <div className="mt-3 flex justify-end">
        <Button type="submit" variant="primary" size="sm" loading={saving} disabled={!dirty}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}

/** Every saved goal for one person, newest first. Choosing a day loads it above. */
export function GoalHistory({ goals, selected, onSelect }: {
  goals: Record<string, string> | undefined;
  selected: string;
  onSelect: (iso: string) => void;
}) {
  const rows = Object.entries(goals ?? {}).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (rows.length === 0) return null;
  return (
    <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
      {rows.map(([iso, text]) => (
        <li key={iso}>
          <button
            type="button"
            onClick={() => onSelect(iso)}
            className={cn(
              "pressable flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-hover",
              iso === selected && "bg-hover",
            )}
          >
            <span className="text-[13px] font-medium text-muted-foreground">{formatDateShort(iso)}</span>
            <span className="line-clamp-2 text-sm text-pretty">{text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
