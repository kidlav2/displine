import { useState } from "react";
import { ChevronLeft, Plus, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";
import { inviteTeamMember, updateTeamMemberRole, removeTeamMember } from "../lib/firestore";
import { useAuthContext } from "../contexts/AuthContext";
import type { OrgRole, TeamMember } from "../types";

export function TeamScreen() {
  const { challenge } = useAppContext();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("helper");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendInvite = async () => {
    if (!inviteEmail.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await inviteTeamMember(challenge.id, inviteEmail.trim(), inviteEmail.split("@")[0], inviteRole);
      setInviteEmail("");
      setSent(true);
      setTimeout(() => { setSent(false); setShowInvite(false); }, 2000);
    } catch {
      setError("Не удалось отправить приглашение. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (id: string, role: OrgRole) => {
    try { await updateTeamMemberRole(challenge.id, id, role); }
    catch { setError("Не удалось обновить роль."); }
  };

  const removeMember = async (id: string) => {
    try { await removeTeamMember(challenge.id, id); }
    catch { setError("Не удалось удалить участника."); }
  };

  const roleBadge = (role: OrgRole, status: TeamMember["status"]) => {
    if (status === "invited") return (
      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">Приглашён</span>
    );
    return role === "owner"
      ? <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">Владелец</span>
      : <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">Помощник</span>;
  };

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-6 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ChevronLeft size={16} /> Назад
        </button>
        <p className="font-extrabold text-lg">Команда</p>
        <button onClick={() => setShowInvite(v => !v)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs text-white"
          style={{ background: BRAND_COLOR }}>
          <Plus size={13} /> Пригласить
        </button>
      </div>

      {error && <p className="text-xs font-bold text-red-500 mb-3">{error}</p>}

      {showInvite && (
        <Card className="!p-4 mb-4 border-orange-100 bg-orange-50">
          {sent ? (
            <div className="flex items-center gap-2 py-2">
              <CheckCircle2 size={18} className="text-green-500" />
              <p className="font-bold text-sm text-green-700">Приглашение отправлено! Они получат письмо со ссылкой для установки пароля.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-bold text-sm">Пригласить участника</p>
              <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-3 lg:space-y-0">
                <div>
                  <SecLabel>Адрес эл. почты</SecLabel>
                  <input type="email" placeholder="коллега@пример.рф" value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full mt-1.5 bg-card rounded-xl px-3 py-2.5 text-sm outline-none border border-border" />
                </div>
                <div>
                  <SecLabel>Роль</SecLabel>
                  <div className="flex gap-2 mt-1.5">
                    {(["helper", "owner"] as OrgRole[]).map(r => (
                      <button key={r} onClick={() => setInviteRole(r)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-colors"
                        style={inviteRole === r ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)" }}>
                        {r === "owner" ? "Совладелец" : "Помощник"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {inviteRole === "owner" && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Совладельцы получают полный доступ, включая настройки челленджа и управление командой.</p>
                </div>
              )}
              <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs text-blue-600 font-semibold">Доступ помощника включает:</p>
                <p className="text-xs text-blue-500 mt-0.5">Проверка и одобрение отправок · Просмотр статистики · Не может изменять настройки или корректировать жизни/очки</p>
              </div>
              <button onClick={sendInvite} disabled={!inviteEmail.trim() || loading}
                className="w-full py-3 rounded-xl font-extrabold text-sm text-white disabled:opacity-35"
                style={{ background: BRAND_COLOR }}>
                {loading ? "Отправка…" : "Отправить приглашение"}
              </button>
            </div>
          )}
        </Card>
      )}

      <div className="space-y-2">
        {challenge.team.map(member => (
          <Card key={member.id} className={`!p-4 ${member.status === "invited" ? "opacity-70" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-extrabold text-sm shrink-0">
                {member.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm">{member.name}</p>
                  {roleBadge(member.role, member.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{member.email}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {member.status === "invited" ? "Приглашение отправлено" : "Активен с"} {member.since}
                </p>
              </div>
              {/* Hide controls for the current user's own row */}
              {member.email !== currentUser?.email ? (
                <div className="flex items-center gap-2 shrink-0">
                  <select value={member.role} onChange={e => changeRole(member.id, e.target.value as OrgRole)}
                    className="text-xs font-bold bg-muted border border-border rounded-lg px-2 py-1 outline-none cursor-pointer">
                    <option value="helper">Помощник</option>
                    <option value="owner">Совладелец</option>
                  </select>
                  <button onClick={() => removeMember(member.id)}
                    className="w-8 h-8 rounded-lg border border-red-200 bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors">
                    <XCircle size={14} />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic shrink-0">вы</span>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-5 p-3.5 bg-muted rounded-xl border border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground">Все решения по проверке публичны.</span>{" "}
          Каждая отправка, одобрение, отказ и комментарий организатора видны в ленте активности всем участникам — поэтому любой помощник может проверять любую отправку, в том числе от людей, которых знает лично. Ответственность достигается прозрачностью, а не ограничениями.
        </p>
      </div>
    </div>
  );
}
