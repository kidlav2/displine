import { useState } from "react";
import { CalendarDays, Award, Sliders, UserCheck, Users, ChevronRight, XCircle, Activity, CheckSquare, LayoutGrid, Copy, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, bc } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";

export function ManageScreen() {
  const { challenge, userRole } = useAppContext();
  const navigate = useNavigate();

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [achForm, setAchForm] = useState({ icon: "⭐", name: "", condition: "" });
  const [showCreateAch, setShowCreateAch] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const copyCode = () => {
    navigator.clipboard?.writeText(challenge.inviteCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const ownerItems = userRole === "owner" ? [
    { icon: <Sliders size={20} />,   label: "Challenge settings", sub: "Days, penalties, lives, deadline", action: () => navigate("/app/settings") },
    { icon: <UserCheck size={20} />, label: "Manage participants", sub: "Adjust lives, log penalties",      action: () => navigate("/app/participants") },
    { icon: <Users size={20} />,     label: "Team",                sub: `${challenge.team.length} member${challenge.team.length !== 1 ? "s" : ""} · invite helpers`, action: () => navigate("/app/team") },
  ] : [];

  const menuItems = [
    { icon: <CalendarDays size={20} />, label: "Create task",        sub: "Schedule a new daily mission",  action: () => setShowCreateTask(true) },
    { icon: <Award size={20} />,        label: "Create achievement",  sub: "Add a new badge or milestone",  action: () => setShowCreateAch(true) },
    ...ownerItems,
  ];

  if (showCreateAch) return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 space-y-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => setShowCreateAch(false)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          ← Back
        </button>
        <p className="font-extrabold text-lg">Create achievement</p>
      </div>
      <Card className="!p-4 space-y-3">
        <div>
          <SecLabel>Icon</SecLabel>
          <div className="flex gap-2 mt-2 flex-wrap">
            {["⭐", "🔥", "🏆", "💪", "🎯", "🌟", "⚡", "🦁"].map(ico => (
              <button key={ico} onClick={() => setAchForm(f => ({ ...f, icon: ico }))}
                className={`text-2xl w-12 h-12 rounded-xl border-2 ${achForm.icon === ico ? "border-orange-400 bg-orange-50" : "border-border bg-muted"}`}>{ico}</button>
            ))}
          </div>
        </div>
        <div>
          <SecLabel>Name</SecLabel>
          <input placeholder="e.g. Comeback King" value={achForm.name} onChange={e => setAchForm(f => ({ ...f, name: e.target.value }))}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none" />
        </div>
        <div>
          <SecLabel>Unlock condition</SecLabel>
          <textarea placeholder="e.g. Complete 3 tasks in a row after losing a life" value={achForm.condition} onChange={e => setAchForm(f => ({ ...f, condition: e.target.value }))} rows={3}
            className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
        </div>
        <button onClick={() => setShowCreateAch(false)} disabled={!achForm.name.trim()}
          className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-35" style={{ background: BRAND_COLOR }}>
          Create achievement
        </button>
      </Card>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 pt-5 lg:pt-8 pb-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <p className="font-extrabold text-xl">Manage</p>
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
          userRole === "owner"
            ? "bg-purple-50 text-purple-600 border-purple-200"
            : "bg-blue-50 text-blue-600 border-blue-200"
        }`}>
          {userRole === "owner" ? "Owner" : "Helper"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{challenge.emoji} {challenge.name}</p>

      <Card className="!p-4 mb-4 border-blue-100 bg-blue-50">
        <SecLabel>Invite code</SecLabel>
        <div className="flex items-center justify-between mt-2">
          <p style={{ ...bc, fontSize: 24, fontWeight: 900 }}>{challenge.inviteCode}</p>
          <button onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-200 bg-white text-blue-600">
            {copiedCode ? <CheckCircle2 size={12} /> : <Copy size={12} />}
            {copiedCode ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-blue-500 mt-1 font-semibold">Share this code so participants can join</p>
      </Card>

      <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-2 lg:space-y-0">
        {menuItems.map(m => (
          <button key={m.label} onClick={m.action} className="w-full text-left">
            <Card className="!p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0" style={{ color: BRAND_COLOR }}>{m.icon}</div>
              <div className="flex-1 min-w-0"><p className="font-bold text-sm">{m.label}</p><p className="text-xs text-muted-foreground">{m.sub}</p></div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </Card>
          </button>
        ))}
      </div>

      {showCreateTask && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/30 rounded-[44px] overflow-hidden">
          <div className="bg-card rounded-t-3xl px-5 pt-5 pb-8">
            <div className="flex items-center justify-between mb-4">
              <p className="font-extrabold text-lg">Create task</p>
              <button onClick={() => setShowCreateTask(false)} className="w-8 h-8 rounded-xl border border-border flex items-center justify-center">
                <XCircle size={16} className="text-muted-foreground" />
              </button>
            </div>
            {[
              { type: "running",   Icon: Activity,     label: "Running",   desc: "Check-in + distance proof" },
              { type: "checklist", Icon: CheckSquare,  label: "Checklist", desc: "Step-by-step verification" },
              { type: "freeform",  Icon: LayoutGrid,   label: "Freeform",  desc: "Any photo or text proof" },
            ].map(t => (
              <button key={t.type} onClick={() => setShowCreateTask(false)} className="w-full p-4 rounded-2xl border border-border text-left flex items-center gap-3 bg-card mb-2">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0" style={{ color: BRAND_COLOR }}><t.Icon size={18} /></div>
                <div><p className="font-bold text-sm">{t.label}</p><p className="text-xs text-muted-foreground">{t.desc}</p></div>
                <ChevronRight size={16} className="text-muted-foreground ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
