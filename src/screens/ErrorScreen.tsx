import { Globe, Link2Off, Clock } from "lucide-react";
import { useParams } from "react-router";
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
  const c = cfg[(variant as ErrorVariant) ?? "no-invite"] ?? cfg["no-invite"];

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-5">
      <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center">
        {c.icon}
      </div>
      <div>
        <p className="font-extrabold text-xl leading-tight mb-2">{c.title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{c.sub}</p>
      </div>
      {c.action && (
        <a
          href="mailto:organizer@example.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border-2 border-border bg-card"
        >
          {c.action}
        </a>
      )}
    </div>
  );
}
