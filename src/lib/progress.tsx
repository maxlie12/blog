"use client";

/**
 * Lesson-completion tracking is browser-local only (localStorage), not backed by any server.
 * It resets per browser/device and is not proof of ability — see docs/DECISIONS.md. A synced,
 * verified version would need real backend storage; that's future work, not this prototype.
 */
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

const PROGRESS_KEY = "learning-progress";

interface ProgressEntry {
  completedAt: string; // ISO timestamp
}

type ProgressMap = Record<string, ProgressEntry>;

const listeners = new Set<() => void>();
let cache: ProgressMap = {};

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readFromStorage(): ProgressMap {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

function getSnapshot(): ProgressMap {
  return cache;
}

const EMPTY_PROGRESS: ProgressMap = {};

function getServerSnapshot(): ProgressMap {
  return EMPTY_PROGRESS;
}

function persist(next: ProgressMap) {
  cache = next;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  notify();
}

if (typeof window !== "undefined") {
  cache = readFromStorage();
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

interface ProgressContextValue {
  completed: ProgressMap;
  isComplete: (lessonId: string) => boolean;
  markComplete: (lessonId: string) => void;
  markIncomplete: (lessonId: string) => void;
  completedToday: number;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const completed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function markComplete(lessonId: string) {
    persist({ ...completed, [lessonId]: { completedAt: new Date().toISOString() } });
  }

  function markIncomplete(lessonId: string) {
    const next = { ...completed };
    delete next[lessonId];
    persist(next);
  }

  const completedToday = Object.values(completed).filter((e) => isToday(e.completedAt)).length;

  return (
    <ProgressContext.Provider
      value={{
        completed,
        isComplete: (id) => Boolean(completed[id]),
        markComplete,
        markIncomplete,
        completedToday,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}
