import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Check, LayoutList, LogOut, Plus, Trash2, Users } from "lucide-react";
import { signOut } from "firebase/auth";
import {
  Av, Badge, Button, ConfirmDialog, Field, IconButton, Input, LinkRow, Lives, Page, PageHeader, Row,
  Section, Segmented,
} from "../components/atoms";
import { LivesStepper, RunScheduleSection } from "../components/ChallengeFields";
import { CURRENCIES, ROLE_LABELS } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { auth } from "../lib/firebase";
import { StravaRow } from "../components/StravaRow";
import { addParticipantByName, removeParticipantFromChallenge, saveOrgNote, updateChallengeDoc } from "../lib/firestore";
import { addDaysISO, durationFromDates } from "../lib/dates";
import { rosterParticipants, unpaidPenalties } from "../lib/attendance";
import { formatDateLong, plural } from "../lib/format";
import { notify } from "../lib/notify";
import { useThemePreference, type ThemePreference } from "../lib/theme";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { ChallengeSettings, Participant } from "../types";

interface FormState {
  settings: ChallengeSettings;
  startDate: string;
  duration: number;
}

export function OperatorSettingsScreen() {
  const { challenge, orgNotes, isOwner, userRole, meParticipant } = useAppContext();
  const { currentUser, userProfile } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  useDocumentTitle("Настройки");

  const fromChallenge = (): FormState => ({
    settings: { ...challenge.settings, taskDeadline: challenge.settings.taskDeadline ?? "10:00" },
    startDate: challenge.startDate,
    duration: challenge.startDate && challenge.endDate
      ? durationFromDates(challenge.startDate, challenge.endDate) || challenge.duration
      : challenge.duration,
  });

  const [baseline, setBaseline] = useState<FormState>(fromChallenge);
  const [form, setForm] = useState<FormState>(baseline);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  // Deep link from empty states: /app/settings#participants
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  const s = form.settings;
  const setSettings = (patch: Partial<ChallengeSettings>) => setForm(f => ({ ...f, settings: { ...f.settings, ...patch } }));
  const endDate = form.startDate ? addDaysISO(form.startDate, Math.max(1, form.duration) - 1) : "";
  const currentCode = CURRENCIES.find(c => c.symbol === s.currency)?.code ?? "KZT";

  const save = async () => {
    setSaving(true);
    try {
      const duration = Math.max(1, form.duration);
      await updateChallengeDoc(challenge.id, {
        settings: form.settings,
        startDate: form.startDate,
        endDate,
        duration,
      });
      setBaseline(form);
      notify.success("Настройки сохранены");
    } catch (err) {
      console.error("[Settings] save failed:", err);
      notify.error("Не удалось сохранить настройки. Проверьте права и подключение.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page width="lg">
      <PageHeader title="Настройки" description={`${challenge.emoji} ${challenge.name}`} />

      <div className="space-y-8">
        <Section id="challenge" title="Челлендж" grouped={false} className="max-w-[560px]">
          <div className="space-y-5 rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Старт">
                {({ id }) => (
                  <Input id={id} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                )}
              </Field>
              <Field label="Длительность">
                {({ id }) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={form.duration}
                    onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value, 10) || 0 }))}
                    suffix={plural(form.duration, ["день", "дня", "дней"])}
                    className="pr-16"
                  />
                )}
              </Field>
            </div>
            {endDate && <p className="-mt-2 text-[13px] text-muted-foreground">Финиш — {formatDateLong(endDate)}</p>}

            <Field label="Задания сдают до" hint="Действует для заданий, выданных после изменения.">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="time"
                  aria-describedby={describedBy}
                  value={s.taskDeadline}
                  onChange={e => setSettings({ taskDeadline: e.target.value })}
                  className="w-36"
                />
              )}
            </Field>

            <LivesStepper value={s.startingLives} onChange={n => setSettings({ startingLives: n })} />
          </div>
        </Section>

        <RunScheduleSection value={s.runSchedule} onChange={runSchedule => setSettings({ runSchedule })} />

        <Section id="penalties" title="Штрафы" grouped={false} className="max-w-[560px]">
          <div className="space-y-5 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="mb-2 text-[13px] font-medium text-muted-foreground">Валюта</p>
              <Segmented
                aria-label="Валюта"
                block
                value={currentCode}
                onChange={code => setSettings({ currency: CURRENCIES.find(c => c.code === code)?.symbol ?? s.currency })}
                options={CURRENCIES.map(c => ({ value: c.code, label: c.symbol, title: c.label }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Сумма за отсутствие" hint="За «не был» и за опоздание больше 20 минут.">
                {({ id, describedBy }) => (
                  <Input
                    id={id} type="number" inputMode="numeric" min={0}
                    aria-describedby={describedBy}
                    value={s.penaltyAmount}
                    onChange={e => setSettings({ penaltyAmount: parseInt(e.target.value, 10) || 0 })}
                    suffix={s.currency}
                  />
                )}
              </Field>
              <Field label="Или бёрпи" hint="За «не был» и за опоздание. Больше 20 минут — вместе с деньгами.">
                {({ id, describedBy }) => (
                  <Input
                    id={id} type="number" inputMode="numeric" min={0}
                    aria-describedby={describedBy}
                    value={s.burpees}
                    onChange={e => setSettings({ burpees: parseInt(e.target.value, 10) || 0 })}
                    suffix="раз"
                  />
                )}
              </Field>
            </div>
          </div>
        </Section>

        {dirty && (
          <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 rounded-xl border border-border bg-popover p-3 pl-4 shadow-raised lg:bottom-6">
            <p className="min-w-0 flex-1 text-sm font-medium"><span className="sm:hidden">Не сохранено</span><span className="hidden sm:inline">Есть несохранённые изменения</span></p>
            <Button variant="ghost" size="sm" onClick={() => setForm(baseline)} disabled={saving}>Отменить</Button>
            <Button variant="primary" size="sm" onClick={save} loading={saving}>Сохранить</Button>
          </div>
        )}

        <ParticipantsSection
          challengeId={challenge.id}
          roster={rosterParticipants(challenge.participants)}
          startingLives={s.startingLives}
          orgNotes={orgNotes}
        />

        <Section title="Команда и челленджи">
          {isOwner && (
            <LinkRow icon={<Users />} title="Команда" description="Пригласить помощника или совладельца" onClick={() => navigate("/app/team")} />
          )}
          <LinkRow icon={<LayoutList />} title="Все челленджи" description="Переключиться или создать новый" onClick={() => navigate("/challenges")} />
        </Section>

        <AppearanceSection />

        <Section title="Аккаунт">
          <Link to="/app/profile" className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-hover">
            <Av ini={meParticipant?.ini ?? userProfile?.ini ?? "?"} photoUrl={meParticipant?.photoUrl ?? userProfile?.photoUrl} sz="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium sm:text-sm">{userProfile?.name ?? meParticipant?.name}</span>
              <span className="block truncate text-[13px] text-muted-foreground">
                {ROLE_LABELS[userRole]}{currentUser?.email ? ` · ${currentUser.email}` : ""}
              </span>
            </span>
            <span className="text-[13px] text-muted-foreground">Профиль</span>
          </Link>
          <StravaRow />
          <LinkRow
            icon={<LogOut />}
            title="Выйти"
            tone="danger"
            onClick={async () => { await signOut(auth); navigate("/", { replace: true }); }}
          />
        </Section>
      </div>
    </Page>
  );
}

function ParticipantsSection({ challengeId, roster, startingLives, orgNotes }: {
  challengeId: string;
  roster: Participant[];
  startingLives: number;
  orgNotes: Record<string, string>;
}) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<Participant | null>(null);
  const [removing, setRemoving] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await addParticipantByName(challengeId, trimmed, startingLives);
      setName("");
    } catch (err) {
      console.error("[Settings] addParticipantByName failed:", err);
      notify.error("Не удалось добавить участника. Проверьте права.");
    } finally {
      setAdding(false);
    }
  };

  const remove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await removeParticipantFromChallenge(challengeId, toRemove.uid, false);
      notify.success(`${toRemove.name} удалён из челленджа`);
      setToRemove(null);
    } catch (err) {
      console.error("[Settings] remove failed:", err);
      notify.error("Не удалось удалить участника.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Section
      id="participants"
      title={<>Участники <span className="font-normal text-subtle-foreground tabular">{roster.length}</span></>}
      description="Участники не входят в приложение — их отмечают по имени. Договорённость видна на экране «День»."
    >
      <form onSubmit={add} className="flex gap-2 p-3">
        <Input
          aria-label="Имя нового участника"
          placeholder="Имя и фамилия"
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" loading={adding} className="h-11 sm:h-10">
          {!adding && <Plus />}
          Добавить
        </Button>
      </form>

      {roster.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Добавьте первого участника.</p>
      )}

      {roster.map(p => (
        <ParticipantRow key={p.uid} p={p} challengeId={challengeId} note={orgNotes[p.uid] ?? ""} onRemove={() => setToRemove(p)} />
      ))}

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={open => { if (!open && !removing) setToRemove(null); }}
        title={`Удалить ${toRemove?.name ?? "участника"}?`}
        description="Отметки, жизни и штрафы участника исчезнут из таблицы и рейтинга. Отменить это нельзя."
        confirmLabel="Удалить"
        loading={removing}
        onConfirm={remove}
      />
    </Section>
  );
}

function ParticipantRow({ p, challengeId, note, onRemove }: {
  p: Participant;
  challengeId: string;
  note: string;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(note);
  const [saved, setSaved] = useState(false);
  const unpaid = unpaidPenalties(p).length;

  useEffect(() => { setDraft(note); }, [note]);

  const commit = async () => {
    const value = draft.trim();
    if (value === note.trim()) return;
    try {
      await saveOrgNote(challengeId, p.uid, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      console.error("[Settings] saveOrgNote failed:", err);
      notify.error("Не удалось сохранить договорённость.");
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Link to={`/participants/${p.uid}`} className="min-w-0 flex-1 rounded-md hover:underline">
          <span className="block truncate text-[15px] font-medium sm:text-sm">{p.name}</span>
        </Link>
        <Lives n={p.lives} />
        {unpaid > 0 && <Badge tone="warning">Штраф</Badge>}
        <IconButton label={`Удалить ${p.name}`} size="sm" onClick={onRemove} className="-mr-1.5 hover:text-danger-text">
          <Trash2 />
        </IconButton>
      </div>
      <div className="relative mt-2">
        <Input
          aria-label={`Договорённость: ${p.name}`}
          placeholder="Договорённость"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="h-10 pr-24 text-[15px] sm:h-9 sm:text-[13px]"
        />
        {saved && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1 text-[13px] text-success-text" role="status">
            <Check className="size-3.5" aria-hidden /> Сохранено
          </span>
        )}
      </div>
    </div>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useThemePreference();
  return (
    <Section title="Оформление">
      <Row>
        <span className="flex-1 text-[15px] sm:text-sm">Тема</span>
        <Segmented<ThemePreference>
          aria-label="Тема оформления"
          size="sm"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "system", label: "Как в системе" },
            { value: "light", label: "Светлая" },
            { value: "dark", label: "Тёмная" },
          ]}
        />
      </Row>
    </Section>
  );
}
