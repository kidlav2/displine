import type { ReactNode } from "react";
import { Check, Clock, MoveRight, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { expectedRun, expectedTask, postponementAway } from "../../lib/attendance";
import type { AttendanceStatus, IssuedTaskDay, Participant, PostponementRequest } from "../../types";

// ── Day status (grid cells, profile history) ─────────────────────────────────

export type DayKind = "done" | "partial" | "late" | "missed" | "postponed" | "pending" | "future" | "none";

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  done: "всё выполнено",
  partial: "выполнено частично",
  late: "опоздание",
  missed: "пропуск",
  postponed: "перенос",
  pending: "не отмечено",
  future: "впереди",
  none: "нет заданий",
};

export function dayKind(
  p: Participant,
  iso: string,
  todayISO: string,
  runSchedule: Record<string, string>,
  issuedTaskDays: Record<string, IssuedTaskDay> | undefined,
  postponements: PostponementRequest[],
): DayKind {
  const runAway = !!postponementAway(postponements, p.uid, iso, "running");
  const taskAway = !!postponementAway(postponements, p.uid, iso, "task");
  const needRun = expectedRun(iso, p.uid, runSchedule, postponements);
  const needTask = expectedTask(iso, p.uid, issuedTaskDays, postponements);
  if (runAway) return "postponed";
  if (!needRun && !needTask) return taskAway ? "postponed" : "none";

  const statuses = [needRun && p.days?.[iso]?.run, needTask && p.days?.[iso]?.task].filter(s => s !== false) as AttendanceStatus[];
  if (statuses.includes("missed")) return "missed";
  const complete = statuses.filter(s => s === "done" || s === "late").length;
  if (complete === statuses.length) {
    if (statuses.includes("late")) return "late";
    return "done";
  }
  if (complete > 0) return "partial";
  return iso > todayISO ? "future" : "pending";
}

const CELL: Record<DayKind, string> = {
  done: "bg-success text-white",
  partial: "bg-success-muted",
  late: "bg-warning text-white",
  missed: "bg-danger text-white",
  postponed: "bg-postpone text-white",
  pending: "shadow-[inset_0_0_0_1.5px_var(--control-border)]",
  future: "shadow-[inset_0_0_0_1px_var(--border)]",
  none: "",
};

/** The colored square used by the grid and the participant history. Icons back up color for missed/postponed. */
export function DayCellVisual({ kind, size = 26, icons = "status", className }: {
  kind: DayKind;
  size?: number;
  icons?: "status" | "all";
  className?: string;
}) {
  const iconSize = Math.round(size * 0.5);
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-md", CELL[kind], className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {kind === "missed" && <X size={iconSize} strokeWidth={3} />}
      {kind === "late" && <Clock size={iconSize} strokeWidth={2.75} />}
      {kind === "postponed" && <MoveRight size={iconSize} strokeWidth={2.75} />}
      {kind === "done" && icons === "all" && <Check size={iconSize} strokeWidth={3} />}
      {kind === "none" && <span className="size-[3px] rounded-full bg-border-strong" />}
    </span>
  );
}

export function DayLegend({ className }: { className?: string }) {
  const items: DayKind[] = ["done", "late", "partial", "missed", "postponed", "pending", "none"];
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground", className)}>
      {items.map(k => (
        <li key={k} className="inline-flex items-center gap-2">
          <DayCellVisual kind={k} size={16} className="rounded-[4px]" />
          {DAY_KIND_LABEL[k]}
        </li>
      ))}
    </ul>
  );
}

// ── Mark group (Day screen) ──────────────────────────────────────────────────

const RUN_MARKS: { status: AttendanceStatus; label: string; Icon: typeof Check }[] = [
  { status: "done", label: "пришёл", Icon: Check },
  { status: "late", label: "опоздал", Icon: Clock },
  { status: "missed", label: "не был", Icon: X },
];

const TASK_MARKS: { status: AttendanceStatus; label: string; Icon: typeof Check }[] = [
  { status: "done", label: "выполнил", Icon: Check },
  { status: "late", label: "опоздал", Icon: Clock },
  { status: "missed", label: "не сдал", Icon: X },
];

const MARK_ON: Record<AttendanceStatus, string> = {
  done: "border-success bg-success text-white",
  late: "border-warning bg-warning text-white",
  missed: "border-danger bg-danger text-white",
};

interface MarkGroupProps {
  status?: AttendanceStatus;
  onChange: (next?: AttendanceStatus) => void;
  /** e.g. "Айдар, пробежка" */
  label: string;
  kind?: "run" | "task";
  /** Stretch across the parent — used when marks sit on their own row. */
  fill?: boolean;
}

export function MarkGroup({ status, onChange, label, kind = "run", fill = false }: MarkGroupProps) {
  const marks = kind === "task" ? TASK_MARKS : RUN_MARKS;
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex rounded-[10px] border border-border bg-card p-0.5",
        fill && "flex w-full sm:inline-flex sm:w-auto",
      )}
    >
      {marks.map(({ status: value, label: state, Icon }) => {
        const on = status === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            aria-label={`${label}: ${state}`}
            title={state}
            onClick={() => onChange(on ? undefined : value)}
            className={cn(
              "pressable relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border-[1.5px]",
              fill ? "flex-1 sm:size-8 sm:min-h-8 sm:min-w-8 sm:flex-none" : "size-11 sm:size-8 sm:min-h-8 sm:min-w-8",
              on ? MARK_ON[value] : "border-transparent text-muted-foreground hover:bg-hover hover:text-foreground",
            )}
          >
            <Icon size={18} strokeWidth={2.6} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** Caption + mark control. Caption is for the stacked phone row, where header columns are hidden. */
export function MarkField({ caption, showCaption, children }: {
  caption: string;
  showCaption: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      {showCaption && (
        <p className="mb-1 text-center text-[12px] font-medium text-muted-foreground sm:hidden">{caption}</p>
      )}
      {children}
    </div>
  );
}

/** Placeholder for a column that doesn't apply to this person today. */
export function MarkPlaceholder({ postponedTo, fill = false }: { postponedTo?: string; fill?: boolean }) {
  if (postponedTo !== undefined) {
    const label = postponedTo ? `Перенесено на ${postponedTo}` : "Перенос";
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-[10px] bg-postpone-subtle text-postpone-text",
          fill ? "min-h-11 w-full sm:h-8 sm:w-[7.25rem]" : "h-11 w-[7.25rem] sm:h-8",
        )}
        title={label}
      >
        <MoveRight size={18} strokeWidth={2.5} aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-subtle-foreground",
        fill ? "min-h-11 w-full sm:h-8 sm:w-[7.25rem]" : "h-11 w-[7.25rem] sm:h-8",
      )}
    >
      <span aria-hidden>—</span>
      <span className="sr-only">Не требуется</span>
    </span>
  );
}
