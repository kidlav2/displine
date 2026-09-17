import type React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

interface PageHeaderProps {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { label?: string; onClick: () => void };
  className?: string;
}

export function PageHeader({ title, eyebrow, description, actions, back, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 lg:mb-8", className)}>
      {back && (
        <button
          type="button"
          onClick={back.onClick}
          className="pressable -ml-2 mb-3 inline-flex h-8 items-center gap-1 rounded-lg pl-1 pr-2.5 text-sm font-medium text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <ChevronLeft className="size-[18px]" aria-hidden />
          {back.label ?? "Назад"}
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-[13px] font-medium text-muted-foreground">{eyebrow}</div>}
          <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] lg:text-[28px]">{title}</h1>
          {description && <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground text-pretty">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * Content column used by every in-app screen. Screens differ in width, but on
 * desktop they all start at the same left edge so the header never jumps.
 */
export function Page({ children, width = "md", className }: { children: React.ReactNode; width?: "sm" | "md" | "lg" | "full"; className?: string }) {
  const max = { sm: "max-w-[640px]", md: "max-w-[760px]", lg: "max-w-[1080px]", full: "" }[width];
  return (
    <div className="w-full px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pt-10">
      <div className={cn("mx-auto w-full lg:mx-0", max, className)}>{children}</div>
    </div>
  );
}

interface SectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Wrap children in a bordered group with row dividers. */
  grouped?: boolean;
}

export function Section({ title, description, action, children, className, id, grouped = true }: SectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-6", className)} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-4 px-0.5">
          <div className="min-w-0">
            {title && <h2 id={id ? `${id}-title` : undefined} className="text-[15px] font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground text-pretty">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {grouped
        ? <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{children}</div>
        : children}
    </section>
  );
}

interface RowProps {
  children: React.ReactNode;
  className?: string;
}

export function Row({ children, className }: RowProps) {
  return <div className={cn("flex min-h-14 items-center gap-3 px-4 py-3", className)}>{children}</div>;
}

interface LinkRowProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
}

export function LinkRow({ icon, title, description, trailing, onClick, tone = "default" }: LinkRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-hover",
        "focus-visible:-outline-offset-2",
      )}
    >
      {icon && (
        <span className={cn("shrink-0 [&_svg]:size-5", tone === "danger" ? "text-danger-text" : "text-muted-foreground")} aria-hidden>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] font-medium sm:text-sm", tone === "danger" && "text-danger-text")}>{title}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted-foreground">{description}</span>}
      </span>
      {trailing}
      {tone !== "danger" && <ChevronRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden />}
    </button>
  );
}
