"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_PALETTE, isPaletteId, type PaletteId } from "@/lib/palettes";

export type ThemeMode = "light" | "dark";

const THEME_KEY = "site-theme";
const PALETTE_KEY = "site-palette";

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

function readPalette(): PaletteId {
  try {
    const stored = window.localStorage.getItem(PALETTE_KEY);
    if (isPaletteId(stored)) return stored;
  } catch {
    // ignore
  }
  return DEFAULT_PALETTE;
}

function getModeSnapshot(): ThemeMode {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function getPaletteSnapshot(): PaletteId {
  const value = document.documentElement.getAttribute("data-palette");
  return isPaletteId(value) ? value : DEFAULT_PALETTE;
}

function getServerModeSnapshot(): ThemeMode {
  return "light";
}

function getServerPaletteSnapshot(): PaletteId {
  return DEFAULT_PALETTE;
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

function setPalette(palette: PaletteId) {
  document.documentElement.setAttribute("data-palette", palette);
  try {
    window.localStorage.setItem(PALETTE_KEY, palette);
  } catch {
    // ignore
  }
  notify();
}

// Runs once, on the client, before React needs a value — same read the inline
// no-flash script in layout.tsx already performed against the DOM attributes.
if (typeof document !== "undefined" && !document.documentElement.hasAttribute("data-theme")) {
  document.documentElement.setAttribute("data-theme", readMode());
  document.documentElement.setAttribute("data-palette", readPalette());
}

interface ThemeContextValue {
  mode: ThemeMode;
  palette: PaletteId;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: PaletteId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, getModeSnapshot, getServerModeSnapshot);
  const palette = useSyncExternalStore(subscribe, getPaletteSnapshot, getServerPaletteSnapshot);

  return (
    <ThemeContext.Provider value={{ mode, palette, setMode, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
