import { useState } from "react";
import type React from "react";
import { useNavigate } from "react-router";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, type AuthError } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Button, Field, InlineAlert, Input } from "../components/atoms";
import { useAppContext } from "../contexts/AppContext";
import { GoogleIcon } from "./TelegramLoginScreen";

function authErrMsg(err: AuthError): string {
  switch (err.code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Неверный email или пароль.";
    case "auth/too-many-requests":  return "Слишком много попыток. Попробуйте позже.";
    case "auth/popup-closed-by-user": return "Окно входа закрыто. Попробуйте снова.";
    default: return "Не удалось войти. Попробуйте снова.";
  }
}

export function OrgLoginScreen() {
  const { setSelectedId } = useAppContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = () => {
    setSelectedId(null);
    navigate("/challenges");
  };

  const emailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || loading) return;
    setLoading("email");
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      handleSuccess();
    } catch (err) {
      setError(authErrMsg(err as AuthError));
    } finally {
      setLoading(null);
    }
  };

  const googleLogin = async () => {
    if (loading) return;
    setLoading("google");
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      handleSuccess();
    } catch (err) {
      setError(authErrMsg(err as AuthError));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">Вход для организатора</h1>
      <p className="mt-2 text-[15px] text-muted-foreground text-pretty">
        Участникам вход не нужен — их отмечают по имени.
      </p>

      <Button variant="secondary" size="lg" block className="mt-8" onClick={googleLogin} loading={loading === "google"} disabled={!!loading}>
        {loading !== "google" && <GoogleIcon />}
        Войти через Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-[13px] text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        или по почте
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={emailLogin} className="flex flex-col gap-4">
        <Field label="Email">
          {({ id }) => (
            <Input
              id={id}
              type="email"
              name="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
            />
          )}
        </Field>
        <Field label="Пароль">
          {({ id }) => (
            <Input
              id={id}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
            />
          )}
        </Field>

        {error && <InlineAlert>{error}</InlineAlert>}

        <Button type="submit" variant="primary" size="lg" block loading={loading === "email"} disabled={!!loading && loading !== "email"}>
          Войти
        </Button>
      </form>

      <p className="mt-6 text-[13px] text-muted-foreground text-pretty">
        Нет аккаунта? Доступ выдаёт владелец челленджа — попросите у него приглашение в команду.
      </p>
    </div>
  );
}
