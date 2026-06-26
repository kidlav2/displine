import { useState } from "react";
import { useNavigate } from "react-router";
import {
  signInWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, type AuthError,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { SecLabel } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";
import type { UserRole } from "../types";

function authErrMsg(err: AuthError): string {
  switch (err.code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Invalid email or password.";
    case "auth/too-many-requests":  return "Too many attempts. Try again later.";
    case "auth/popup-closed-by-user": return "Sign-in popup was closed. Try again.";
    default: return "Sign-in failed. Try again.";
  }
}

export function OrgLoginScreen() {
  const { setUserRole, setSelectedId } = useAppContext();
  const navigate = useNavigate();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // DEV-only: pick which role to simulate when logging in with the test account.
  // In production, the role comes from userProfile.challengeRoles in Firestore.
  const [demoRole, setDemoRole] = useState<"owner" | "helper">("owner");

  const handleSuccess = (role: UserRole) => {
    if (import.meta.env.DEV) {
      setUserRole(role);
    }
    setSelectedId(null);
    navigate("/challenges");
  };

  const emailLogin = async () => {
    if (!email.trim() || !password || loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      handleSuccess(demoRole);
    } catch (err) {
      setError(authErrMsg(err as AuthError));
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      handleSuccess(demoRole);
    } catch (err) {
      setError(authErrMsg(err as AuthError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full px-6 pt-10 pb-8">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4" style={{ background: "#FFF3F0" }}>🔥</div>
        <h1 className="font-extrabold text-2xl leading-tight mb-1">Organizer access</h1>
        <p className="text-sm text-muted-foreground max-w-[260px] leading-snug">
          Sign in to manage your challenge. Participants join via invite link — this form is for organizers only.
        </p>
      </div>

      <div className="flex-1 space-y-3">
        <button
          onClick={googleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-border bg-card font-semibold text-sm disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-semibold">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div>
          <SecLabel>Email</SecLabel>
          <input type="email" placeholder="you@example.com" value={email}
            onChange={e => { setEmail(e.target.value); setError(null); }}
            className="w-full mt-1.5 px-4 py-3.5 bg-card border border-border rounded-xl text-sm font-semibold outline-none placeholder-muted-foreground" />
        </div>
        <div>
          <SecLabel>Password</SecLabel>
          <input type="password" placeholder="••••••••" value={password}
            onChange={e => { setPassword(e.target.value); setError(null); }}
            onKeyDown={e => e.key === "Enter" && emailLogin()}
            className="w-full mt-1.5 px-4 py-3.5 bg-card border border-border rounded-xl text-sm font-semibold outline-none placeholder-muted-foreground" />
        </div>

        {error && (
          <p className="text-xs font-bold text-red-500">{error}</p>
        )}

        {/* Demo role picker — DEV only */}
        {import.meta.env.DEV && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-[10px] font-extrabold tracking-widest uppercase text-amber-600 mb-2">Demo: sign in as</p>
            <div className="flex gap-2">
              {(["owner", "helper"] as const).map(r => (
                <button key={r} onClick={() => setDemoRole(r)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border-2 capitalize transition-colors"
                  style={demoRole === r ? { background: BRAND_COLOR, color: "#fff", borderColor: BRAND_COLOR } : { borderColor: "var(--border)" }}>
                  {r === "owner" ? "Owner (full access)" : "Helper (review only)"}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={emailLogin} disabled={!email.trim() || !password || loading}
          className="w-full py-4 rounded-xl font-extrabold text-sm text-white disabled:opacity-35"
          style={{ background: BRAND_COLOR }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-xs text-muted-foreground leading-snug pt-2">
          No account? You must be invited by an existing challenge owner.
          <br />Contact your challenge owner to get access.
        </p>
      </div>
    </div>
  );
}
