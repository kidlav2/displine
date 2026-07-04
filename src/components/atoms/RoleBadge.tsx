import { Shield } from "lucide-react";
import type { UserRole } from "../../types";

interface RoleBadgeProps {
  role: UserRole;
  /** "pill" = bordered badge (profiles, cards); "text" = compact inline label (leaderboards, dense lists) */
  variant?: "pill" | "text";
  /** Override the default label for the role */
  label?: string;
}

const ROLE_CFG = {
  owner:  { label: "Владелец",    color: "text-purple-500", bg: "bg-purple-50 border-purple-200" },
  helper: { label: "Организатор", color: "text-blue-500",   bg: "bg-blue-50 border-blue-200"     },
} as const;

export function RoleBadge({ role, variant = "pill", label }: RoleBadgeProps) {
  if (role === "participant") return null;
  const cfg = ROLE_CFG[role];
  const text = label ?? cfg.label;

  if (variant === "text") {
    return <span className={`text-[9px] font-extrabold ${cfg.color}`}>{text}</span>;
  }

  return (
    <span className={`flex items-center gap-1 text-[10px] font-extrabold ${cfg.color} ${cfg.bg} border px-2 py-0.5 rounded-full shrink-0`}>
      <Shield size={9} />
      {text}
    </span>
  );
}
