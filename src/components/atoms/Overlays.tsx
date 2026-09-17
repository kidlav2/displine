import type React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Bottom sheet on phones, centered dialog from 640px up. */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] sm:items-center sm:p-6">
          <Dialog.Content
            className={cn(
              "sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-popover text-popover-foreground shadow-raised outline-none",
              "sm:max-h-[min(720px,90dvh)] sm:max-w-[440px] sm:rounded-2xl",
              className,
            )}
          >
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong sm:hidden" aria-hidden />
            <div className="flex shrink-0 items-start gap-3 px-5 pb-2 pt-3 sm:pt-5">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-[17px] font-semibold leading-snug">{title}</Dialog.Title>
                {description
                  ? <Dialog.Description className="mt-0.5 text-[13px] text-muted-foreground">{description}</Dialog.Description>
                  : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
              </div>
              <Dialog.Close className="pressable -mr-2 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground">
                <X className="size-5" aria-hidden />
                <span className="sr-only">Закрыть</span>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2 sm:pb-5">
              {children}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, cancelLabel = "Отмена", tone = "danger", loading, onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="overlay fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4">
          <AlertDialog.Content className="dialog w-full max-w-[400px] rounded-2xl bg-popover p-5 text-popover-foreground shadow-raised outline-none">
            <AlertDialog.Title className="text-[17px] font-semibold leading-snug">{title}</AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="mt-2 text-sm text-muted-foreground text-pretty">{description}</AlertDialog.Description>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary" disabled={loading}>{cancelLabel}</Button>
              </AlertDialog.Cancel>
              <Button
                variant={tone === "danger" ? "danger" : "primary"}
                loading={loading}
                onClick={async (e) => {
                  e.preventDefault();
                  await onConfirm();
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
