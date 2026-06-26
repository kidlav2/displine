import { useState } from "react";
import { ChevronLeft, Shield, Globe, Minus, AlertCircle, Lock, MessageCircle, CheckCircle2, Send, Heart } from "lucide-react";
import { useParams, useNavigate } from "react-router";
import { Av, Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, bc } from "../constants/design";
import { calcScore } from "../lib/scoring";
import { findCity, localNow, utcLabel } from "../lib/timezone";
import { fmtDateShort } from "../lib/dates";
import { useAppContext } from "../contexts/AppContext";
import { removeLife, logPenalty } from "../lib/firestore";
import { useAuthContext } from "../contexts/AuthContext";
import type { Penalty } from "../types";

export function ParticipantProfile() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { challenge, isAdmin, isOwner } = useAppContext();
  const { currentUser } = useAuthContext();

  const participant = challenge.participants.find(p => p.uid === uid);

  const [penaltyForm, setPenaltyForm]     = useState(false);
  const [penaltyReason, setPenaltyReason] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("5000");
  const [orgNoteSaved, setOrgNoteSaved]   = useState(false);
  const [orgNote, setOrgNote]             = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  if (!participant) return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Participant not found.</div>
  );

  const score = calcScore(participant.results);

  const onRemoveLife = async () => {
    setActionLoading(true);
    try { await removeLife(challenge.id, participant.uid); }
    finally { setActionLoading(false); }
  };

  const onLogPenalty = async (pen: Omit<Penalty, "date">) => {
    if (!currentUser) return;
    setActionLoading(true);
    try {
      await logPenalty(challenge.id, participant.uid, { ...pen, loggedBy: currentUser.uid });
      setPenaltyReason(""); setPenaltyForm(false);
    } finally { setActionLoading(false); }
  };

  const progressPct = challenge.duration > 0
    ? Math.min(100, (challenge.currentDay / challenge.duration) * 100)
    : 0;

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-8 space-y-4 max-w-[560px] mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <ChevronLeft size={16} /> Back
      </button>
      <div className="flex flex-col items-center text-center pt-2">
        <Av ini={participant.ini} sz="lg" admin={participant.isAdmin} />
        <div className="flex items-center gap-2 mt-3">
          <p className="font-extrabold text-2xl">{participant.name}</p>
          {participant.isAdmin && (
            <span className="flex items-center gap-1 text-[10px] font-extrabold text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              <Shield size={9} /> organizer
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Joined {participant.joinDate}</p>
        {isAdmin && (() => {
          const c = findCity(participant.tz);
          const now = localNow(participant.tz);
          return (
            <div className="flex items-center gap-1.5 mt-1.5 px-3 py-1.5 bg-muted rounded-xl text-xs">
              <Globe size={11} className="text-muted-foreground" />
              <span className="font-semibold">{c.city}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground font-mono">{utcLabel(participant.tz)}</span>
              <span className="text-muted-foreground">· now</span>
              <span className="font-mono font-bold" style={{ color: BRAND_COLOR }}>{now}</span>
            </div>
          );
        })()}
      </div>

      <Card className="!p-4">
        <div className="flex justify-between items-baseline mb-2.5">
          <SecLabel>Progress</SecLabel>
          <span className="text-xs font-bold" style={{ color: BRAND_COLOR }}>Day {challenge.currentDay} / {challenge.duration}</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: BRAND_COLOR }} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <SecLabel>Challenge score</SecLabel>
          <p style={{ ...bc, fontSize: 32, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{score.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">points</p>
        </Card>
        <Card className="!p-4">
          <SecLabel>Distance run</SecLabel>
          <p style={{ ...bc, fontSize: 32, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{participant.km}</p>
          <p className="text-xs text-muted-foreground mt-1">km</p>
        </Card>
      </div>

      <Card className="!p-4">
        <SecLabel>Lives remaining</SecLabel>
        <div className="flex gap-3 justify-center py-3">
          <Hearts n={participant.lives} sz={28} />
        </div>
        {!participant.active && <p className="text-center text-xs font-bold text-red-500">Eliminated</p>}
      </Card>

      <Card className="!p-4">
        <SecLabel>Penalty history</SecLabel>
        {participant.penalties.length === 0
          ? <p className="text-sm text-muted-foreground mt-3 text-center py-2">Clean record ✓</p>
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
              {isOwner ? "Owner panel" : "Helper panel"}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Card className="!p-4 space-y-3 border-blue-100">
            {isOwner ? (
              <>
                <button onClick={onRemoveLife} disabled={participant.lives === 0 || actionLoading}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-red-100 bg-red-50 disabled:opacity-40 text-left">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0"><Minus size={16} className="text-red-500" /></div>
                  <div><p className="text-sm font-bold text-red-600">Remove a life</p><p className="text-xs text-red-400">Deducts 1 life (owner only)</p></div>
                </button>
                <button onClick={() => setPenaltyForm(v => !v)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-orange-100 bg-orange-50 text-left">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0"><AlertCircle size={16} className="text-orange-500" /></div>
                  <div><p className="text-sm font-bold text-orange-600">Log penalty</p><p className="text-xs text-orange-400">Record a fine manually (owner only)</p></div>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                <Lock size={13} className="text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">Life and penalty adjustments are restricted to challenge owners. You can review submissions using the Review tab.</p>
              </div>
            )}
            {penaltyForm && (
              <div className="space-y-2">
                <input placeholder="Reason…" value={penaltyReason} onChange={e => setPenaltyReason(e.target.value)}
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
                  Confirm
                </button>
              </div>
            )}
            <div>
              <p className="text-sm font-bold mb-2 flex items-center gap-2"><MessageCircle size={14} className="text-blue-400" /> Organizer note</p>
              {orgNoteSaved
                ? <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200"><CheckCircle2 size={13} className="text-green-500" /><span className="text-xs font-semibold text-green-700">Note saved</span></div>
                : <div className="flex gap-2">
                    <textarea placeholder="Private note…" value={orgNote} onChange={e => setOrgNote(e.target.value)} rows={2}
                      className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-xs outline-none resize-none placeholder-muted-foreground" />
                    <button onClick={() => { if (orgNote.trim()) { setOrgNoteSaved(true); setTimeout(() => setOrgNoteSaved(false), 2000); } }}
                      className="self-end pb-0.5" style={{ color: BRAND_COLOR }}><Send size={17} /></button>
                  </div>
              }
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
