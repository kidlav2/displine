import { useState, useEffect } from "react";
import { ChevronLeft, Shield, Globe, Minus, AlertCircle, Lock, MessageCircle, CheckCircle2, Send, Heart, Instagram, Link as LinkIcon } from "lucide-react";
import { useParams, useNavigate } from "react-router";
import { getDoc } from "firebase/firestore";
import { Av, Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, bc } from "../constants/design";
import { calcScore } from "../lib/scoring";
import { findCity, localNow, utcLabel } from "../lib/timezone";
import { useAppContext } from "../contexts/AppContext";
import { removeLife, logPenalty, userRef, getOrgNote, saveOrgNote } from "../lib/firestore";
import { useAuthContext } from "../contexts/AuthContext";
import type { Penalty, UserProfile } from "../types";

export function ParticipantProfile() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { challenge, isAdmin, isOwner, scoring } = useAppContext();
  const { currentUser } = useAuthContext();

  const meParticipant = challenge.participants.find(p => p.uid === currentUser?.uid);
  const actor = (currentUser && meParticipant)
    ? { uid: currentUser.uid, name: meParticipant.name, ini: meParticipant.ini, isAdmin: meParticipant.isAdmin }
    : undefined;

  const participant = challenge.participants.find(p => p.uid === uid);

  const [penaltyForm, setPenaltyForm]     = useState(false);
  const [penaltyReason, setPenaltyReason] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("5000");
  const [orgNoteSaved, setOrgNoteSaved]   = useState(false);
  const [orgNote, setOrgNote]             = useState("");
  const [noteLoading, setNoteLoading]     = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [publicProfile, setPublicProfile] = useState<UserProfile | null>(null);

  // Fetch bio + social links from users/{uid}
  useEffect(() => {
    if (!uid) return;
    getDoc(userRef(uid))
      .then(snap => { if (snap.exists()) setPublicProfile({ uid, ...snap.data() } as UserProfile); })
      .catch(() => {});
  }, [uid]);

  // Load any existing organizer note for this participant
  useEffect(() => {
    if (!isAdmin || !uid) return;
    getOrgNote(challenge.id, uid).then(setOrgNote).catch(() => {});
  }, [isAdmin, challenge.id, uid]);

  if (!participant) return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Участник не найден.</div>
  );

  const score = calcScore(participant.results, scoring);

  const onRemoveLife = async () => {
    setActionLoading(true);
    try { await removeLife(challenge.id, participant.uid, actor, participant.name); }
    finally { setActionLoading(false); }
  };

  const onLogPenalty = async (pen: Omit<Penalty, "date">) => {
    if (!currentUser) return;
    setActionLoading(true);
    try {
      await logPenalty(challenge.id, participant.uid, { ...pen, loggedBy: currentUser.uid }, actor, participant.name);
      setPenaltyReason(""); setPenaltyForm(false);
    } finally { setActionLoading(false); }
  };

  const progressPct = challenge.duration > 0
    ? Math.min(100, (challenge.currentDay / challenge.duration) * 100)
    : 0;

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-8 space-y-4 max-w-[560px] mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <ChevronLeft size={16} /> Назад
      </button>
      <div className="flex flex-col items-center text-center pt-2">
        <Av ini={participant.ini} photoUrl={publicProfile?.photoUrl ?? participant.photoUrl} sz="lg" admin={participant.isAdmin} />
        <div className="flex items-center gap-2 mt-3">
          <p className="font-extrabold text-2xl">{participant.name}</p>
          {participant.role === "owner" && (
            <span className="flex items-center gap-1 text-[10px] font-extrabold text-purple-500 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
              <Shield size={9} /> владелец
            </span>
          )}
          {participant.role === "helper" && (
            <span className="flex items-center gap-1 text-[10px] font-extrabold text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              <Shield size={9} /> помощник
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Вступил {participant.joinDate}</p>
        {/* Bio + social links — visible to all */}
        {publicProfile?.bio && (
          <p className="text-sm text-muted-foreground mt-2 max-w-[280px] leading-snug">{publicProfile.bio}</p>
        )}
        {(publicProfile?.socialLinks?.instagram || publicProfile?.socialLinks?.other) && (
          <div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
            {publicProfile.socialLinks.instagram && (
              <a href={publicProfile.socialLinks.instagram.startsWith("http") ? publicProfile.socialLinks.instagram : `https://${publicProfile.socialLinks.instagram}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:underline">
                <Instagram size={13} /> Instagram
              </a>
            )}
            {publicProfile.socialLinks.other && (
              <a href={publicProfile.socialLinks.other.startsWith("http") ? publicProfile.socialLinks.other : `https://${publicProfile.socialLinks.other}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:underline">
                <LinkIcon size={13} /> Ссылка
              </a>
            )}
          </div>
        )}
        {isAdmin && (() => {
          const c = findCity(participant.tz);
          const now = localNow(participant.tz);
          return (
            <div className="flex items-center gap-1.5 mt-1.5 px-3 py-1.5 bg-muted rounded-xl text-xs">
              <Globe size={11} className="text-muted-foreground" />
              <span className="font-semibold">{c.city}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground font-mono">{utcLabel(participant.tz)}</span>
              <span className="text-muted-foreground">· сейчас</span>
              <span className="font-mono font-bold" style={{ color: BRAND_COLOR }}>{now}</span>
            </div>
          );
        })()}
      </div>

      <Card className="!p-4">
        <div className="flex justify-between items-baseline mb-2.5">
          <SecLabel>Прогресс</SecLabel>
          <span className="text-xs font-bold" style={{ color: BRAND_COLOR }}>День {challenge.currentDay} / {challenge.duration}</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: BRAND_COLOR }} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <SecLabel>Очки в челлендже</SecLabel>
          <p style={{ ...bc, fontSize: 32, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{score.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">очков</p>
        </Card>
        <Card className="!p-4">
          <SecLabel>Пробежано</SecLabel>
          <p style={{ ...bc, fontSize: 32, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{participant.km}</p>
          <p className="text-xs text-muted-foreground mt-1">км</p>
        </Card>
      </div>

      <Card className="!p-4">
        <SecLabel>Оставшиеся жизни</SecLabel>
        <div className="flex gap-3 justify-center py-3">
          <Hearts n={participant.lives} sz={28} />
        </div>
        {!participant.active && <p className="text-center text-xs font-bold text-red-500">Выбыл</p>}
      </Card>

      <Card className="!p-4">
        <SecLabel>История штрафов</SecLabel>
        {participant.penalties.length === 0
          ? <p className="text-sm text-muted-foreground mt-3 text-center py-2">Нарушений нет ✓</p>
          : <div className="mt-3">
              {participant.penalties.map((pen, i) => (
                <div key={i} className="flex items-start gap-3 py-3 border-t border-border first:border-t-0">
                  <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{pen.reason}</p>
                    <p className="text-xs text-muted-foreground">{pen.date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-red-500">−{pen.amount.toLocaleString("ru")} ₸</p>
                    {pen.livesLost > 0 && <p className="text-xs text-red-400 flex items-center justify-end gap-0.5 mt-0.5">−{pen.livesLost}<Heart size={9} className="fill-red-400 text-red-400" /></p>}
                  </div>
                </div>
              ))}
            </div>
        }
      </Card>

      {isAdmin && (
        <>
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
              <Shield size={9} className="text-blue-400" />
              {isOwner ? "Панель владельца" : "Панель помощника"}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Card className="!p-4 space-y-3 border-blue-100">
            {isOwner ? (
              <>
                <button onClick={onRemoveLife} disabled={participant.lives === 0 || actionLoading}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-red-100 bg-red-50 disabled:opacity-40 text-left">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0"><Minus size={16} className="text-red-500" /></div>
                  <div><p className="text-sm font-bold text-red-600">Снять жизнь</p><p className="text-xs text-red-400">Вычитает 1 жизнь (только владелец)</p></div>
                </button>
                <button onClick={() => setPenaltyForm(v => !v)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-orange-100 bg-orange-50 text-left">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0"><AlertCircle size={16} className="text-orange-500" /></div>
                  <div><p className="text-sm font-bold text-orange-600">Записать штраф</p><p className="text-xs text-orange-400">Зафиксировать штраф вручную (только владелец)</p></div>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                <Lock size={13} className="text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">Изменение жизней и штрафов доступно только владельцам челленджа. Вы можете проверять отправки на вкладке «Проверка».</p>
              </div>
            )}
            {penaltyForm && (
              <div className="space-y-2">
                <input placeholder="Причина…" value={penaltyReason} onChange={e => setPenaltyReason(e.target.value)}
                  className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none" />
                <div className="flex gap-2">
                  <input type="number" value={penaltyAmount} onChange={e => setPenaltyAmount(e.target.value)}
                    className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none" />
                  <span className="text-sm font-bold text-muted-foreground self-center">₸</span>
                </div>
                <button
                  onClick={() => {
                    if (!penaltyReason.trim()) return;
                    onLogPenalty({ reason: penaltyReason.trim(), livesLost: 1, amount: parseInt(penaltyAmount) || 5000 });
                  }}
                  disabled={!penaltyReason.trim() || actionLoading}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-35" style={{ background: BRAND_COLOR }}>
                  Подтвердить
                </button>
              </div>
            )}
            <div>
              <p className="text-sm font-bold mb-2 flex items-center gap-2"><MessageCircle size={14} className="text-blue-400" /> Заметка организатора</p>
              {orgNoteSaved
                ? <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200"><CheckCircle2 size={13} className="text-green-500" /><span className="text-xs font-semibold text-green-700">Заметка сохранена</span></div>
                : <div className="flex gap-2">
                    <textarea placeholder="Приватная заметка…" value={orgNote} onChange={e => setOrgNote(e.target.value)} rows={2}
                      className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-xs outline-none resize-none placeholder-muted-foreground" />
                    <button
                      disabled={noteLoading}
                      onClick={async () => {
                        if (!orgNote.trim() || noteLoading || !uid) return;
                        setNoteLoading(true);
                        try {
                          await saveOrgNote(challenge.id, uid, orgNote.trim());
                          setOrgNoteSaved(true);
                          setTimeout(() => setOrgNoteSaved(false), 2000);
                        } catch { /* silent — note save is non-critical */ }
                        finally { setNoteLoading(false); }
                      }}
                      className="self-end pb-0.5 disabled:opacity-40" style={{ color: BRAND_COLOR }}>
                      <Send size={17} />
                    </button>
                  </div>
              }
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
