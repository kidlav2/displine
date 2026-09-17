import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

// Keep the key, default and colors in sync with the inline script in index.html.
const STORAGE_KEY = "displine.theme";
const DEFAULT_PREFERENCE: ThemePreference = "dark";
const THEME_COLOR = { light: "#FAF9F7", dark: "#100F0E" } as const;

const listeners = new Set<(pref: ThemePreference) => void>();

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch { /* storage unavailable */ }
  return DEFAULT_PREFERENCE;
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
}

export function setThemePreference(pref: ThemePreference) {
  try { localStorage.setItem(STORAGE_KEY, pref); } catch { /* storage unavailable */ }
  applyTheme(pref);
  listeners.forEach(fn => fn(pref));
}

export function useThemePreference(): [ThemePreference, (pref: ThemePreference) => void] {
  const [pref, setPref] = useState<ThemePreference>(getThemePreference);

  useEffect(() => {
    listeners.add(setPref);
    return () => { listeners.delete(setPref); };
  }, []);

  // Follow OS changes while the preference is "system".
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  return [pref, setThemePreference];
}
