import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { CircleCheck, Clock, Link2Off, UserX } from "lucide-react";
import { auth, functions } from "../lib/firebase";
import {
  resolveInviteCode, submitJoinRequest, subscribeToMyJoinRequest, subscribeToMyLink,
  TeamInviteError, type InviteData,
} from "../lib/firestore";
import { useAuthContext } from "../contexts/AuthContext";
import { AuthLayout, AuthMessage } from "../components/AuthLayout";
import { Button, Field, InlineAlert, Input, Spinner } from "../components/atoms";
import { TelegramLoginScreen } from "./TelegramLoginScreen";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { JoinRequest } from "../types";

const verifyTelegramLoginFn = httpsCallable<
  { id_token: string; nonce: string },
  { customToken: string; displayName: string }
>(functions, "verifyTelegramLogin");

/**
 * The common link a organizer drops into the group chat: /r/<inviteCode>.
 * Sign in with Telegram → name and the WhatsApp number → wait for the organizer
 * to link the request to a roster name → "Мой день".
 */
export function SelfJoinScreen() {
  const { code = "" } = useParams();
  const { currentUser, authLoading } = useAuthContext();
  useDocumentTitle("Регистрация");

  const [invite, setInvite] = useState<InviteData | null | undefined>(undefined);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    resolveInviteCode(code)
      .then(inv => { if (alive) setInvite(inv); })
      .catch(err => {
        if (!alive) return;
        setInvite(null);
        setInviteError(err instanceof TeamInviteError ? "Эта ссылка уже использована." : null);
      });
    return () => { alive = false; };
  }, [code]);

  if (authLoading || invite === undefined) return <Centered />;

  if (!invite) {
    return (
      <AuthLayout>
        <AuthMessage
          icon={<Link2Off />}
          title="Ссылка не работает"
          description={inviteError ?? "Возможно, в ней опечатка или челлендж удалён. Попросите организатора прислать ссылку ещё раз."}
        />
      </AuthLayout>
    );
  }

  // Team links go through the organizer flow.
  if (invite.type === "team") return <Navigate to={`/join?code=${encodeURIComponent(code)}`} replace />;

  const preview = { name: invite.name, emoji: invite.emoji, description: invite.description, inviteCode: code };

  if (!currentUser) {
    return (
      <AuthLayout>
        <TelegramLoginScreen
          challenge={preview}
          copy={{
            eyebrow: "Регистрация участника",
            title: "Войдите через Telegram",
            description: "Потом укажете имя и номер телефона. Когда организатор подтвердит заявку, вы сможете сами отмечать пробежку и задание.",
          }}
          onAuth={async payload => {
            const res = await verifyTelegramLoginFn(payload);
            await signInWithCustomToken(auth, res.data.customToken);
          }}
        />
      </AuthLayout>
    );
  }

  return <JoinStatus code={code} challengeId={invite.challengeId} challengeName={`${invite.emoji} ${invite.name}`} />;
}

function JoinStatus({ code, challengeId, challengeName }: { code: string; challengeId: string; challengeName: string }) {
  const { currentUser } = useAuthContext();
  const uid = currentUser!.uid;
  const [linkedTo, setLinkedTo] = useState<string | null | undefined>(undefined);
  const [request, setRequest] = useState<JoinRequest | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => subscribeToMyLink(challengeId, uid, setLinkedTo), [challengeId, uid]);
  useEffect(() => subscribeToMyJoinRequest(challengeId, uid, setRequest), [challengeId, uid]);

  if (linkedTo === undefined || request === undefined) return <Centered />;
  if (linkedTo) return <Navigate to={`/me/${challengeId}`} replace />;

  const signOutButton = (
    <Button variant="ghost" size="lg" block onClick={() => signOut(auth)}>Выйти из аккаунта</Button>
  );

  if (request?.status === "pending" && !editing) {
    return (
      <AuthLayout>
        <AuthMessage
          icon={<Clock />}
          title="Заявка отправлена"
          description={`Организатор «${challengeName}» проверит её и привяжет к вашему имени. Эта страница обновится сама — можно закрыть и открыть ссылку позже.`}
        >
          <dl className="divide-y divide-border rounded-xl border border-border text-sm">
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">Имя</dt><dd className="text-right font-medium">{request.name}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">Телефон</dt><dd className="text-right font-medium tabular">{request.phone}</dd></div>
          </dl>
          <Button variant="secondary" size="lg" block onClick={() => setEditing(true)}>Исправить данные</Button>
          {signOutButton}
        </AuthMessage>
      </AuthLayout>
    );
  }

  if (request?.status === "rejected" && !editing) {
    return (
      <AuthLayout>
        <AuthMessage
          icon={<UserX />}
          title="Заявку не подтвердили"
          description="Возможно, организатор не узнал вас по имени или номеру. Напишите ему или отправьте заявку ещё раз с правильными данными."
        >
          <Button variant="primary" size="lg" block onClick={() => setEditing(true)}>Отправить ещё раз</Button>
          {signOutButton}
        </AuthMessage>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <RequestForm
        code={code}
        challengeName={challengeName}
        initial={request ?? null}
        defaultName={currentUser?.displayName ?? ""}
        onDone={() => setEditing(false)}
      />
      <div className="mt-3">{signOutButton}</div>
    </AuthLayout>
  );
}

function RequestForm({ code, challengeName, initial, defaultName, onDone }: {
  code: string;
  challengeName: string;
  initial: JoinRequest | null;
  defaultName: string;
  onDone: () => void;
}) {
  const [first, ...rest] = (initial?.name ?? defaultName).trim().split(/\s+/);
  const [firstName, setFirstName] = useState(first ?? "");
  const [lastName, setLastName] = useState(rest.join(" "));
  const [phone, setPhone] = useState(initial?.phone ?? "+7 ");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, "");
  const valid = firstName.trim() && lastName.trim() && digits.length >= 10;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await submitJoinRequest({ code, firstName, lastName, phone });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^.*?:\s*/, "") : "Не удалось отправить заявку.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p className="text-[13px] font-medium text-muted-foreground">{challengeName}</p>
      <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em]">Кто вы?</h1>
      <p className="mt-2 text-[15px] text-muted-foreground text-pretty">
        Организатор сверит имя и номер со списком участников и подтвердит заявку.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Имя">
            {({ id }) => <Input id={id} value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" required />}
          </Field>
          <Field label="Фамилия">
            {({ id }) => <Input id={id} value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" required />}
          </Field>
        </div>
        <Field label="Номер телефона" hint="Тот, с которым вы в общем чате WhatsApp.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-describedby={describedBy}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+7 701 123 45 67"
              required
            />
          )}
        </Field>
      </div>

      {error && <InlineAlert className="mt-4">{error}</InlineAlert>}

      <Button type="submit" variant="primary" size="lg" block className="mt-6" loading={saving} disabled={!valid}>
        {!saving && <CircleCheck />} Отправить заявку
      </Button>
    </form>
  );
}

function Centered() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner />
    </div>
  );
}
