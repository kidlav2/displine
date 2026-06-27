import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { BRAND_COLOR } from "../constants/design";

interface ChallengePreview { name: string; emoji: string; description: string; inviteCode: string; }

interface TelegramLoginScreenProps {
  challenge?: ChallengePreview;
  onAuth: (payload: { id_token: string; nonce: string }) => Promise<void>;
  onInviteCode?: (code: string) => void;
}

// Minimal type for the new Telegram.Login SDK (telegram-login.js)
declare global {
  interface Window {
    Telegram?: {
      Login: {
        init(options: TelegramLoginOptions, callback: TelegramLoginCallback): void;
        open(callback?: TelegramLoginCallback): void;
        auth(options: TelegramLoginOptions, callback: TelegramLoginCallback): void;
        close(): void;
      };
    };
  }
}

interface TelegramLoginOptions {
  client_id: number;
  request_access?: ("phone" | "write")[];
  lang?: string;
  nonce?: string;
}

type TelegramLoginCallback = (result: {
  id_token?: string;
  user?: Record<string, unknown>;
  error?: string;
}) => void;

// Numeric Client ID from BotFather → Bot Settings → Web Login
const CLIENT_ID = parseInt(import.meta.env.VITE_TELEGRAM_CLIENT_ID ?? "0", 10);

export function TelegramLoginScreen({ challenge, onAuth, onInviteCode }: TelegramLoginScreenProps) {
  const nonceRef = useRef<string>("");
  const [scriptReady, setScriptReady] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [inviteInput, setInviteInput] = useState("");

  useEffect(() => {
    if (!CLIENT_ID) {
      setError("Telegram Client ID не настроен. Добавьте VITE_TELEGRAM_CLIENT_ID в переменные окружения.");
      return;
    }

    const existing = document.querySelector('script[src*="telegram-login.js"]');
    if (existing) { setScriptReady(true); return; }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-login.js";
    script.async = true;
    script.onload  = () => setScriptReady(true);
    script.onerror = () => setError("Не удалось загрузить библиотеку входа Telegram. Проверьте подключение.");
    document.head.appendChild(script);
  }, []);

  const handleLogin = () => {
    if (!scriptReady || loading || !window.Telegram?.Login) return;

    // Fresh nonce per attempt — stored in ref so the callback closure can read it
    const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    nonceRef.current = nonce;

    setError(null);

    window.Telegram.Login.auth(
      { client_id: CLIENT_ID, request_access: ["write"], nonce },
      async (result) => {
        if (result.error || !result.id_token) {
          setError(result.error ?? "Вход через Telegram отменён или не удался. Попробуйте снова.");
          return;
        }
        setLoading(true);
        try {
          await onAuth({ id_token: result.id_token, nonce: nonceRef.current });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ошибка входа. Попробуйте снова.");
          setLoading(false);
        }
        // On success the parent navigates away — don't reset loading
      }
    );
  };

  return (
    <div className="flex flex-col h-full px-6 pt-10 pb-8">
      <div className="flex-1 flex flex-col">

        {challenge ? (
          /* Challenge-specific header */
          <div className="flex flex-col items-center text-center mb-10">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
              style={{ background: "#FFF3F0" }}
            >
              {challenge.emoji}
            </div>
            <p className="text-xs font-extrabold tracking-widest uppercase text-muted-foreground mb-1">
              Вы вступаете в
            </p>
            <h1 className="font-extrabold text-2xl leading-tight mb-2">{challenge.name}</h1>
            <p className="text-sm text-muted-foreground leading-snug max-w-[260px]">
              {challenge.description}
            </p>
          </div>
        ) : (
          /* App-branded header (root / route) */
          <div className="flex flex-col items-center text-center mb-10">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
              style={{ background: "#FFF3F0" }}
            >
              🏁
            </div>
            <h1 className="font-extrabold text-2xl leading-tight mb-2">Добро пожаловать в Displine</h1>
            <p className="text-sm text-muted-foreground leading-snug max-w-[260px]">
              Войдите, чтобы управлять челленджами и отслеживать прогресс.
            </p>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div>
            <h2 className="font-extrabold text-xl text-center mb-1">
              {challenge ? "Войдите, чтобы вступить" : "Войти"}
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              Нажмите кнопку ниже, чтобы войти через аккаунт Telegram.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Loader2 size={16} className="animate-spin" style={{ color: BRAND_COLOR }} />
              Вход…
            </div>
          ) : (
            <button
              onClick={handleLogin}
              disabled={!scriptReady || !!error}
              className="flex items-center gap-3 px-6 py-3.5 rounded-2xl font-extrabold text-sm text-white disabled:opacity-40 transition-opacity"
              style={{ background: "#2AABEE" }}
            >
              {!scriptReady ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.032 9.571c-.148.658-.537.818-1.088.51l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.215-3.053 5.56-5.023c.242-.215-.054-.334-.373-.12L6.18 14.26l-2.95-.92c-.641-.2-.654-.641.137-.948l11.527-4.447c.535-.194 1.003.13.668.303z"/>
                </svg>
              )}
              Продолжить с Telegram
            </button>
          )}

          {error && (
            <p className="text-xs font-bold text-red-500 flex items-center gap-1.5 text-center max-w-xs">
              <AlertCircle size={12} className="shrink-0" />
              {error}
            </p>
          )}
        </div>

        {challenge && (
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground leading-snug">
              Вход по коду приглашения{" "}
              <span className="font-bold text-foreground">{challenge.inviteCode}</span>
            </p>
          </div>
        )}

        {!challenge && onInviteCode && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-semibold text-muted-foreground">или вступить как участник</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="flex gap-2">
              <input
                value={inviteInput}
                onChange={e => setInviteInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && inviteInput.trim() && onInviteCode(inviteInput.trim())}
                placeholder="Введите код приглашения"
                className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none placeholder-muted-foreground tracking-wider"
              />
              <button
                onClick={() => inviteInput.trim() && onInviteCode(inviteInput.trim())}
                disabled={!inviteInput.trim()}
                className="px-4 py-2.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-40"
                style={{ background: "#2AABEE" }}
              >
                Вступить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
