import { useMemo, useState } from "react";
import { Check, Copy, Phone, Share2, X } from "lucide-react";
import { Av, Button, Section, Select } from "./atoms";
import { resolveJoinRequest } from "../lib/firestore";
import { notify } from "../lib/notify";
import type { JoinRequest, Participant } from "../types";

function norm(s: string): string {
  return s.trim().toLocaleLowerCase("ru").replace(/ё/g, "е");
}

/** How well a typed name fits a roster name: 2 = both words, 1 = one word, 0 = none. */
function nameScore(a: string, b: string): number {
  const wa = norm(a).split(/\s+/).filter(Boolean);
  const wb = new Set(norm(b).split(/\s+/).filter(Boolean));
  return wa.filter(w => wb.has(w)).length;
}

export function selfJoinLink(inviteCode: string): string {
  return `${window.location.origin}/r/${inviteCode}`;
}

/** Settings block: the common link for the group chat and the requests waiting to be linked. */
export function SelfJoinSection({ challengeId, inviteCode, roster, requests }: {
  challengeId: string;
  inviteCode: string;
  roster: Participant[];
  requests: JoinRequest[];
}) {
  const link = inviteCode ? selfJoinLink(inviteCode) : "";
  const linkedCount = roster.filter(p => p.linkedUid).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      notify.success("Ссылка скопирована");
    } catch {
      notify.error("Не удалось скопировать — выделите ссылку вручную.");
    }
  };
  const share = async () => {
    try { await navigator.share({ title: "Отмечайтесь в Displine", url: link }); } catch { /* closed */ }
  };

  return (
    <Section
      id="self"
      title="Участники отмечаются сами"
      description={`Подключились ${linkedCount} из ${roster.length}. Отметить себя можно только за сегодня — прошлые дни меняете только вы.`}
      grouped={false}
    >
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[13px] font-medium text-muted-foreground">Ссылка для общего чата</p>
        {link ? (
          <>
            <p className="mt-1.5 select-all break-all rounded-lg bg-muted px-3 py-2 font-mono text-[13px]">{link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={copy}><Copy /> Скопировать</Button>
              {"share" in navigator && <Button size="sm" variant="secondary" onClick={share}><Share2 /> Поделиться</Button>}
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground text-pretty">
              Человек входит через Telegram и пишет имя и номер из WhatsApp. Заявка появится здесь — сверьте и привяжите к имени из списка.
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">У этого челленджа нет кода приглашения.</p>
        )}
      </div>

      {requests.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 px-0.5 text-[13px] font-medium text-muted-foreground">Заявки · {requests.length}</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {requests.map(r => <RequestRow key={r.uid} challengeId={challengeId} request={r} roster={roster} />)}
          </ul>
        </div>
      )}
    </Section>
  );
}

function RequestRow({ challengeId, request, roster }: { challengeId: string; request: JoinRequest; roster: Participant[] }) {
  const options = useMemo(
    () => roster
      .filter(p => !p.linkedUid)
      .map(p => ({ p, score: nameScore(request.name, p.name) }))
      .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, "ru")),
    [roster, request.name],
  );
  const best = options[0]?.score ? options[0].p.uid : "";
  const [target, setTarget] = useState(best);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const decide = async (decision: "approve" | "reject") => {
    setBusy(decision);
    try {
      await resolveJoinRequest({ challengeId, uid: request.uid, decision, participantId: decision === "approve" ? target : undefined });
      notify.success(decision === "approve" ? `${request.name} теперь отмечается сам` : "Заявка отклонена");
    } catch (err) {
      notify.error(err instanceof Error ? err.message.replace(/^.*?:\s*/, "") : "Не получилось.");
      setBusy(null);
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Av ini={request.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()} photoUrl={request.photoUrl} sz="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{request.name}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
            <a href={`tel:${request.phone}`} className="inline-flex items-center gap-1 tabular hover:text-foreground">
              <Phone className="size-3.5" aria-hidden />{request.phone}
            </a>
            {request.telegramUsername && <span>@{request.telegramUsername}</span>}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select aria-label={`Кто это в списке: ${request.name}`} value={target} onChange={e => setTarget(e.target.value)} className="sm:flex-1">
          <option value="" disabled>Кто это в списке?</option>
          {options.map(({ p, score }) => (
            <option key={p.uid} value={p.uid}>{p.name}{score === 2 ? " — совпадает" : ""}</option>
          ))}
          <option value="new">Новый участник — добавить в список</option>
        </Select>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="secondary" onClick={() => decide("reject")} loading={busy === "reject"} disabled={!!busy}>
            {busy !== "reject" && <X />} Отклонить
          </Button>
          <Button variant="primary" onClick={() => decide("approve")} loading={busy === "approve"} disabled={!!busy || !target}>
            {busy !== "approve" && <Check />} Привязать
          </Button>
        </div>
      </div>
    </li>
  );
}
