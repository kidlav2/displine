import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { BRAND_COLOR } from "../constants/design";
import type { TelegramAuthData } from "../types";

interface ChallengePreview { name: string; emoji: string; description: string; inviteCode: string; }

interface TelegramLoginScreenProps {
  challenge: ChallengePreview;
  onAuth: (data: TelegramAuthData) => Promise<void>;
}

// The Telegram widget injects itself into the DOM and calls a global callback.
// We stash the callback on window so the injected script can reach it.
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthData) => void;
  }
}

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;

export function TelegramLoginScreen({ challenge, onAuth }: TelegramLoginScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState<string | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);

  useEffect(() => {
    if (!BOT_USERNAME) {
      setError("Bot username is not configured. Add VITE_TELEGRAM_BOT_USERNAME to your .env file.");
      return;
    }

    // Register the global callback before the widget script loads
    window.onTelegramAuth = async (data: TelegramAuthData) => {
      setLoading(true);
      setError(null);
      try {
        await onAuth(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed. Please try again.");
        setLoading(false);
      }
      // Don't setLoading(false) on success — the parent navigates away
    };

    // Inject the Telegram widget script
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.onload = () => setWidgetReady(true);
    script.onerror = () => setError("Could not load Telegram widget. Check your connection.");

    containerRef.current?.appendChild(script);

    return () => {
      window.onTelegramAuth = undefined;
      // Remove the injected script on unmount so re-mounting creates a fresh instance
      script.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full px-6 pt-10 pb-8">
      <div className="flex-1 flex flex-col">

        {/* Challenge preview */}
        <div className="flex flex-col items-center text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
            style={{ background: "#FFF3F0" }}
          >
            {challenge.emoji}
          </div>
          <p className="text-xs font-extrabold tracking-widest uppercase text-muted-foreground mb-1">
            You're joining
          </p>
          <h1 className="font-extrabold text-2xl leading-tight mb-2">{challenge.name}</h1>
          <p className="text-sm text-muted-foreground leading-snug max-w-[260px]">
            {challenge.description}
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div>
            <h2 className="font-extrabold text-xl text-center mb-1">Sign in to join</h2>
            <p className="text-sm text-muted-foreground text-center">
              Tap the button below to sign in with your Telegram account.
            </p>
          </div>

          {/* Telegram widget mounts here */}
          <div ref={containerRef} className="flex items-center justify-center min-h-[54px]">
            {!widgetReady && !error && (
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Loader2 size={16} className="animate-spin" style={{ color: BRAND_COLOR }} />
              Signing you in…
            </div>
          )}

          {error && (
            <p className="text-xs font-bold text-red-500 flex items-center gap-1.5 text-center max-w-xs">
              <AlertCircle size={12} className="shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground leading-snug">
            Joining via invite link{" "}
            <span className="font-bold text-foreground">join.app/{challenge.inviteCode}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
