"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { createCozyMusic, MUSIC_DEFAULTS, MUSIC_KEY, parseMusicSettings, type CozyMusic, type MusicSettings, type MusicTheme } from "./cozyMusic";

/* One setting for both games, kept in this browser. */
let cached: MusicSettings | null = null;
const listeners = new Set<() => void>();

function current(): MusicSettings {
  if (!cached) {
    try {
      cached = parseMusicSettings(window.localStorage.getItem(MUSIC_KEY));
    } catch {
      cached = MUSIC_DEFAULTS;
    }
  }
  return cached;
}

function store(next: MusicSettings) {
  cached = next;
  try {
    window.localStorage.setItem(MUSIC_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the choice lasts for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Background music for a game. It plays while the setting is on, the tab is visible and at least
 * a fifth of `root` is on screen. Browsers only allow sound after a tap or key press, so the first
 * one on the page starts it. A control marked `data-music-toggle` does not count as that tap.
 */
export function useCozyMusic(theme: MusicTheme, root: RefObject<HTMLElement | null>, calm = false) {
  const settings = useSyncExternalStore(subscribe, current, () => MUSIC_DEFAULTS);
  const musicRef = useRef<CozyMusic | null>(null);
  const onScreen = useRef(true);
  const calmRef = useRef(calm);

  const apply = useCallback(() => {
    const wanted = current().on && onScreen.current && !document.hidden;
    if (!musicRef.current) {
      if (!wanted) return;
      musicRef.current = createCozyMusic(theme, current().volume, calmRef.current);
    }
    musicRef.current?.setPlaying(wanted);
  }, [theme]);

  useEffect(() => {
    const onGesture = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-music-toggle]")) return;
      if (current().on && !musicRef.current?.isRunning()) apply();
    };
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);
    document.addEventListener("visibilitychange", apply);
    const element = root.current;
    const observer = element
      ? new IntersectionObserver(([entry]) => {
          onScreen.current = entry.isIntersecting;
          apply();
        }, { threshold: 0.2 })
      : null;
    if (element) observer?.observe(element);
    // Starts straight away when the page has already had a tap (e.g. the farm's entry button).
    apply();
    return () => {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      document.removeEventListener("visibilitychange", apply);
      observer?.disconnect();
      musicRef.current?.dispose();
      musicRef.current = null;
    };
  }, [apply, root]);

  useEffect(() => {
    calmRef.current = calm;
    musicRef.current?.setCalm(calm);
  }, [calm]);

  const toggle = useCallback(() => {
    store({ ...current(), on: !current().on });
    apply();
  }, [apply]);

  const setVolume = useCallback((volume: number) => {
    store({ ...current(), volume });
    musicRef.current?.setVolume(volume);
  }, []);

  return { on: settings.on, volume: settings.volume, toggle, setVolume };
}
