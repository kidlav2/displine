import { useState } from "react";
import { Globe, Instagram, Link, CheckCircle2 } from "lucide-react";
import { Av, Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, bc } from "../constants/design";
import { TimezoneSettings } from "../components/atoms";
import { calcScore } from "../lib/scoring";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { writeUserProfile } from "../lib/firestore";

export function ProfileScreen() {
  const { challenge, meParticipant, adminTz, adminTzAuto, setAdminTz, setAdminTzAuto, scoring } = useAppContext();
  const { currentUser, userProfile } = useAuthContext();

  const [bio, setBio]               = useState(userProfile?.bio ?? "");
  const [instagram, setInstagram]   = useState(userProfile?.socialLinks?.instagram ?? "");
  const [otherLink, setOtherLink]   = useState(userProfile?.socialLinks?.other ?? "");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  const saveBio = async () => {
    if (!currentUser || saving) return;
    setSaving(true);
    try {
      await writeUserProfile(currentUser.uid, {
        ...(userProfile ?? { name: "", ini: "", timezone: "UTC", challengeRoles: {} }),
        bio: bio.trim() || undefined,
        socialLinks: (instagram.trim() || otherLink.trim())
          ? { instagram: instagram.trim() || undefined, other: otherLink.trim() || undefined }
          : undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const results = meParticipant?.results ?? [];
  const myScore = calcScore(results, scoring);
  const pct = Math.round((challenge.currentDay / challenge.duration) * 100);

  return (
    <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-5 lg:pt-8 space-y-4 pb-6">
      <div className="flex flex-col items-center text-center pt-2">
        <Av ini={meParticipant?.ini ?? "?"} sz="lg" accent />
        <p className="font-extrabold text-2xl mt-3">{meParticipant?.name ?? "—"}</p>
        <p className="text-sm text-muted-foreground">{challenge.emoji} {challenge.name}</p>
      </div>

      <Card className="!p-4">
        <div className="flex justify-between items-baseline mb-2.5">
          <SecLabel>Прогресс</SecLabel>
          <span className="text-xs font-bold" style={{ color: BRAND_COLOR }}>День {challenge.currentDay} / {challenge.duration}</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BRAND_COLOR }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">осталось {challenge.duration - challenge.currentDay} дней</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <SecLabel>Очки в челлендже</SecLabel>
          <p style={{ ...bc, fontSize: 30, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{myScore}</p>
          <p className="text-xs text-muted-foreground mt-1">очков всего</p>
        </Card>
        <Card className="!p-4">
          <SecLabel>Дистанция</SecLabel>
          <p style={{ ...bc, fontSize: 30, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{meParticipant?.km ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">км пробежано</p>
        </Card>
      </div>

      <Card className="!p-4">
        <SecLabel>Оставшиеся жизни</SecLabel>
        <div className="flex gap-3 justify-center py-3">
          <Hearts n={meParticipant?.lives ?? 0} sz={28} />
        </div>
      </Card>

      {/* Bio + social links */}
      <Card className="!p-4 space-y-3">
        <SecLabel>О себе</SecLabel>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Расскажите немного о себе…"
          rows={3}
          maxLength={280}
          className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none resize-none placeholder-muted-foreground"
        />
        <div className="flex items-center gap-2">
          <Instagram size={14} className="text-muted-foreground shrink-0" />
          <input
            value={instagram}
            onChange={e => setInstagram(e.target.value)}
            placeholder="instagram.com/username"
            className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm outline-none placeholder-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link size={14} className="text-muted-foreground shrink-0" />
          <input
            value={otherLink}
            onChange={e => setOtherLink(e.target.value)}
            placeholder="Другая ссылка (сайт, LinkedIn…)"
            className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm outline-none placeholder-muted-foreground"
          />
        </div>
        <button
          onClick={saveBio}
          disabled={saving}
          className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: BRAND_COLOR }}
        >
          {saved ? <><CheckCircle2 size={14} /> Сохранено</> : saving ? "Сохранение…" : "Сохранить профиль"}
        </button>
      </Card>

      <Card className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={15} className="text-muted-foreground" />
          <SecLabel>Часовой пояс</SecLabel>
          {adminTzAuto && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 ml-1">авто</span>
          )}
        </div>
        <TimezoneSettings tz={adminTz} isAuto={adminTzAuto} onChange={tz => { setAdminTz(tz); setAdminTzAuto(false); }} />
        <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
          Используется для отображения вашего местного времени рядом со временем отправки участников в разделе проверки и ленте активности.
        </p>
      </Card>
    </div>
  );
}
