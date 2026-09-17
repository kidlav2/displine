import { forwardRef, useId } from "react";
import type React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

// 16px text below `sm` keeps iOS Safari from zooming into focused fields.
const CONTROL =
  "w-full rounded-lg border border-input bg-input-background text-base text-foreground sm:text-sm " +
  "placeholder:text-subtle-foreground transition-[border-color,box-shadow] duration-150 " +
  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger";

interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  /** Render-prop receives the generated id and the describedby id. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-muted-foreground">{label}</label>
      {children({ id, describedBy, invalid: !!error })}
      {error ? (
        <p id={hintId} className="text-[13px] text-danger-text">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-muted-foreground text-pretty">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, suffix, ...rest }, ref) {
  if (suffix) {
    return (
      <div className="relative">
        <input ref={ref} className={cn(CONTROL, "h-11 pl-3 pr-12 sm:h-10", className)} {...rest} />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {suffix}
        </span>
      </div>
    );
  }
  return <input ref={ref} className={cn(CONTROL, "h-11 px-3 sm:h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(CONTROL, "min-h-20 resize-none px-3 py-2.5 leading-normal", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cn(CONTROL, "h-11 appearance-none pl-3 pr-9 sm:h-10", className)} {...rest}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    );
  },
);
