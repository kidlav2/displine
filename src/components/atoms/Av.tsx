import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { BRAND_COLOR } from "../../constants/design";

interface AvProps {
  ini: string;
  photoUrl?: string | null;
  sz?: "xs" | "sm" | "md" | "lg";
  accent?: boolean;
  admin?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function Av({ ini, photoUrl, sz = "md", accent = false, admin = false, onClick }: AvProps) {
  const s = { xs: "w-6 h-6 text-[9px]", sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" }[sz];
  // Fall back to initials when the image fails to load (e.g. an expired Telegram
  // CDN URL that hasn't been re-cached yet) so we never render a broken image.
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [photoUrl]);
  const showImg = !!photoUrl && !failed;
  return (
    <div className="relative shrink-0 inline-flex" onClick={onClick} style={onClick ? { cursor: "pointer" } : {}}>
      <div
        className={`${s} rounded-full overflow-hidden flex items-center justify-center font-extrabold select-none ${!showImg && !accent ? "bg-muted text-muted-foreground" : ""}`}
        style={showImg ? {} : accent ? { background: BRAND_COLOR, color: "#fff" } : {}}
      >
        {showImg
          ? <img src={photoUrl!} alt={ini} className="w-full h-full object-cover" onError={() => setFailed(true)} />
          : ini}
      </div>
      {admin && (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center"
          style={{ width: 14, height: 14, background: BRAND_COLOR }}>
          <Shield size={8} className="text-white" strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}
