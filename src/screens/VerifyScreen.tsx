import { useState, useRef } from "react";
import { ChevronLeft, Phone, AlertCircle, RefreshCw } from "lucide-react";
import type { ConfirmationResult } from "firebase/auth";
import { BRAND_COLOR, bc } from "../constants/design";

interface VerifyScreenProps {
  phone: string;
  confirmationResult: ConfirmationResult;
  onVerify: () => void;
  onBack: () => void;
  onResend: () => Promise<void>;
}

function firebaseErrMsg(err: unknown): string {
  if (!(err instanceof Error)) return "Ошибка проверки. Попробуйте снова.";
  if (err.message.includes("invalid-verification-code")) return "Неверный код. Попробуйте снова.";
  if (err.message.includes("code-expired"))              return "Код истёк. Запросите новый.";
  if (err.message.includes("too-many-requests"))         return "Слишком много попыток. Подождите немного.";
  return "Ошибка проверки. Попробуйте снова.";
}

export function VerifyScreen({ phone, confirmationResult, onVerify, onBack, onResend }: VerifyScreenProps) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Fixed array of refs — no useRef in a loop (hook violation fix)
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const ref4 = useRef<HTMLInputElement>(null);
  const ref5 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1, ref2, ref3, ref4, ref5];

  const filled = digits.every(d => d !== "");
  const code   = digits.join("");

  const handleDigit = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    setError(null);
    if (val && i < 5) refs[i + 1].current?.focus();
    if (!val && i > 0) refs[i - 1].current?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs[i - 1].current?.focus();
    }
  };

  const verify = async () => {
    if (!filled || loading) return;
    setLoading(true);
    setError(null);
    try {
      await confirmationResult.confirm(code);
      // onAuthStateChanged in AuthContext will pick up the new user automatically
      onVerify();
    } catch (err) {
      setError(firebaseErrMsg(err));
      // Clear the digits so the user can re-enter
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => refs[0].current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resending) return;
    setResending(true);
    setError(null);
    try {
      await onResend();
      setDigits(["", "", "", "", "", ""]);
      setResent(true);
      setTimeout(() => setResent(false), 3000);
      refs[0].current?.focus();
    } catch (err) {
      setError(firebaseErrMsg(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex flex-col h-full px-6 pt-10 pb-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground mb-8">
        <ChevronLeft size={16} /> Назад
      </button>

      <div className="flex-1">
        <div className="mb-8">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
            <Phone size={24} className="text-muted-foreground" />
          </div>
          <h2 className="font-extrabold text-2xl mb-2">Введите код</h2>
          <p className="text-sm text-muted-foreground leading-snug">
            Мы отправили 6-значный код на{" "}
            <span className="font-bold text-foreground">{phone}</span>
          </p>
        </div>

        <div className="grid grid-cols-6 gap-2 mb-4 w-full">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              className="w-full h-14 text-center font-extrabold text-xl rounded-xl border-2 outline-none transition-colors min-w-0"
              style={{
                ...bc,
                borderColor: error ? "#E03B5A" : d ? BRAND_COLOR : "var(--border)",
                background: d ? "#FFF3F0" : "var(--card)",
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs font-bold text-red-500 mb-4 flex items-center gap-1.5">
            <AlertCircle size={12} /> {error}
          </p>
        )}

        <button
          onClick={verify}
          disabled={!filled || loading}
          className="w-full py-4 rounded-xl font-extrabold text-sm text-white disabled:opacity-35 mb-4"
          style={{ background: BRAND_COLOR }}
        >
          {loading ? "Проверка…" : "Подтвердить"}
        </button>

        <button
          onClick={resend}
          disabled={resending}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground py-2 disabled:opacity-50"
        >
          <RefreshCw size={13} className={resending ? "animate-spin" : ""} />
          {resent ? "Код отправлен!" : resending ? "Отправка…" : "Отправить код повторно"}
        </button>

        <p className="text-center text-[11px] text-muted-foreground leading-snug mt-6 px-4">
          Подтверждая, вы соглашаетесь с{" "}
          <span className="underline">правилами челленджа</span>{" "}
          и{" "}
          <span className="underline">условиями участия</span>{" "}
          установленными организатором.
        </p>
      </div>
    </div>
  );
}
