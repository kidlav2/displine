import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, ALL_DAYS, bc } from "../constants/design";
import { SCORE } from "../constants/scoring";
import { useAuthContext } from "../contexts/AuthContext";
import { createChallenge } from "../lib/firestore";

const EMOJIS = ["🔥", "❄️", "🍂", "💪", "🧘", "📚", "🏃", "⚡", "🎯", "🌟"];

export function CreateChallengeScreen() {
  const { currentUser, userProfile } = useAuthContext();
  const navigate = useNavigate();

  const [step, setStep] = useState<"form" | "done">("form");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🔥");
  const [desc, setDesc] = useState("");
  const [startDate, setStartDate] = useState("Jul 1, 2026");
  const [duration, setDuration] = useState("50");
  const [runDays, setRunDays] = useState(["Tue", "Thu", "Sat", "Sun"]);
  const [penaltyAmount, setPenaltyAmount] = useState("5000");
  const [currency, setCurrency] = useState("₸");
  const [burpees, setBurpees] = useState("20");
  const [startingLives, setStartingLives] = useState(5);
  const [runDeadline, setRunDeadline] = useState("06:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: string) => setRunDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  const submit = async () => {
    if (!name.trim() || !currentUser || !userProfile || loading) return;
    setLoading(true);
    setError(null);
    try {
      const inviteCode = `${name.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await createChallenge(
        currentUser.uid,
        { name: userProfile.name, ini: userProfile.ini, timezone: userProfile.timezone },
        {
          name: name.trim(), emoji, description: desc.trim(),
          startDate, duration: parseInt(duration) || 50, currentDay: 0,
          status: "upcoming", inviteCode,
          settings: {
            runDays, penaltyAmount: parseInt(penaltyAmount) || 5000,
            currency, burpees: parseInt(burpees) || 20,
            startingLives, runDeadline,
          },
        }
      );
      setStep("done");
    } catch {
      setError("Failed to create challenge. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
      <p className="text-5xl">{emoji}</p>
      <p className="font-extrabold text-2xl">{name}</p>
      <p className="text-sm text-muted-foreground">Challenge created! Participants can join with the invite code.</p>
      <button onClick={() => navigate("/challenges")} className="mt-4 px-8 py-3 rounded-xl font-extrabold text-sm text-white" style={{ background: BRAND_COLOR }}>Done</button>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-8 space-y-4 max-w-[600px] mx-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ChevronLeft size={16} /> Back
        </button>
        <p className="font-extrabold text-lg">Create challenge</p>
      </div>

      <Card className="!p-4 space-y-3">
        <div>
          <SecLabel>Emoji</SecLabel>
          <div className="flex gap-2 mt-2 flex-wrap">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                className={`text-2xl w-11 h-11 rounded-xl border-2 ${emoji === e ? "border-orange-400 bg-orange-50" : "border-border bg-muted"}`}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <SecLabel>Challenge name</SecLabel>
          <input placeholder="e.g. Summer Discipline" value={name} onChange={e => setName(e.target.value)}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" />
        </div>
        <div>
          <SecLabel>Description</SecLabel>
          <textarea placeholder="What's this challenge about?" value={desc} onChange={e => setDesc(e.target.value)} rows={2}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
        </div>
      </Card>

      <Card className="!p-4 space-y-3">
        <p className="font-bold text-sm">Schedule</p>
        <div>
          <SecLabel>Start date</SecLabel>
          <input value={startDate} onChange={e => setStartDate(e.target.value)}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" />
        </div>
        <div>
          <SecLabel>Duration (days)</SecLabel>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" />
        </div>
        <div>
          <SecLabel>Running days</SecLabel>
          <div className="flex gap-2 flex-wrap mt-2">
            {ALL_DAYS.map(d => (
              <button key={d} onClick={() => toggleDay(d)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-colors"
                style={runDays.includes(d) ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)", color: "#8C8C9A" }}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <SecLabel>Run deadline</SecLabel>
          <input value={runDeadline} onChange={e => setRunDeadline(e.target.value)}
            className="w-28 mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm font-extrabold outline-none text-center"
            style={{ ...bc, fontSize: 18 }} />
        </div>
      </Card>

      <Card className="!p-4 space-y-3">
        <p className="font-bold text-sm">Penalties &amp; lives</p>
        <div>
          <SecLabel>Financial penalty</SecLabel>
          <div className="flex gap-2 mt-1.5">
            <div className="flex gap-1 bg-muted rounded-xl p-0.5">
              {["₸", "$", "€"].map(cur => (
                <button key={cur} onClick={() => setCurrency(cur)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold"
                  style={currency === cur ? { background: "#fff", color: "#1A1A1A" } : { color: "#8C8C9A" }}>{cur}</button>
              ))}
            </div>
            <input type="number" value={penaltyAmount} onChange={e => setPenaltyAmount(e.target.value)}
              className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
          </div>
        </div>
        <div>
          <SecLabel>Burpee alternative</SecLabel>
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" value={burpees} onChange={e => setBurpees(e.target.value)}
              className="w-24 bg-muted rounded-xl px-3 py-2 text-sm font-semibold outline-none text-center" />
            <span className="text-sm text-muted-foreground font-semibold">burpees</span>
          </div>
        </div>
        <div>
          <SecLabel>Starting lives</SecLabel>
          <div className="flex items-center gap-4 mt-2">
            <button onClick={() => setStartingLives(v => Math.max(1, v - 1))}
              className="w-9 h-9 rounded-xl border-2 border-border flex items-center justify-center font-bold text-lg">−</button>
            <Hearts n={startingLives} sz={22} />
            <button onClick={() => setStartingLives(v => Math.min(5, v + 1))}
              className="w-9 h-9 rounded-xl border-2 border-border flex items-center justify-center font-bold text-lg">+</button>
          </div>
        </div>
      </Card>

      <div className="pb-2">
        <p className="text-[10px] text-muted-foreground mb-3 font-semibold px-1">
          Scoring: run on time = {SCORE.running_on_time} pts · run late = {SCORE.running_late} pt · daily task = {SCORE.task_completed} pts · missed = {SCORE.missed} pts
        </p>
        {error && <p className="text-xs font-bold text-red-500 mb-3">{error}</p>}
        <button onClick={submit} disabled={!name.trim() || loading}
          className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-35"
          style={{ background: BRAND_COLOR }}>
          {loading ? "Creating…" : "Create challenge"}
        </button>
      </div>
    </div>
  );
}
