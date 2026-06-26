import { Heart } from "lucide-react";

interface HeartsProps { n: number; total?: number; sz?: number; }

export function Hearts({ n, total = 5, sz = 16 }: HeartsProps) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <Heart key={i} size={sz} className={i < n ? "fill-red-500 text-red-500" : "fill-gray-100 text-gray-300"} />
      ))}
    </div>
  );
}
