import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, Copy, Link2, Plus, UserPlus, X } from "lucide-react";
import {
  Av, Badge, Button, ConfirmDialog, Field, IconButton, InlineAlert, Input, Page, PageHeader, RoleBadge, Section,
  Segmented, Select, Sheet,
} from "../components/atoms";
import { ROLE_LABELS } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import {
  demoteTeamMember, inviteTeamMember, promoteParticipantToTeam, removeTeamMember, updateTeamMemberRole,
} from "../lib/firestore";
import { notify } from "../lib/notify";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { OrgRole, TeamMember } from "../types";

const ROLE_OPTIONS = [
  { value: "helper" as const, label: ROLE_LABELS.helper },
  { value: "owner" as const, label: "Совладелец" },
];

const ROLE_HINT: Record<OrgRole, string> = {
  helper: "Отмечает участников, записывает штрафы и переносы, меняет настройки челленджа.",
  owner: "Всё то же, что помощник, плюс управление командой.",
};

export function TeamScreen() {
  const { challenge } = useAppContext();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();
  useDocumentTitle("Команда");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [toRemove, setToRemove] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const changeRole = async (member: TeamMember, role: OrgRole) => {
    try {
      await updateTeamMemberRole(challenge.id, member.id, role);
    } catch (err) {
      console.error("[Team] updateTeamMemberRole failed:", err);
      notify.error("Не удалось изменить роль.");
    }
  };

  const remove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      if (toRemove.status === "active" && toRemove.uid) {
        // Resets the participant role and deletes the team doc atomically.
        await demoteTeamMember(challenge.id, toRemove.uid);
      } else {
        // Invite that was never accepted: just drop the slot.
        await removeTeamMember(challenge.id, toRemove.id);
      }
      setToRemove(null);
    } catch (err) {
      console.error("[Team] remove failed:", err);
      notify.error("Не удалось удалить из команды.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Page width="sm">
      <PageHeader
        back={{ label: "Настройки", onClick: () => navigate("/app/settings") }}
        title="Команда"
        description="Кто может вести этот челлендж. Участникам доступ не нужен."
        actions={
          <Button variant="primary" onClick={() => setInviteOpen(true)}>
            <Plus /> Пригласить
          </Button>
        }
      />

      <Section title={<>В команде <span className="font-normal text-subtle-foreground tabular">{challenge.team.length}</span></>}>
        {challenge.team.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Пока в команде только вы.</p>
        )}
        {challenge.team.map(member => {
          const participant = challenge.participants.find(p => p.uid === member.uid);
          const isMe = member.uid === currentUser?.uid;
          const invited = member.status === "invited";
          const initials = member.name.split(" ").map(w => w[0]).join("").slice(0, 2);
          return (
            <div key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <Av ini={initials} photoUrl={participant?.photoUrl} sz="md" />
              <div className="min-w-0 flex-1 basis-[calc(100%-52px)] sm:basis-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-medium sm:text-sm">{member.name}</span>
                  {isMe ? <Badge>Вы</Badge> : invited ? <Badge tone="warning">Ждёт входа</Badge> : <RoleBadge role={member.role} />}
                </div>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {[member.email, invited ? `приглашение от ${member.since}` : member.since ? `в команде с ${member.since}` : null]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
              {!isMe && (
                <div className="ml-[52px] flex items-center gap-1 sm:ml-0">
                  <Select
                    aria-label={`Роль: ${member.name}`}
                    value={member.role}
                    onChange={e => changeRole(member, e.target.value as OrgRole)}
                    className="h-9 w-auto text-[13px] sm:h-9"
                  >
                    {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                  <IconButton label={`Убрать из команды: ${member.name}`} size="md" onClick={() => setToRemove(member)} className="hover:text-danger-text">
                    <X />
                  </IconButton>
                </div>
              )}
            </div>
          );
        })}
      </Section>

      <div className="mt-4">
        <Button variant="ghost" onClick={() => setPromoteOpen(true)} className="-ml-2">
          <UserPlus /> Повысить участника
        </Button>
      </div>

      {inviteOpen && <InviteSheet onClose={() => setInviteOpen(false)} />}
      {promoteOpen && <PromoteSheet onClose={() => setPromoteOpen(false)} />}

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={open => { if (!open && !removing) setToRemove(null); }}
        title={toRemove?.status === "invited" ? "Отменить приглашение?" : `Убрать ${toRemove?.name ?? ""} из команды?`}
        description={toRemove?.status === "invited"
          ? "Ссылка перестанет работать."
          : "Человек потеряет доступ к управлению челленджем. Вернуть можно новым приглашением."}
        confirmLabel={toRemove?.status === "invited" ? "Отменить приглашение" : "Убрать"}
        loading={removing}
        onConfirm={remove}
      />
    </Page>
  );
}

function InviteSheet({ onClose }: { onClose: () => void }) {
  const { challenge } = useAppContext();
  const [open, setOpen] = useState(true);
  const [role, setRole] = useState<OrgRole>("helper");
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const close = () => { setOpen(false); setTimeout(onClose, 250); };

  const generate = async () => {
    setLoading(true);
    try {
      const code = await inviteTeamMember(challenge.id, challenge.name, challenge.emoji, role);
      setLink(`${window.location.origin}/join?code=${code}`);
    } catch (err) {
      console.error("[Team] inviteTeamMember failed:", err);
      notify.error("Не удалось создать ссылку. Приглашать может только создатель челленджа.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Не удалось скопировать. Выделите ссылку вручную.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) close(); }} title="Пригласить в команду" description="Одноразовая ссылка, действует 24 часа.">
      {link ? (
        <div className="space-y-4">
          <Field label={`Ссылка для роли «${role === "owner" ? "Совладелец" : ROLE_LABELS.helper}»`}>
            {({ id }) => (
              <Input id={id} readOnly value={link} onFocus={e => e.currentTarget.select()} className="font-mono text-[13px] sm:text-[13px]" />
            )}
          </Field>
          <Button variant="primary" block onClick={copy}>
            {copied ? <><Check /> Скопировано</> : <><Copy /> Скопировать ссылку</>}
          </Button>
          <Button variant="ghost" block onClick={() => { setLink(null); setCopied(false); }}>
            Создать ещё одну
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[13px] font-medium text-muted-foreground">Роль</p>
            <Segmented aria-label="Роль" block value={role} onChange={setRole} options={ROLE_OPTIONS} />
            <p className="mt-2 text-[13px] text-muted-foreground text-pretty">{ROLE_HINT[role]}</p>
          </div>
          <Button variant="primary" block loading={loading} onClick={generate}>
            <Link2 /> Создать ссылку
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function PromoteSheet({ onClose }: { onClose: () => void }) {
  const { challenge } = useAppContext();
  const { currentUser } = useAuthContext();
  const [open, setOpen] = useState(true);
  const [uid, setUid] = useState("");
  const [role, setRole] = useState<OrgRole>("helper");
  const [loading, setLoading] = useState(false);
  const close = () => { setOpen(false); setTimeout(onClose, 250); };

  const eligible = challenge.participants.filter(p => p.role === "participant" && p.uid !== currentUser?.uid);

  const promote = async () => {
    const p = challenge.participants.find(x => x.uid === uid);
    if (!p) return;
    setLoading(true);
    try {
      await promoteParticipantToTeam(challenge.id, p.uid, p.name, role);
      notify.success(`${p.name} теперь в команде`);
      close();
    } catch (err) {
      console.error("[Team] promote failed:", err);
      notify.error("Не удалось повысить участника.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) close(); }} title="Повысить участника">
      {eligible.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Некого повышать — все участники уже в команде.</p>
      ) : (
        <div className="space-y-4">
          <InlineAlert tone="warning">
            Подходит только тем, кто уже входил в Displine со своим аккаунтом. Участник, добавленный по имени, войти не сможет.
          </InlineAlert>
          <Field label="Участник">
            {({ id }) => (
              <Select id={id} value={uid} onChange={e => setUid(e.target.value)}>
                <option value="">Выберите…</option>
                {eligible.map(p => <option key={p.uid} value={p.uid}>{p.name}</option>)}
              </Select>
            )}
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-medium text-muted-foreground">Роль</p>
            <Segmented aria-label="Роль" block value={role} onChange={setRole} options={ROLE_OPTIONS} />
            <p className="mt-2 text-[13px] text-muted-foreground text-pretty">{ROLE_HINT[role]}</p>
          </div>
          <Button variant="primary" block loading={loading} disabled={!uid} onClick={promote}>
            Повысить
          </Button>
        </div>
      )}
    </Sheet>
  );
}
