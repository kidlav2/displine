import type React from "react";
import { BRAND_COLOR } from "../../constants/design";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, className = "", accent = false, style }: CardProps) {
  return (
    <div
      className={`bg-card rounded-2xl border ${className}`}
      style={{ borderColor: accent ? BRAND_COLOR : "var(--border)", ...style }}
    >
      {children}
    </div>
  );
}
