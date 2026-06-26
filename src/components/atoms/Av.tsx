import { Shield } from "lucide-react";
import { BRAND_COLOR } from "../../constants/design";

interface AvProps {
  ini: string;
  sz?: "xs" | "sm" | "md" | "lg";
  accent?: boolean;
  admin?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function Av({ ini, sz = "md", accent = false, admin = false, onClick }: AvProps) {
  const s = { xs: "w-6 h-6 text-[9px]", sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" }[sz];
  return (
    <div className="relative shrink-0 inline-flex" onClick={onClick} style={onClick ? { cursor: "pointer" } : {}}>
      <div
        className={`${s} rounded-full flex items-center justify-center font-extrabold select-none`}
        style={{ background: accent ? BRAND_COLOR : "#EEEEF2", color: accent ? "#fff" : "#666" }}
      >
        {ini}
      </div>
      {admin && (
        <span className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full flex items-center justify-center" style={{ width: 14, height: 14 }}>
          <Shield size={8} className="text-white" strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}
