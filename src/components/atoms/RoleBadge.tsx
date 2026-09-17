import type { UserRole } from "../../types";
import { ROLE_LABELS } from "../../constants/design";
import { Badge } from "./Badge";

interface RoleBadgeProps {
  role: UserRole;
  /** "pill" = badge; "text" = compact inline label for dense lists */
  variant?: "pill" | "text";
  label?: string;
}

export function RoleBadge({ role, variant = "pill", label }: RoleBadgeProps) {
  if (role === "participant") return null;
  const text = label ?? ROLE_LABELS[role];
  if (variant === "text") {
    return <span className="text-xs font-medium text-muted-foreground">{text}</span>;
  }
  return <Badge>{text}</Badge>;
}
