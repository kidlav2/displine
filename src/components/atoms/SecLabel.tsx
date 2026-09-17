import type React from "react";

export function SecLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] font-medium text-muted-foreground">{children}</p>;
}
