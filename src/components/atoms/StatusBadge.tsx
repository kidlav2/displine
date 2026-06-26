import { CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";
import type React from "react";

interface StatusBadgeProps { status: string; }

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    approved:    { label: "Approved",    icon: <CheckCircle2 size={11} />, cls: "bg-green-50 text-green-600 border-green-200"    },
    completed:   { label: "Done",        icon: <CheckCircle2 size={11} />, cls: "bg-green-50 text-green-600 border-green-200"    },
    in_progress: { label: "In progress", icon: <Clock size={11} />,        cls: "bg-amber-50 text-amber-500 border-amber-200"    },
    late:        { label: "Late",        icon: <AlertTriangle size={11} />,cls: "bg-orange-50 text-orange-500 border-orange-200" },
    missing:     { label: "Missing",     icon: <XCircle size={11} />,      cls: "bg-gray-100 text-gray-400 border-gray-200"      },
    pending:     { label: "Under review",icon: <Clock size={11} />,        cls: "bg-blue-50 text-blue-500 border-blue-200"       },
    rejected:    { label: "Rejected",    icon: <XCircle size={11} />,      cls: "bg-red-50 text-red-500 border-red-200"          },
  };
  const c = cfg[status] ?? cfg["missing"];
  return (
    <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border shrink-0 ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
}
