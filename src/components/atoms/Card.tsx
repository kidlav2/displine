import type React from "react";
import { cn } from "../../lib/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, className, accent = false, style }: CardProps) {
  return (
    <div
      className={cn("rounded-xl border bg-card", accent ? "border-brand" : "border-border", className)}
      style={style}
    >
      {children}
    </div>
  );
}
