import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { Av, Hearts, Card, SecLabel } from "../components/atoms";
import { calcScore } from "../lib/scoring";
import { useAppContext } from "../contexts/AppContext";
import { setParticipantLives } from "../lib/firestore";

export function ManageParticipantsScreen() {
  const { challenge, scoring } = useAppContext();
  const navigate = useNavigate();

  const adjustLives = async (uid: string, current: number, delta: number) => {
    const next = Math.max(0, Math.min(5, current + delta));
    await setParticipantLives(challenge.id, uid, next);
  };

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-4 max-w-[720px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ChevronLeft size={16} /> Назад
        </button>
        <p className="font-extrabold text-lg">Управление участниками</p>
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-2 lg:space-y-0">
        {challenge.participants.map(p => (
          <Card key={p.uid} className="!p-3.5">
            <div className="flex items-center gap-3 mb-3">
              <Av ini={p.ini} sz="sm" admin={p.isAdmin} />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold">{p.name}</p>
                  {p.isAdmin && <span className="text-[9px] font-extrabold text-blue-500">ORG</span>}
                </div>
                <p className="text-xs text-muted-foreground">{calcScore(p.results, scoring)} оч.</p>
              </div>
              <Hearts n={p.lives} sz={13} />
            </div>
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
          </Card>
        ))}
      </div>
    </div>
  );
}
