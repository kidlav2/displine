import type React from "react";
import { cn } from "../../lib/cn";

export type BadgeTone = "neutral" | "brand" | "success" | "danger" | "warning" | "postpone";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-brand-subtle text-brand-text",
  success: "bg-success-subtle text-success-text",
  danger: "bg-danger-subtle text-danger-text",
  warning: "bg-warning-subtle text-warning-text",
  postpone: "bg-postpone-subtle text-postpone-text",
};

interface BadgeProps {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ tone = "neutral", icon, children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium [&_svg]:size-3",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
