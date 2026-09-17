import { useLocation, useNavigate } from "react-router";
import { ChevronRight, Flag, Plus } from "lucide-react";
import { Badge, Button, EmptyState, Page, PageHeader, ProgressBar, Section } from "../components/atoms";
import { ROLE_LABELS } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { addDaysISO, challengeCurrentDay, durationFromDates } from "../lib/dates";
import { formatDateLong, formatDateShort, localISODate, plural } from "../lib/format";
import { cn } from "../lib/cn";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { ChallengeData, ChallengeStatus } from "../types";

const GROUPS: { status: ChallengeStatus; title: string }[] = [
  { status: "active", title: "Идут сейчас" },
  { status: "upcoming", title: "Скоро старт" },
  { status: "completed", title: "Завершены" },
];

function ChallengeCard({ ch, role, current, onSelect }: {
  ch: ChallengeData;
  role?: string;
  current: boolean;
  onSelect: () => void;
}) {
  const day = challengeCurrentDay(ch.startDate, ch.duration);
  const end = ch.endDate || (ch.startDate ? addDaysISO(ch.startDate, ch.duration - 1) : "");
  const daysToStart = ch.startDate ? durationFromDates(localISODate(), ch.startDate) - 1 : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-full w-full flex-col rounded-xl border bg-card p-4 text-left transition-colors duration-150 hover:bg-hover",
        current ? "border-border-strong" : "border-border",
      )}
    >
      <span className="flex w-full items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl" aria-hidden>{ch.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{ch.name}</span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground tabular">
            {ch.startDate ? `${formatDateShort(ch.startDate)} — ${formatDateShort(end)}` : "Даты не заданы"} · {ch.duration} {plural(ch.duration, ["день", "дня", "дней"])}
          </span>
        </span>
        <ChevronRight className="mt-2 size-4 shrink-0 text-subtle-foreground" aria-hidden />
      </span>

      <span className="mt-4 flex w-full flex-wrap items-center gap-2">
        {role && <Badge>{role}</Badge>}
        {current && <Badge>Открыт сейчас</Badge>}
      </span>

      {ch.status === "active" && (
        <span className="mt-4 block w-full">
          <span className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">День {day} из {ch.duration}</span>
            <span className="font-medium tabular">{Math.round((day / Math.max(1, ch.duration)) * 100)}%</span>
          </span>
          <ProgressBar value={day} max={ch.duration} tone="brand" className="mt-1.5" label="Прогресс челленджа" />
        </span>
      )}
      {ch.status === "upcoming" && ch.startDate && (
        <span className="mt-4 block text-[13px] text-muted-foreground">
          {daysToStart > 0
            ? `Старт через ${daysToStart} ${plural(daysToStart, ["день", "дня", "дней"])} — ${formatDateLong(ch.startDate)}`
            : `Старт ${formatDateLong(ch.startDate)}`}
        </span>
      )}
      {ch.status === "completed" && end && (
        <span className="mt-4 block text-[13px] text-muted-foreground">Закончился {formatDateLong(end)}</span>
      )}
    </button>
  );
}

export function ChallengesListScreen() {
  const { challenges, selectedId, setSelectedId } = useAppContext();
  const { userProfile } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  useDocumentTitle("Челленджи");

  const open = (id: string) => {
    setSelectedId(id);
    navigate("/app/day");
  };

  const roleOf = (id: string) => {
    const r = userProfile?.challengeRoles?.[id];
    return r ? ROLE_LABELS[r] : undefined;
  };

  return (
    <Page width="lg">
      <PageHeader
        back={location.key !== "default" ? { onClick: () => navigate(-1) } : undefined}
        title="Челленджи"
        description={challenges.length ? "Выберите, какой челлендж открыть, или создайте новый." : undefined}
        actions={
          challenges.length > 0 && (
            <Button variant="primary" onClick={() => navigate("/challenges/create")}>
              <Plus /> Новый челлендж
            </Button>
          )
        }
      />

      {challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong">
          <EmptyState
            icon={<Flag />}
            title="Челленджей пока нет"
            description="Создайте челлендж: даты, расписание пробежек и штрафы. Участников добавите по имени."
            action={<Button variant="primary" onClick={() => navigate("/challenges/create")}><Plus /> Создать челлендж</Button>}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {GROUPS.map(({ status, title }) => {
            const group = challenges.filter(c => c.status === status);
            if (!group.length) return null;
            return (
              <Section key={status} title={title} grouped={false}>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {group.map(ch => (
                    <li key={ch.id} className={cn(status === "completed" && "opacity-75")}>
                      <ChallengeCard ch={ch} role={roleOf(ch.id)} current={ch.id === selectedId} onSelect={() => open(ch.id)} />
                    </li>
                  ))}
                </ul>
              </Section>
            );
          })}
        </div>
      )}
    </Page>
  );
}
