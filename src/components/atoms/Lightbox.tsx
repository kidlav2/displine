import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface LightboxProps {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function Lightbox({ photos, initialIndex = 0, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(initialIndex);
  const touchStartX = useRef<number>(0);

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(photos.length - 1, i + 1)), [photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose]);

  if (photos.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
      >
        <X size={18} />
      </button>

      {/* Left arrow */}
      {idx > 0 && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          onClick={e => { e.stopPropagation(); prev(); }}
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Photo */}
      <img
        src={photos[idx]}
        alt={`Photo ${idx + 1}`}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
        onClick={e => e.stopPropagation()}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const delta = touchStartX.current - e.changedTouches[0].clientX;
          if (delta > 50) next();
          else if (delta < -50) prev();
        }}
      />

      {/* Right arrow */}
      {idx < photos.length - 1 && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          onClick={e => { e.stopPropagation(); next(); }}
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-6 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all ${
                i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
