import { useNavigate } from "react-router";
import { BRAND_COLOR } from "../../constants/design";
import { useAppContext } from "../../contexts/AppContext";
import type { UserRole } from "../../types";

export function DemoControls() {
  const { userRole, setUserRole, isRunDay, setIsRunDay, setSelectedId } = useAppContext();
  const navigate = useNavigate();

  return (
    <div className="space-y-2 text-xs font-bold">
      <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground">Demo</p>
      <div className="flex flex-wrap gap-1">
        {([
          ["/app/home",   "App"],
          ["/join",       "Join (participant)"],
          ["/org-login",  "Org login"],
          ["/error/invite-invalid",  "Bad link"],
          ["/error/challenge-ended", "Ended"],
          ["/error/no-invite",       "No link"],
        ] as [string, string][]).map(([path, label]) => (
          <button key={path}
            onClick={() => navigate(path)}
            className="px-2 py-1 rounded-lg border transition-colors text-[10px] font-bold"
            style={{ borderColor: "var(--border)", color: "#8C8C9A" }}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setIsRunDay(v => !v)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold"
          style={isRunDay ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)", color: "#8C8C9A" }}>
          🏃 Run {isRunDay ? "ON" : "OFF"}
        </button>
        {(["participant", "helper", "owner"] as UserRole[]).map(r => (
          <button key={r}
            onClick={() => {
              setUserRole(r);
              setSelectedId(null);
              navigate(r === "owner" ? "/challenges" : "/app/home");
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold capitalize"
            style={userRole === r
              ? { background: r === "owner" ? "#7C3AED" : r === "helper" ? "#2563EB" : BRAND_COLOR, color: "#fff", borderColor: "transparent" }
              : { borderColor: "var(--border)", color: "#8C8C9A" }}>
            {r === "owner" ? "👑 Owner" : r === "helper" ? "🛡 Helper" : "👤 Participant"}
          </button>
        ))}
      </div>
    </div>
  );
}
