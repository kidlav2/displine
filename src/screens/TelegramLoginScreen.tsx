import { useEffect, useState } from "react";
import { Button, InlineAlert } from "../components/atoms";
import { TELEGRAM_COLOR } from "../constants/design";

// Google "G" mark (inline to avoid an extra dependency)
export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

interface ChallengePreview { name: string; emoji: string; description: string; inviteCode: string; }

function TelegramIcon() {
  return (
    <span className="flex size-5 items-center justify-center rounded-full" style={{ background: TELEGRAM_COLOR }} aria-hidden>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
        <path d="M21.9 3.3c.3-1.2-.8-1.9-1.8-1.5L2.6 8.6c-1.2.5-1.2 1.2-.2 1.5l4.5 1.4 1.7 5.3c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3.2-14.3zM8.6 12.8l9.3-5.9c.4-.3.8-.1.5.2l-7.9 7.1-.3 3.3-1.6-4.7z" />
      </svg>
    </span>
  );
}

interface TelegramLoginScreenProps {
  challenge?: ChallengePreview;
  onAuth: (payload: { id_token: string; nonce: string }) => Promise<void>;
  onGoogleAuth?: () => Promise<void>;
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

// On mobile, tapping "Continue with Telegram" often hands off to the native
// Telegram app, which returns the user via its own in-app browser/WebView —
// a different browsing context than the tab that started the login. That
// context doesn't share sessionStorage (tab-scoped) or in-memory refs
// (destroyed if the OS reclaims the original tab), so the nonce is kept in
// localStorage instead, which is shared across contexts on the same origin.
const NONCE_STORAGE_KEY = "displine_tg_login_nonce";
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const NONCE_EXPIRED_MESSAGE =
  "Срок входа истёк или возникла ошибка браузера. Пожалуйста, попробуйте войти снова.";

function storeNonce(value: string) {
  try {
    localStorage.setItem(NONCE_STORAGE_KEY, JSON.stringify({ value, expiresAt: Date.now() + NONCE_TTL_MS }));
  } catch {
    // localStorage unavailable (e.g. private browsing) — auth will surface
    // NONCE_EXPIRED_MESSAGE below once consumeNonce() comes up empty.
  }
}

// Single-use: always removes the stored nonce, valid or not, so it can never be replayed.
function consumeNonce(): string | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(NONCE_STORAGE_KEY);
    localStorage.removeItem(NONCE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { value?: string; expiresAt?: number };
    if (!parsed.value || !parsed.expiresAt || Date.now() > parsed.expiresAt) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export function TelegramLoginScreen({ challenge, onAuth, onGoogleAuth }: TelegramLoginScreenProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Fallback for the mobile hand-off case: if the OS reclaims/reloads the
  // original tab while the user is in the Telegram app, oauth.telegram.org
  // completes the flow by redirecting the (possibly fresh) page back with
  // `#tgAuthResult=<base64 json>` in the URL — there's no live JS callback
  // to receive it, so pick it up here on mount instead.
  useEffect(() => {
    const match = window.location.hash.match(/tgAuthResult=([^&]+)/);
    if (!match) return;

    // Strip it immediately so a refresh doesn't reprocess a stale result.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    try {
      const decoded = JSON.parse(atob(decodeURIComponent(match[1]))) as { id_token?: string };
      if (!decoded.id_token) return;

      const storedNonce = consumeNonce();
      if (!storedNonce) {
        setError(NONCE_EXPIRED_MESSAGE);
        return;
      }

      setLoading(true);
      onAuth({ id_token: decoded.id_token, nonce: storedNonce }).catch(err => {
        setError(err instanceof Error ? err.message : "Ошибка входа. Попробуйте снова.");
        setLoading(false);
      });
    } catch {
      // Malformed payload — ignore; the user can just retry manually.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Fresh nonce per attempt, persisted to localStorage (survives the
    // Telegram-app hand-off, unlike sessionStorage or an in-memory ref).
    const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    storeNonce(nonce);

    setError(null);

    window.Telegram.Login.auth(
      { client_id: CLIENT_ID, request_access: ["write"], nonce },
      async (result) => {
        if (result.error || !result.id_token) {
          setError(result.error ?? "Вход через Telegram отменён или не удался. Попробуйте снова.");
          return;
        }
        const storedNonce = consumeNonce();
        if (!storedNonce) {
          setError(NONCE_EXPIRED_MESSAGE);
          return;
        }
        setLoading(true);
        try {
          await onAuth({ id_token: result.id_token, nonce: storedNonce });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ошибка входа. Попробуйте снова.");
          setLoading(false);
        }
        // On success the parent navigates away — don't reset loading
      }
    );
  };

  const busy = loading || googleLoading;

  const handleGoogle = async () => {
    if (!onGoogleAuth) return;
    setGoogleLoading(true);
    setError(null);
    try {
      await onGoogleAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа через Google.");
      setGoogleLoading(false);
    }
  };

  return (
    <div>
      {challenge && (
        <div className="mb-8">
          <p className="text-[13px] font-medium text-muted-foreground">Приглашение в команду</p>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-card p-3 sm:bg-muted sm:border-transparent">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl sm:bg-card" aria-hidden>
              {challenge.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{challenge.name}</p>
              {challenge.description && <p className="line-clamp-2 text-[13px] text-muted-foreground">{challenge.description}</p>}
            </div>
          </div>
        </div>
      )}

      <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">
        {challenge ? "Войдите, чтобы присоединиться" : "Вход в Displine"}
      </h1>
      <p className="mt-2 text-[15px] text-muted-foreground text-pretty">
        {challenge
          ? "После входа вы станете частью команды и сможете отмечать участников."
          : "Трекер дисциплины для организаторов и помощников челленджей."}
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          block
          onClick={handleLogin}
          disabled={!scriptReady || busy}
          loading={loading}
        >
          {!loading && <TelegramIcon />}
          Продолжить с Telegram
        </Button>
        {onGoogleAuth && (
          <Button variant="secondary" size="lg" block onClick={handleGoogle} disabled={busy} loading={googleLoading}>
            {!googleLoading && <GoogleIcon />}
            Продолжить с Google
          </Button>
        )}
      </div>

      {error && <InlineAlert className="mt-4">{error}</InlineAlert>}

      <p className="mt-6 text-[13px] text-muted-foreground text-pretty">
        Для Telegram откроется окно подтверждения — разрешите вход и вернитесь на эту страницу. Писать боту не нужно.
      </p>
    </div>
  );
}
