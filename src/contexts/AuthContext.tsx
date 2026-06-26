import { createContext, useContext, useEffect, useState } from "react";
import type React from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { UserProfile } from "../types";

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  authLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser]   = useState<User | null>(null);
  const [userProfile, setUserProfile]   = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading]   = useState(true);

  useEffect(() => {
    // Subscribe to Firebase Auth state
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setUserProfile(null);
        setAuthLoading(false);
      } else {
        // Keep authLoading true until the Firestore profile snapshot resolves,
        // even if this is a mid-session sign-in (e.g. after signInWithCustomToken).
        setAuthLoading(true);
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    // Subscribe to the user's Firestore profile document (users/{uid})
    const unsubProfile = onSnapshot(
      doc(db, "users", currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile({ uid: currentUser.uid, ...snap.data() } as UserProfile);
        } else {
          // New user — profile hasn't been created yet (happens during onboarding)
          setUserProfile(null);
        }
        setAuthLoading(false);
      },
      (err) => {
        console.error("[AuthContext] Failed to load user profile:", err);
        setAuthLoading(false);
      }
    );
    return unsubProfile;
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
