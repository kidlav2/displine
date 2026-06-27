import { useState } from "react";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Av, Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { calcScore } from "../lib/scoring";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { setParticipantLives, promoteParticipantToTeam, demoteTeamMember, removeParticipantFromChallenge } from "../lib/firestore";
import type { OrgRole } from "../types";

export function ManageParticipantsScreen() {
  const { challenge, isOwner, scoring, meParticipant } = useAppContext();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();

  const actor = (currentUser && meParticipant)
    ? { uid: currentUser.uid, name: meParticipant.name, ini: meParticipant.ini, isAdmin: meParticipant.isAdmin }
    : undefined;

  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const adjustLives = async (uid: string, current: number, delta: number) => {
    const next = Math.max(0, Math.min(5, current + delta));
    setError(null);
    const target = challenge.participants.find(p => p.uid === uid);
    try {
      await setParticipantLives(challenge.id, uid, next, actor, target?.name);
    } catch {
      setError("Не удалось изменить жизни.");
    }
  };

  const handlePromote = async (uid: string, name: string, role: OrgRole) => {
    setActionLoading(uid);
    setError(null);
    try {
      await promoteParticipantToTeam(challenge.id, uid, name, role, actor);
    } catch {
      setError("Не удалось изменить роль.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDemote = async (uid: string) => {
    setActionLoading(uid);
    setError(null);
    const target = challenge.participants.find(p => p.uid === uid);
    try {
      await demoteTeamMember(challenge.id, uid, actor, target?.name);
    } catch {
      setError("Не удалось изменить роль.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (uid: string, wasTeamMember: boolean) => {
    setActionLoading(uid);
    setError(null);
    const target = challenge.participants.find(p => p.uid === uid);
    try {
      await removeParticipantFromChallenge(challenge.id, uid, wasTeamMember, actor, target?.name);
      setConfirmingRemove(null);
    } catch {
      setError("Не удалось удалить участника.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-4 max-w-[720px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ChevronLeft size={16} /> Назад
        </button>
        <p className="font-extrabold text-lg">Управление участниками</p>
      </div>

      {error && <p className="text-xs font-bold text-red-500 mb-3">{error}</p>}

      <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-2 lg:space-y-0">
        {challenge.participants.map(p => {
          const isMe = p.uid === currentUser?.uid;
          const isParticipantOwner = p.role === "owner";
          const canAct = isOwner && !isMe && !isParticipantOwner;
          const isActing = actionLoading === p.uid;
          const isConfirming = confirmingRemove === p.uid;

          return (
            <Card key={p.uid} className="!p-3.5">
              {/* Clickable header → participant profile */}
              <button
                onClick={() => navigate(`/participants/${p.uid}`)}
                className="w-full flex items-center gap-3 text-left mb-3">
                <Av ini={p.ini} photoUrl={p.photoUrl} sz="sm" admin={p.isAdmin} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold">{p.name}</p>
                    {isParticipantOwner && <span className="text-[9px] font-extrabold text-purple-500">ВЛАДЕЛЕЦ</span>}
                    {p.isAdmin && !isParticipantOwner && <span className="text-[9px] font-extrabold text-blue-500">ORG</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{calcScore(p.results, scoring)} оч.</p>
                </div>
                <Hearts n={p.lives} sz={13} />
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              </button>

              {/* Lives adjustment */}
              <div className="flex items-center justify-between">
                <SecLabel>Жизни</SecLabel>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => adjustLives(p.uid, p.lives, -1)}
                    className="w-8 h-8 rounded-lg border border-border font-bold text-base flex items-center justify-center">−</button>
                  <span className="font-extrabold text-base w-4 text-center">{p.lives}</span>
                  <button
                    onClick={() => adjustLives(p.uid, p.lives, +1)}
                    className="w-8 h-8 rounded-lg border border-border font-bold text-base flex items-center justify-center">+</button>
                </div>
              </div>

              {/* Role & remove actions (owner only, non-owner non-self participants) */}
              {canAct && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  {p.role === "participant" && (
                    <button
                      onClick={() => handlePromote(p.uid, p.name, "helper")}
                      disabled={isActing}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-blue-200 bg-blue-50 text-blue-600 disabled:opacity-40">
                      <ArrowUp size={11} /> Помощник
                    </button>
                  )}
                  {p.role === "helper" && (
                    <button
                      onClick={() => handleDemote(p.uid)}
                      disabled={isActing}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-muted bg-muted text-muted-foreground disabled:opacity-40">
                      <ArrowDown size={11} /> Участник
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmingRemove(p.uid)}
                    disabled={isActing}
                    className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-red-200 bg-red-50 text-red-500 disabled:opacity-40">
                    <Trash2 size={11} /> Удалить
                  </button>
                </div>
              )}

              {/* Confirm remove */}
              {isConfirming && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-red-700">Удалить {p.name} из челленджа?</p>
                  <p className="text-xs text-red-400 leading-snug">
                    Прошлые отправки останутся как история. Это действие нельзя отменить.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingRemove(null)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold border border-border bg-card">
                      Отмена
                    </button>
                    <button
                      onClick={() => handleRemove(p.uid, p.role !== "participant")}
                      disabled={isActing}
                      className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                      style={{ background: "#ef4444" }}>
                      {isActing ? "Удаление…" : "Удалить"}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
