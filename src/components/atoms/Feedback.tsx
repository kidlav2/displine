import type React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

export function Spinner({ className, label = "Загрузка" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex text-subtle-foreground", className)}>
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {icon && <div className="mb-4 text-subtle-foreground [&_svg]:size-6" aria-hidden>{icon}</div>}
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: "success" | "brand" | "neutral";
  className?: string;
  label?: string;
}

export function ProgressBar({ value, max = 100, tone = "success", className, label }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          tone === "success" ? "bg-success" : tone === "brand" ? "bg-brand" : "bg-subtle-foreground",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function InlineAlert({ children, tone = "danger", className }: { children: React.ReactNode; tone?: "danger" | "warning"; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-lg px-3 py-2.5 text-[13px] text-pretty",
        tone === "danger" ? "bg-danger-subtle text-danger-text" : "bg-warning-subtle text-warning-text",
        className,
      )}
    >
      {children}
    </p>
  );
}
