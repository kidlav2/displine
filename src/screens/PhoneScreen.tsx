import { useEffect, useRef, useState } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { signInWithPhoneNumber, RecaptchaVerifier, type ConfirmationResult } from "firebase/auth";
import { auth } from "../lib/firebase";
import { COUNTRIES, type Country } from "../constants/countries";
import { BRAND_COLOR } from "../constants/design";

interface ChallengePreview { name: string; emoji: string; description: string; inviteCode: string; }
interface PhoneScreenProps {
  challenge: ChallengePreview;
  onNext: (phone: string, result: ConfirmationResult) => void;
}

// Stable container ID — a string ID is passed to RecaptchaVerifier instead of
// a DOM ref so the reference never goes stale across re-renders.
const RECAPTCHA_ID = "phone-screen-recaptcha";

function getOrCreateVerifier(ref: React.MutableRefObject<RecaptchaVerifier | null>): RecaptchaVerifier {
  if (!ref.current) {
    ref.current = new RecaptchaVerifier(auth, RECAPTCHA_ID, { size: "invisible" });
  }
  return ref.current;
}

export function PhoneScreen({ challenge, onNext }: PhoneScreenProps) {
  const [country, setCountry]      = useState<Country>(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch]        = useState("");
  const [phone, setPhone]          = useState("");
  const [loading, setLoading]      = useState(false);
  const [error, setError]          = useState<string | null>(null);

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // Clear verifier on unmount so the widget is removed before the container
  // div leaves the DOM. This also handles React Strict Mode's double-mount:
  // the cleanup clears the first instance, then the second mount starts fresh.
  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search)
  );
  const canProceed = phone.replace(/\D/g, "").length >= 7;

  const handleSubmit = async () => {
    if (!canProceed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const verifier = getOrCreateVerifier(recaptchaRef);
      const fullPhone = `${country.dial}${phone.replace(/\D/g, "")}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, verifier);
      // Clear the verifier now — the component will unmount once onNext fires
      // and we don't want the cleanup effect to race with the navigation.
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      onNext(fullPhone, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код. Проверьте номер и попробуйте снова.");
      // Always clear on error — next attempt needs a fresh verifier instance
      // because reCAPTCHA doesn't allow re-rendering into a used container.
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full px-6 pt-10 pb-8">
      {/* Invisible reCAPTCHA anchor — must stay in the DOM for the lifetime of
          this screen. The ID is stable across re-renders. */}
      <div id={RECAPTCHA_ID} />

      <div className="flex flex-col items-center text-center mb-10">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: "#FFF3F0" }}>
          {challenge.emoji}
        </div>
        <p className="text-xs font-extrabold tracking-widest uppercase text-muted-foreground mb-1">Вы вступаете в</p>
        <h1 className="font-extrabold text-2xl leading-tight mb-2">{challenge.name}</h1>
        <p className="text-sm text-muted-foreground leading-snug max-w-[260px]">{challenge.description}</p>
      </div>

      <div className="flex-1">
        <p className="text-xs font-extrabold tracking-widest uppercase text-muted-foreground mb-3">
          Ваш номер телефона
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setShowPicker(v => !v)}
            className="flex items-center gap-1.5 px-3 py-3.5 bg-card border border-border rounded-xl text-sm font-bold min-w-[90px] shrink-0"
          >
            <span>{country.flag}</span>
            <span className="text-muted-foreground text-xs">{country.dial}</span>
            <ChevronDown size={13} className="text-muted-foreground" />
          </button>

          <input
            type="tel"
            placeholder="700 000 0000"
            value={phone}
            onChange={e => { setPhone(e.target.value); setError(null); }}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            className="flex-1 px-4 py-3.5 bg-card border border-border rounded-xl text-sm font-semibold outline-none placeholder-muted-foreground"
          />
        </div>

        {showPicker && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden mb-3 shadow-sm">
            <div className="p-2 border-b border-border">
              <input
                placeholder="Поиск страны…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted rounded-xl outline-none placeholder-muted-foreground"
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 200, scrollbarWidth: "none" }}>
              {filtered.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setCountry(c); setShowPicker(false); setSearch(""); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left text-sm"
                >
                  <span>{c.flag}</span>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-muted-foreground text-xs">{c.dial}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs font-bold text-red-500 mb-3 flex items-center gap-1.5">
            <AlertCircle size={12} /> {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canProceed || loading}
          className="w-full py-4 rounded-xl font-extrabold text-sm text-white disabled:opacity-35 mt-2"
          style={{ background: BRAND_COLOR }}
        >
          {loading ? "Отправка…" : "Получить код"}
        </button>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground leading-snug">
          Вход по ссылке приглашения{" "}
          <span className="font-bold text-foreground">displine.vercel.app/join?code={challenge.inviteCode}</span>
        </p>
      </div>
    </div>
  );
}
