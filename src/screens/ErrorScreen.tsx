import { Globe, Link2Off, Clock, Send, Mail } from "lucide-react";
import { useParams, useLocation } from "react-router";
import type { ErrorVariant } from "../types";

const cfg = {
  "no-invite": {
    icon: <Globe size={32} className="text-muted-foreground" />,
    title: "Челлендж не найден",
    sub: "Похоже, вы попали сюда без ссылки-приглашения. Попросите организатора поделиться ссылкой для вступления.",
    action: null,
  },
  "invite-invalid": {
    icon: <Link2Off size={32} className="text-muted-foreground" />,
    title: "Эта ссылка недействительна",
    sub: "Ссылка могла истечь, быть отозванной или скопированной неверно. Попросите организатора прислать новое приглашение.",
    action: "Связаться с организатором",
  },
  "challenge-ended": {
    icon: <Clock size={32} className="text-muted-foreground" />,
    title: "Этот челлендж завершён",
    sub: "Челлендж, на который вас пригласили, уже закончился. Свяжитесь с организатором, чтобы узнать о следующем.",
    action: "Связаться с организатором",
  },
} as const;

export function ErrorScreen() {
  const { variant } = useParams<{ variant: string }>();
  const location = useLocation();
  const state = location.state as { ownerTelegramUsername?: string; ownerContact?: string } | null;

  const c = cfg[(variant as ErrorVariant) ?? "no-invite"] ?? cfg["no-invite"];

  const contactButton = () => {
    if (!c.action) return null;

    if (state?.ownerTelegramUsername) {
      return (
        <a
          href={`https://t.me/${state.ownerTelegramUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border-2 border-border bg-card"
        >
          <Send size={14} className="text-blue-500" />
          {c.action}
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
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border-2 border-border bg-card"
        >
          <Mail size={14} className="text-muted-foreground" />
          {c.action}
        </a>
      );
    }

    return (
      <p className="text-sm text-muted-foreground">
        Свяжитесь с организатором напрямую.
      </p>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] px-8 text-center gap-5">
      <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center">
        {c.icon}
      </div>
      <div>
        <p className="font-extrabold text-xl leading-tight mb-2">{c.title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{c.sub}</p>
      </div>
      {contactButton()}
    </div>
  );
}
