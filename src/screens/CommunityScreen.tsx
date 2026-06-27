import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Av, Hearts, Card, Chip, FeedCard } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { calcScore } from "../lib/scoring";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import {
  toggleLike, addComment,
  subscribeToFeedFirstPage, fetchNextFeedPage, FEED_PAGE_SIZE,
} from "../lib/firestore";
import { checkAchievement } from "../lib/achievements";
import type { CommTab, FeedItem, SortKey } from "../types";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

export function CommunityScreen() {
  const { challenge, isAdmin, isOwner, adminTz, scoring, achievements, meParticipant } = useAppContext();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();

  const [tab, setTab] = useState<CommTab>("feed");
  const [sort, setSort] = useState<SortKey>("score");

  // ── Feed pagination state ────────────────────────────────────────────────────
  // liveItems: real-time first page (onSnapshot, newest-first).
  // olderItems: paginated pages loaded on scroll, appended in order.
  const [liveItems, setLiveItems]   = useState<FeedItem[]>([]);
  const [olderItems, setOlderItems] = useState<FeedItem[]>([]);
  const [hasMore, setHasMore]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedReady, setFeedReady]   = useState(false);

  // The cursor is frozen after the first onSnapshot fires so that pagination
  // always starts from a stable point even as new posts arrive at the top.
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Subscribe to the live first page whenever the challenge changes.
  useEffect(() => {
    if (!challenge?.id) return;
    // Reset feed state when switching challenges.
    setLiveItems([]);
    setOlderItems([]);
    setHasMore(true);
    setFeedReady(false);
    cursorRef.current = null;

    const unsub = subscribeToFeedFirstPage(challenge.id, (items, lastDoc) => {
      setLiveItems(items);
      setFeedReady(true);
      // Fix cursor on first fire; don't move it as new posts trickle in,
      // so that startAfter pagination stays anchored to the original batch.
      if (!cursorRef.current && lastDoc) {
        cursorRef.current = lastDoc;
        // If the first page wasn't full there's nothing more to load.
        setHasMore(items.length >= FEED_PAGE_SIZE);
      }
    });
    return unsub;
  }, [challenge?.id]);

  // Load the next page of older items.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursorRef.current || !challenge?.id) return;
    setLoadingMore(true);
    try {
      const { items, cursor, hasMore: more } = await fetchNextFeedPage(challenge.id, cursorRef.current);
      if (items.length > 0) {
        setOlderItems(prev => {
          // Deduplicate against what's already loaded (shouldn't normally happen).
          const existingIds = new Set(prev.map(i => i.id));
          return [...prev, ...items.filter(i => !existingIds.has(i.id))];
        });
        if (cursor) cursorRef.current = cursor;
      }
      setHasMore(more);
    } catch (err) {
      console.error("[CommunityScreen] fetchNextFeedPage failed:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [challenge?.id, hasMore, loadingMore]);

  // IntersectionObserver: trigger loadMore when sentinel enters the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // Merged feed: live items at top, then older items.
  // Deduplicate in case a live-page update shifts items across the boundary.
  const liveIds = new Set(liveItems.map(i => i.id));
  const allFeedItems: FeedItem[] = [
    ...liveItems,
    ...olderItems.filter(i => !liveIds.has(i.id)),
  ];

  // ── Leaderboard ──────────────────────────────────────────────────────────────
  const sorted = [...challenge.participants].sort((a, b) =>
    sort === "score" ? calcScore(b.results, scoring) - calcScore(a.results, scoring) : b.km - a.km
  );

  const onViewParticipant = (uid: string) => navigate(`/participants/${uid}`);

  const handleLike = async (id: string) => {
    if (!currentUser) return;
    const item = allFeedItems.find(f => f.id === id);
    if (!item) return;
    try {
      await toggleLike(challenge.id, id, currentUser.uid, item.likes.includes(currentUser.uid));
    } catch (err) {
      console.error("[CommunityScreen] toggleLike failed:", err);
    }
  };

  const handleComment = async (id: string, text: string) => {
    if (!currentUser || !meParticipant) return;
    try {
      await addComment(challenge.id, id, { ini: meParticipant.ini, name: meParticipant.name, text });
    } catch (err) {
      console.error("[CommunityScreen] addComment failed:", err);
    }
  };

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 max-w-[720px] mx-auto">
      <h2 className="font-extrabold text-xl mb-4">Сообщество</h2>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {(["feed", "leaderboard", "achievements"] as CommTab[]).map(t => (
          <Chip key={t}
            label={t === "feed" ? "Активность" : t === "leaderboard" ? "Таблица лидеров" : "Достижения"}
            active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>

      {tab === "feed" && (
        <div className="pb-4">
          <p className="text-xs text-muted-foreground font-semibold mb-3">
            Все отправки — одобренные, отклонённые и ожидающие. Полная прозрачность.
          </p>

          {/* Initial loading skeleton */}
          {!feedReady && (
            <div className="flex justify-center py-10">
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {feedReady && allFeedItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Активностей пока нет.
            </p>
          )}

          {feedReady && allFeedItems.length > 0 && (
            <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-3 lg:space-y-0">
              {allFeedItems.map(f => (
                <FeedCard key={f.id} item={f} onLike={handleLike} onComment={handleComment}
                  onViewParticipant={onViewParticipant} participants={challenge.participants}
                  isAdmin={isAdmin} adminTz={adminTz}
                  currentUserId={currentUser?.uid}
                  currentUserIni={meParticipant?.ini ?? "?"} />
              ))}
            </div>
          )}

          {/* Sentinel + states at the bottom of the feed */}
          {feedReady && (
            <div ref={sentinelRef} className="mt-4 flex justify-center py-3">
              {loadingMore && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Загрузка…
                </div>
              )}
              {!loadingMore && !hasMore && allFeedItems.length > 0 && (
                <p className="text-xs text-muted-foreground">Всё загружено ✓</p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "leaderboard" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">{challenge.participants.length} участников</p>
            <div className="flex gap-1 bg-muted rounded-xl p-0.5">
              {(["score", "distance"] as SortKey[]).map(k => (
                <button key={k} onClick={() => setSort(k)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                  style={sort === k ? { background: "#fff", color: "#1A1A1A" } : { color: "#8C8C9A" }}>
                  {k === "score" ? "Очки" : "Дистанция"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 pb-4">
            {sorted.map((p, i) => (
              <div key={p.uid} className="flex items-center gap-3 p-3 rounded-2xl border"
                style={{ background: p.active ? "#fff" : "var(--muted)", borderColor: "var(--border)", opacity: p.active ? 1 : 0.55 }}>
                <span className="text-base w-6 text-center shrink-0">
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>}
                </span>
                <Av ini={p.ini} photoUrl={p.photoUrl} sz="sm" admin={p.isAdmin} onClick={() => onViewParticipant(p.uid)} />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewParticipant(p.uid)}>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold leading-none truncate">{p.name}</p>
                    {p.role === "owner" && <span className="text-[9px] font-extrabold text-purple-500">Орг.</span>}
                    {p.role === "helper" && <span className="text-[9px] font-extrabold text-blue-500">Пом.</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sort === "score" ? `${calcScore(p.results, scoring)} оч.` : `${p.km} км`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Hearts n={p.lives} sz={14} />
                  {!p.active && <span className="text-[10px] font-bold text-red-400">Выбыл</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "achievements" && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
          {achievements.length === 0 && (
            <p className="col-span-2 lg:col-span-3 text-sm text-muted-foreground text-center py-6">
              {isOwner
                ? "Достижения ещё не созданы. Добавьте их в разделе «Управление»."
                : "Достижения ещё не созданы."}
            </p>
          )}
          {achievements.map(a => {
            const unlocked = meParticipant ? checkAchievement(a, meParticipant, challenge) : false;
            return (
              <Card key={a.id} className={`!p-4 ${!unlocked ? "opacity-40" : ""}`}>
                <p className="text-2xl mb-2">{a.icon}</p>
                <p className="font-extrabold text-sm leading-tight mb-1">{a.title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{a.desc}</p>
                {unlocked && (
                  <div className="flex items-center gap-1 mt-2">
                    <CheckCircle2 size={11} style={{ color: BRAND_COLOR }} />
                    <span className="text-[10px] font-bold" style={{ color: BRAND_COLOR }}>Разблокировано</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
