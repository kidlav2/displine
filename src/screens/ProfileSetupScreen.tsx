import { useState, useRef } from "react";
import { Camera, AlertCircle } from "lucide-react";
import { BRAND_COLOR } from "../constants/design";
import { useAuthContext } from "../contexts/AuthContext";
import { writeUserProfile } from "../lib/firestore";
import { detectTz } from "../lib/timezone";
import type { TelegramProfile } from "../types";

interface ProfileSetupScreenProps {
  onDone: (data: { name: string; ini: string }) => void;
  telegramData?: TelegramProfile;
}

function toIni(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ProfileSetupScreen({ onDone, telegramData }: ProfileSetupScreenProps) {
  const { currentUser } = useAuthContext();
  // Pre-populate name from Telegram if available; user can still edit it
  const [name, setName]       = useState(telegramData?.displayName ?? "");
  // Pre-populate photo thumbnail from Telegram
  const [thumb, setThumb]     = useState<string | null>(telegramData?.photoUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setThumb(URL.createObjectURL(f));
  };

  const handleDone = async () => {
    if (!name.trim() || !currentUser || loading) return;
    setLoading(true);
    setError(null);
    try {
      // FLAG: photo upload to Firebase Storage is not yet wired up.
      // The photo is previewed locally but photoUrl is left undefined.
      // Add Storage upload here when ready (similar to submitProof in firestore.ts).
      const trimmed = name.trim();
      const ini = toIni(trimmed);
      // Only include auth fields that are actually present — Firestore rejects
      // undefined values, and omitting is cleaner than storing null for a field
      // that doesn't apply to this auth method (phone vs email vs Google).
      await writeUserProfile(currentUser.uid, {
        name:     trimmed,
        ini,
        timezone: detectTz(),
        challengeRoles: {},
        ...(currentUser.phoneNumber != null && { phone: currentUser.phoneNumber }),
        ...(currentUser.email       != null && { email: currentUser.email }),
        // Prefer Telegram photo over OAuth photo; fall back to currentUser.photoURL
        ...(telegramData?.photoUrl != null
          ? { photoUrl: telegramData.photoUrl }
          : currentUser.photoURL != null
            ? { photoUrl: currentUser.photoURL }
            : {}),
        ...(telegramData?.telegramId       != null && { telegramId:       telegramData.telegramId }),
        ...(telegramData?.telegramUsername != null && { telegramUsername: telegramData.telegramUsername }),
      });
      onDone({ name: trimmed, ini });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить профиль. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full px-6 pt-10 pb-8">
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      <div className="flex-1">
        <h2 className="font-extrabold text-2xl mb-1">Почти готово!</h2>
        <p className="text-sm text-muted-foreground mb-8">Настройте профиль участника. Другие участники увидят его.</p>

        <div className="flex flex-col items-center mb-8">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative w-24 h-24 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden mb-3"
          >
            {thumb
              ? <img src={thumb} alt="avatar" className="w-full h-full object-cover" />
              : <Camera size={28} className="text-muted-foreground" />
            }
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/10 transition-colors rounded-full" />
          </button>
          <p className="text-xs font-semibold text-muted-foreground">
            {thumb ? "Нажмите, чтобы изменить фото" : "Добавить фото профиля"}
          </p>
        </div>

        <div className="mb-6">
          <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground mb-2">
            Ваше имя
          </p>
          <input
            placeholder="e.g. Ерлан С."
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            onKeyDown={e => e.key === "Enter" && handleDone()}
            className="w-full px-4 py-3.5 bg-card border border-border rounded-xl text-base font-semibold outline-none placeholder-muted-foreground"
          />
        </div>

        {error && (
          <p className="text-xs font-bold text-red-500 mb-4 flex items-center gap-1.5">
            <AlertCircle size={12} /> {error}
          </p>
        )}

        <button
          onClick={handleDone}
          disabled={!name.trim() || loading}
          className="w-full py-4 rounded-xl font-extrabold text-sm text-white disabled:opacity-35"
          style={{ background: BRAND_COLOR }}
        >
          {loading ? "Сохранение…" : "Вступить в челлендж"}
        </button>
      </div>
    </div>
  );
}
