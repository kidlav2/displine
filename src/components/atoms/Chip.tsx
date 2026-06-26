import { BRAND_COLOR } from "../../constants/design";

interface ChipProps { label: string; active: boolean; onClick: () => void; }

export function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors"
      style={
        active
          ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR }
          : { background: "#fff", color: "#8C8C9A", borderColor: "var(--border)" }
      }
    >
      {label}
    </button>
  );
}
