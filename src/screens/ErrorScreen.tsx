import { Clock, Globe, Link2Off, Mail, Send, Timer } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { AuthMessage } from "../components/AuthLayout";
import { Button, buttonClass } from "../components/atoms";
import type { ErrorVariant } from "../types";

const cfg = {
  "no-invite": {
    icon: <Globe />,
    title: "Челлендж не найден",
    sub: "Похоже, вы открыли страницу без ссылки-приглашения. Попросите организатора прислать ссылку.",
    contact: false,
  },
  "invite-invalid": {
    icon: <Link2Off />,
    title: "Ссылка недействительна",
    sub: "Ссылка могла истечь, быть отозванной или скопированной с ошибкой. Попросите организатора прислать новую.",
    contact: true,
  },
  "challenge-ended": {
    icon: <Clock />,
    title: "Челлендж завершён",
    sub: "Челлендж, в который вас пригласили, уже закончился. Уточните у организатора, когда будет следующий.",
    contact: true,
  },
  "team-invite-expired": {
    icon: <Timer />,
    title: "Срок ссылки истёк",
    sub: "Приглашение в команду действует 24 часа. Попросите организатора создать новое.",
    contact: false,
  },
  "team-invite-used": {
    icon: <Link2Off />,
    title: "Ссылка уже использована",
    sub: "Приглашение в команду одноразовое. Попросите организатора создать новое.",
    contact: false,
  },
} as const;

export function ErrorScreen() {
  const { variant } = useParams<{ variant: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { ownerTelegramUsername?: string; ownerContact?: string } | null;
  const c = cfg[(variant as ErrorVariant) ?? "no-invite"] ?? cfg["no-invite"];

  const contact = (() => {
    if (!c.contact) return null;
    if (state?.ownerTelegramUsername) {
      return (
        <a
          href={`https://t.me/${state.ownerTelegramUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ variant: "primary", size: "lg", block: true })}
        >
          <Send /> Написать организатору
        </a>
      );
    }
    if (state?.ownerContact) {
      const isEmail = state.ownerContact.includes("@");
      return (
        <a
          href={isEmail ? `mailto:${state.ownerContact}` : state.ownerContact}
          target={isEmail ? undefined : "_blank"}
          rel="noopener noreferrer"
          className={buttonClass({ variant: "primary", size: "lg", block: true })}
        >
          <Mail /> Написать организатору
        </a>
      );
    }
    return null;
  })();

  return (
    <AuthMessage icon={c.icon} title={c.title} description={c.sub}>
      {contact}
      <Button variant={contact ? "ghost" : "secondary"} size="lg" block onClick={() => navigate("/")}>
        На главную
      </Button>
    </AuthMessage>
  );
}
