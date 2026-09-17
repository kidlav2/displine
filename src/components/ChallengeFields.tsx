import { Minus, Plus } from "lucide-react";
import { Hearts, IconButton, Input, Row, Section, Switch } from "./atoms";
import { ALL_DAYS, DAY_LABELS_FULL } from "../constants/design";

/** Weekly run days with a deadline time for each enabled day. */
export function RunScheduleSection({ value, onChange, description }: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  description?: string;
}) {
  const toggle = (day: string, on: boolean) => {
    const next = { ...value };
    if (on) next[day] = next[day] ?? "06:00";
    else delete next[day];
    onChange(next);
  };

  return (
    <Section id="schedule" title="Пробежки" description={description ?? "Дни по расписанию и время, до которого нужно пробежать."}>
      {ALL_DAYS.map(day => {
        const on = day in value;
        const switchId = `run-${day}`;
        return (
          <Row key={day} className="min-h-[60px] py-2.5">
            <label htmlFor={switchId} className="flex-1 cursor-pointer text-[15px] sm:text-sm">{DAY_LABELS_FULL[day]}</label>
            {on && (
              <Input
                type="time"
                aria-label={`${DAY_LABELS_FULL[day]}: пробежка до`}
                value={value[day]}
                onChange={e => onChange({ ...value, [day]: e.target.value })}
                className="h-9 w-[8.5rem] sm:h-9"
              />
            )}
            <Switch id={switchId} checked={on} onCheckedChange={v => toggle(day, v)} />
          </Row>
        );
      })}
    </Section>
  );
}

export function LivesStepper({ value, onChange, min = 1, max = 5 }: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-muted-foreground" id="lives-label">Жизни на старте</p>
      <div className="mt-2 flex items-center gap-3" role="group" aria-labelledby="lives-label">
        <IconButton label="Меньше жизней" variant="secondary" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
          <Minus />
        </IconButton>
        <span className="w-6 text-center text-lg font-semibold tabular" aria-live="polite">{value}</span>
        <IconButton label="Больше жизней" variant="secondary" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
          <Plus />
        </IconButton>
        <Hearts n={value} total={max} sz={18} className="ml-1" />
      </div>
    </div>
  );
}
