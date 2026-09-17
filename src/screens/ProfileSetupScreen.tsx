import { useState } from "react";
import type React from "react";
import { Av, Button, Field, InlineAlert, Input } from "../components/atoms";
import { useAuthContext } from "../contexts/AuthContext";
import { writeUserProfile } from "../lib/firestore";
import { detectTz } from "../lib/timezone";
import type { TelegramProfile } from "../types";

interface ProfileSetupScreenProps {
  onDone: (data: { name: string; ini: string }) => Promise<void>;
  telegramData?: TelegramProfile;
  initialError?: string | null;
}

function toIni(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ProfileSetupScreen({ onDone, telegramData, initialError }: ProfileSetupScreenProps) {
  const { currentUser } = useAuthContext();
  const [name, setName] = useState(telegramData?.displayName ?? currentUser?.displayName ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const photoUrl = telegramData?.photoUrl ?? currentUser?.photoURL ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !currentUser || loading) return;
    setLoading(true);
    setError(null);
    try {
      const ini = toIni(trimmed);
      // Only include auth fields that are present — Firestore rejects undefined.
      // challengeRoles is intentionally omitted so existing roles are never overwritten.
      await writeUserProfile(currentUser.uid, {
        name: trimmed,
        ini,
        timezone: detectTz(),
        ...(currentUser.phoneNumber != null && { phone: currentUser.phoneNumber }),
        ...(currentUser.email != null && { email: currentUser.email }),
        ...(photoUrl != null && { photoUrl }),
        ...(telegramData?.telegramId != null && { telegramId: telegramData.telegramId }),
        ...(telegramData?.telegramUsername != null && { telegramUsername: telegramData.telegramUsername }),
      });
      // Awaited so a failed join surfaces here instead of as an unhandled rejection.
      await onDone({ name: trimmed, ini });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить профиль. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">Как вас зовут?</h1>
      <p className="mt-2 text-[15px] text-muted-foreground text-pretty">
        Имя увидят другие организаторы в команде челленджа.
      </p>

      <div className="mt-8 flex items-end gap-3">
        {photoUrl && <Av ini={toIni(name || "?")} photoUrl={photoUrl} sz="md" className="mb-0.5" />}
        <Field label="Имя и фамилия" className="flex-1">
          {({ id }) => (
            <Input
              id={id}
              value={name}
              onChange={e => { setName(e.target.value); setError(null); }}
              placeholder="Например, Ерлан Сапаров"
              autoComplete="name"
              autoFocus
            />
          )}
        </Field>
      </div>

      {error && <InlineAlert className="mt-4">{error}</InlineAlert>}

      <Button type="submit" variant="primary" size="lg" block className="mt-6" loading={loading} disabled={!name.trim()}>
        Продолжить
      </Button>
    </form>
  );
}
