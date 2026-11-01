"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function speak(text: string) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en-us"));
  const voice = voices.find((item) => /google|natural/i.test(item.name)) ?? voices[0];
  if (voice) utterance.voice = voice;
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  synth.speak(utterance);
}

/** Reads English aloud with the device's own voice; hidden where the browser has no speech synthesis. */
export function PronounceButton({ text, label }: { text: string; label?: string }) {
  const supported = useSyncExternalStore(subscribe, () => "speechSynthesis" in window, () => false);
  if (!supported) return null;
  return (
    <button type="button" className={label ? "pronounce pronounce--labelled" : "pronounce"} aria-label={label ?? `Nghe: ${text}`} onClick={() => speak(text)}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
      {label}
    </button>
  );
}
