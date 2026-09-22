import * as Dialog from "@radix-ui/react-dialog";
import { Check } from "lucide-react";
import { Button } from "../atoms";
import { cn } from "../../lib/cn";
import { formatMoney } from "../../lib/format";
import type { LateTier } from "../../lib/attendance";

interface LateRunDialogProps {
  open: boolean;
  name: string;
  burpees: number;
  amount: number;
  currency: string;
  /** Tier already saved for this run, so it can be switched. */
  current: LateTier | null;
  onOpenChange: (open: boolean) => void;
  onPick: (tier: LateTier) => void;
  onClear?: () => void;
}

/** Two choices, not a minute field: up to 20 minutes is burpees, past that is money plus burpees. */
export function LateRunDialog({
  open, name, burpees, amount, currency, current, onOpenChange, onPick, onClear,
}: LateRunDialogProps) {
  const shortDetail = burpees > 0
    ? `${burpees} бёрпи · без денег`
    : "Бёрпи в настройках не заданы — только отметка";
  const longParts = [
    amount > 0 ? formatMoney(amount, currency) : null,
    burpees > 0 ? `${burpees} бёрпи` : null,
  ].filter(Boolean);
  const longDetail = longParts.length > 0 ? longParts.join(" · ") : "Штраф в настройках не задан";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] p-0 sm:items-center sm:p-4">
          <Dialog.Content className="dialog w-full max-w-[400px] rounded-t-2xl bg-popover p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-popover-foreground shadow-raised outline-none sm:rounded-2xl sm:pb-5">
            <Dialog.Title className="text-[17px] font-semibold leading-snug">На сколько опоздал?</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground text-pretty">
              {name}. До 20 минут включительно — только бёрпи. Больше 20 минут — денежный штраф и бёрпи. Жизнь не снимается.
            </Dialog.Description>
            <div className="mt-5 flex flex-col gap-2">
              <Choice
                title="До 20 минут"
                detail={shortDetail}
                selected={current === "short"}
                onClick={() => onPick("short")}
              />
              <Choice
                title="Больше 20 минут"
                detail={longDetail}
                selected={current === "long"}
                onClick={() => onPick("long")}
              />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {onClear && (
                <Button variant="ghost" onClick={onClear}>Снять отметку</Button>
              )}
              <Dialog.Close asChild>
                <Button variant="secondary">Отмена</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Choice({ title, detail, selected, onClick }: {
  title: string;
  detail: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left",
        selected ? "border-brand bg-brand-subtle" : "border-border-strong hover:bg-hover",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">{detail}</span>
      </span>
      {selected && <Check className="size-4 shrink-0 text-brand" aria-hidden />}
    </button>
  );
}
