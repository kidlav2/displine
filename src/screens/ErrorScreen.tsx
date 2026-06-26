import { Globe, Link2Off, Clock } from "lucide-react";
import { useParams } from "react-router";
import type { ErrorVariant } from "../types";

const cfg = {
  "no-invite": {
    icon: <Globe size={32} className="text-muted-foreground" />,
    title: "No challenge found",
    sub: "It looks like you've landed here without an invite link. Ask your organizer to share the join link for your challenge.",
    action: null,
  },
  "invite-invalid": {
    icon: <Link2Off size={32} className="text-muted-foreground" />,
    title: "This invite link isn't valid",
    sub: "The link may have expired, been revoked, or copied incorrectly. Ask your organizer to send you a fresh invite.",
    action: "Contact your organizer",
  },
  "challenge-ended": {
    icon: <Clock size={32} className="text-muted-foreground" />,
    title: "This challenge has ended",
    sub: "The challenge you were invited to has already finished. Reach out to your organizer to find out about the next one.",
    action: "Contact your organizer",
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
