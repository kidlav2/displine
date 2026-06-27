import { useState } from "react";
import {
  Heart, Camera, CheckCircle2, XCircle, Activity, CheckSquare, Flame,
  MessageCircle, Send, MapPin,
} from "lucide-react";
import { Av } from "./Av";
import { Card } from "./Card";
import { ScorePill } from "./ScorePill";
import { StatusBadge } from "./StatusBadge";
import { BRAND_COLOR } from "../../constants/design";
import type { FeedItem, Participant } from "../../types";

interface FeedCardProps {
  item: FeedItem;
  onLike: (id: string) => void;
  onComment: (id: string, text: string) => void;
  onViewParticipant: (uid: string) => void;
  participants: Participant[];
  isAdmin: boolean;
  adminTz: string;
  currentUserId?: string;
  currentUserIni?: string;
}

export function FeedCard({ item, onLike, onComment, onViewParticipant, participants, isAdmin: _isAdmin, adminTz: _adminTz, currentUserId, currentUserIni }: FeedCardProps) {
  const liked = currentUserId ? item.likes.includes(currentUserId) : false;
  const [inputOpen, setInputOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const MAX = 60;
  const p = participants.find(x => x.uid === item.participantId);

  const typeIcon: Record<string, React.ReactNode> = {
    running:    <Activity size={12} className="text-blue-400 shrink-0" />,
    checklist:  <CheckSquare size={12} className="text-green-500 shrink-0" />,
    streak:     <Flame size={12} style={{ color: BRAND_COLOR }} className="shrink-0" />,
    eliminated: <XCircle size={12} className="text-gray-400 shrink-0" />,
    joined:     <CheckCircle2 size={12} className="text-purple-400 shrink-0" />,
  };

  const send = () => {
    if (!draft.trim()) return;
    onComment(item.id, draft.trim());
    setDraft(""); setInputOpen(false);
  };

  const hasPhoto = item.type === "running" || item.type === "checklist";

  return (
    <Card className="overflow-hidden">
      <div className="px-3.5 pt-3.5 pb-2.5 flex items-start gap-2.5">
        <Av ini={item.ini} photoUrl={p?.photoUrl} sz="sm" admin={item.isAdmin} onClick={() => p && onViewParticipant(p.uid)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {typeIcon[item.type]}
            <button className="font-bold text-sm hover:underline leading-none" onClick={() => p && onViewParticipant(p.uid)}>
              {item.name}
            </button>
            {item.isAdmin && <span className="text-[9px] font-extrabold text-blue-500">ORG</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.text}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {item.submissionStatus && <StatusBadge status={item.submissionStatus} />}
          <p className="text-[10px] text-muted-foreground">{item.time}</p>
        </div>
      </div>

      {hasPhoto && (
        item.photoUrl ? (
          <div className="mx-3.5 rounded-xl overflow-hidden bg-gray-100" style={{ height: 180 }}>
            <img src={item.photoUrl} alt="Proof photo" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="mx-3.5 rounded-xl bg-muted flex items-center justify-center" style={{ height: 120 }}>
            <Camera size={24} className="text-muted-foreground" />
          </div>
        )
      )}

      {hasPhoto && (
        <div className="px-3.5 pt-2 space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            {item.km && (
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                <MapPin size={11} /> {item.km} km
              </span>
            )}
            {item.isLate && <span className="text-xs font-bold text-orange-400">Опоздание</span>}
            <ScorePill scoreKey={item.submissionStatus === "approved"
              ? (item.type === "running" ? (item.isLate ? "running_late" : "running_on_time") : "task_completed")
              : null} />
          </div>
        </div>
      )}

      {item.submissionStatus === "rejected" && item.organizerComment && (
        <div className="mx-3.5 mt-2 px-3 py-2 bg-red-50 rounded-xl border border-red-100">
          <p className="text-[10px] font-extrabold tracking-wider uppercase text-red-400 mb-0.5">Проверка организатора</p>
          <p className="text-xs text-red-600 leading-snug">{item.organizerComment}</p>
        </div>
      )}

      <div className="px-3.5 py-2.5 flex items-center gap-4 border-t border-border mt-2">
        <button onClick={() => onLike(item.id)} className="flex items-center gap-1.5 transition-transform active:scale-90">
          <Heart size={16} className={liked ? "fill-red-500 text-red-500" : "text-muted-foreground"} />
          <span className={`text-xs font-bold ${liked ? "text-red-500" : "text-muted-foreground"}`}>{item.likes.length}</span>
        </button>
        <button onClick={() => setInputOpen(v => !v)} className="flex items-center gap-1.5">
          <MessageCircle size={16} className="text-muted-foreground" />
          <span className="text-xs font-bold text-muted-foreground">{item.socialComments.length}</span>
        </button>
      </div>

      {item.socialComments.length > 0 && (
        <div className="px-3.5 pb-2 space-y-1.5">
          {item.socialComments.slice(0, 2).map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <Av ini={c.ini} sz="xs" />
              <p className="text-xs leading-snug"><span className="font-bold">{c.name}</span>{" "}<span className="text-muted-foreground">{c.text}</span></p>
            </div>
          ))}
          {item.socialComments.length > 2 && (
            <p className="text-xs font-bold text-muted-foreground pl-8">показать все {item.socialComments.length} комментариев</p>
          )}
        </div>
      )}

      {inputOpen && (
        <div className="px-3.5 pb-3 flex items-center gap-2 border-t border-border pt-2.5">
          <Av ini={currentUserIni ?? "?"} sz="xs" accent />
          <input
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, MAX))}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Добавить комментарий…"
            className="flex-1 text-xs bg-muted rounded-xl px-3 py-1.5 outline-none placeholder-muted-foreground"
          />
          <button onClick={send} disabled={!draft.trim()} className="disabled:opacity-30" style={{ color: BRAND_COLOR }}>
            <Send size={15} />
          </button>
        </div>
      )}
    </Card>
  );
}
