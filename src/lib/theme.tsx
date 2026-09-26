"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";
export type AccentId = "ivory" | "teal" | "deep-teal" | "amber";

const THEME_KEY = "site-theme";
const ACCENT_KEY = "site-accent";

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readAccent(): AccentId {
  try {
    const stored = window.localStorage.getItem(ACCENT_KEY);
    if (stored === "ivory" || stored === "teal" || stored === "deep-teal" || stored === "amber") {
      return stored;
    }
  } catch {
    // ignore
  }
  return "amber";
}

function getModeSnapshot(): ThemeMode {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function getAccentSnapshot(): AccentId {
  return (document.documentElement.getAttribute("data-accent") as AccentId) || "amber";
}

function getServerModeSnapshot(): ThemeMode {
  return "light";
}

function getServerAccentSnapshot(): AccentId {
  return "amber";
}

function setMode(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
  try {
    window.localStorage.setItem(THEME_KEY, mode);
  } catch {
    // localStorage unavailable (private browsing, etc.) — theme just won't persist
  }
  notify();
}

function setAccent(accent: AccentId) {
  document.documentElement.setAttribute("data-accent", accent);
  try {
    window.localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    // ignore
  }
  notify();
}

// Runs once, on the client, before React needs a value — same read the inline
// no-flash script in layout.tsx already performed against the DOM attributes.
if (typeof document !== "undefined" && !document.documentElement.hasAttribute("data-theme")) {
  document.documentElement.setAttribute("data-theme", readMode());
  document.documentElement.setAttribute("data-accent", readAccent());
}

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentId;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, getModeSnapshot, getServerModeSnapshot);
  const accent = useSyncExternalStore(subscribe, getAccentSnapshot, getServerAccentSnapshot);

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
