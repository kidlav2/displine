import { useState } from "react";
import type React from "react";
import { useNavigate } from "react-router";
import { CircleCheck } from "lucide-react";
import { Button, EmptyState, Field, InlineAlert, Input, Page, PageHeader, Section, Segmented, Textarea } from "../components/atoms";
import { LivesStepper, RunScheduleSection } from "../components/ChallengeFields";
import { CURRENCIES } from "../constants/design";
import { DEFAULT_SCORING } from "../constants/scoring";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { createChallenge } from "../lib/firestore";
import { addDaysISO, durationFromDates } from "../lib/dates";
import { formatDateLong, localISODate, plural } from "../lib/format";
import { cn } from "../lib/cn";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const EMOJIS = ["🔥", "🏃", "💪", "⚡", "🎯", "🧘", "📚", "❄️", "🍂", "🌟"];

export function CreateChallengeScreen() {
  const { currentUser, userProfile } = useAuthContext();
  const { setSelectedId } = useAppContext();
  const navigate = useNavigate();
  useDocumentTitle("Новый челлендж");

  const tomorrow = addDaysISO(localISODate(), 1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [desc, setDesc] = useState("");
  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState(addDaysISO(tomorrow, 49));
  const [runSchedule, setRunSchedule] = useState<Record<string, string>>({ Tue: "06:00", Thu: "06:00", Sat: "06:00", Sun: "07:00" });
  const [penaltyAmount, setPenaltyAmount] = useState("20000");
  const [currency, setCurrency] = useState<string>("KZT");
  const [burpees, setBurpees] = useState("20");
  const [startingLives, setStartingLives] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duration = durationFromDates(startDate, endDate);
  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol ?? currency;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Введите название челленджа."); return; }
    if (!currentUser || !userProfile || loading) return;
    setLoading(true);
    setError(null);
    try {
      const inviteCode = `${name.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const id = await createChallenge(
        currentUser.uid,
        { name: userProfile.name, ini: userProfile.ini, timezone: userProfile.timezone, telegramUsername: userProfile.telegramUsername },
        {
          name: name.trim(), emoji, description: desc.trim(),
          startDate, endDate, duration: duration || 50, currentDay: 0,
          status: "upcoming", inviteCode,
          settings: {
            runSchedule,
            penaltyAmount: parseInt(penaltyAmount, 10) || 0,
            currency: currencySymbol,
            burpees: parseInt(burpees, 10) || 0,
            startingLives,
            scoring: [...DEFAULT_SCORING],
            taskDeadline: "10:00",
          },
          issuedTaskDays: {},
        },
      );
      setCreatedId(id);
    } catch {
      setError("Не удалось создать челлендж. Проверьте подключение и попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  if (createdId) {
    return (
      <Page width="sm">
        <EmptyState
          className="min-h-[60vh] justify-center"
          icon={<CircleCheck className="text-success-text" />}
          title={`«${name.trim()}» создан`}
          description="Осталось добавить участников по имени — после этого можно отмечать их каждый день."
          action={
            <>
              <Button variant="primary" onClick={() => { setSelectedId(createdId); navigate("/app/settings#participants"); }}>
                Добавить участников
              </Button>
              <Button variant="ghost" onClick={() => navigate("/challenges")}>К списку</Button>
            </>
          }
        />
      </Page>
    );
  }

  return (
    <Page width="sm">
      <PageHeader back={{ label: "Челленджи", onClick: () => navigate("/challenges") }} title="Новый челлендж" />

      <form onSubmit={submit} className="space-y-8" noValidate>
        <Section title="Основное" grouped={false}>
          <div className="space-y-5 rounded-xl border border-border bg-card p-4">
            <Field label="Название" error={error && !name.trim() ? error : null}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  value={name}
                  onChange={e => { setName(e.target.value); setError(null); }}
                  placeholder="Например, Осенняя дисциплина"
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  autoComplete="off"
                  autoFocus
                />
              )}
            </Field>
            <Field label="Описание" hint="Необязательно. Увидят помощники в приглашении.">
              {({ id, describedBy }) => (
                <Textarea id={id} value={desc} onChange={e => setDesc(e.target.value)} rows={2} aria-describedby={describedBy} />
              )}
            </Field>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-muted-foreground">Иконка</legend>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                  <label key={e} className="relative">
                    <input type="radio" name="emoji" value={e} checked={emoji === e} onChange={() => setEmoji(e)} className="peer sr-only" />
                    <span
                      className={cn(
                        "flex size-11 cursor-pointer items-center justify-center rounded-lg border bg-card text-xl transition-colors duration-150",
                        "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                        emoji === e ? "border-brand bg-brand-subtle" : "border-border hover:bg-hover",
                      )}
                    >
                      {e}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Section>

        <Section title="Даты" grouped={false}>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Старт">
                {({ id }) => (
                  <Input
                    id={id}
                    type="date"
                    value={startDate}
                    onChange={e => {
                      const v = e.target.value;
                      setStartDate(v);
                      if (v && endDate && v > endDate) setEndDate(addDaysISO(v, 49));
                    }}
                  />
                )}
              </Field>
              <Field label="Финиш">
                {({ id }) => <Input id={id} type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />}
              </Field>
            </div>
            {duration > 0 && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                {duration} {plural(duration, ["день", "дня", "дней"])}: с {formatDateLong(startDate)} по {formatDateLong(endDate)}
              </p>
            )}
          </div>
        </Section>

        <RunScheduleSection value={runSchedule} onChange={setRunSchedule} />

        <Section title="Штрафы и жизни" grouped={false}>
          <div className="space-y-5 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="mb-2 text-[13px] font-medium text-muted-foreground">Валюта</p>
              <Segmented
                aria-label="Валюта"
                block
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES.map(c => ({ value: c.code, label: c.symbol, title: c.label }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Сумма за отсутствие" hint="Списывается с отметки «не был». Опоздание без штрафа — сумму можно поменять потом в настройках.">
                {({ id, describedBy }) => (
                  <Input id={id} type="number" inputMode="numeric" min={0} value={penaltyAmount} onChange={e => setPenaltyAmount(e.target.value)} suffix={currencySymbol} aria-describedby={describedBy} />
                )}
              </Field>
              <Field label="Или бёрпи">
                {({ id }) => (
                  <Input id={id} type="number" inputMode="numeric" min={0} value={burpees} onChange={e => setBurpees(e.target.value)} suffix="раз" />
                )}
              </Field>
            </div>
            <LivesStepper value={startingLives} onChange={setStartingLives} />
          </div>
        </Section>

        {error && name.trim() && <InlineAlert>{error}</InlineAlert>}

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="submit" variant="primary" size="lg" block loading={loading}>
            Создать челлендж
          </Button>
        </div>
      </form>
    </Page>
  );
}
