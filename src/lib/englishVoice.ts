/**
 * Giọng đọc tiếng Anh của máy: người học chọn Anh-Mỹ (en-US) hay Anh-Anh (en-GB). Dùng giọng có sẵn
 * trên thiết bị (không thêm thư viện); máy thiếu giọng đúng accent thì dùng giọng tiếng Anh khác.
 * Lựa chọn lưu theo thiết bị (localStorage), mọi chỗ máy đọc tiếng Anh đều dùng chung.
 */
export type EnglishAccent = "en-US" | "en-GB";
export const ACCENTS: { id: EnglishAccent; label: string }[] = [
  { id: "en-US", label: "Anh-Mỹ" },
  { id: "en-GB", label: "Anh-Anh" },
];
export const ACCENT_KEY = "english-voice-accent-v1";
export const ACCENT_CHANGED = "english-voice-accent-changed";

interface VoiceLike { lang: string; name: string }

const better = /google|natural|premium|enhanced|neural|siri/i;

/** Giọng tiếng Anh xếp theo độ hợp: đúng accent trước (giọng chất lượng cao trước), rồi tiếng Anh khác. */
export function pickVoices<T extends VoiceLike>(voices: T[], accent: EnglishAccent): T[] {
  const lang = (voice: T) => voice.lang.replace("_", "-").toLowerCase();
  const english = voices.filter((voice) => lang(voice).startsWith("en"));
  const rank = (voice: T) => (lang(voice) === accent.toLowerCase() ? 0 : 2) + (better.test(voice.name) ? 0 : 1);
  return [...english].sort((a, b) => rank(a) - rank(b));
}

export function hasAccentVoice(voices: VoiceLike[], accent: EnglishAccent): boolean {
  return voices.some((voice) => voice.lang.replace("_", "-").toLowerCase() === accent.toLowerCase());
}

export function readAccent(): EnglishAccent {
  try {
    return window.localStorage.getItem(ACCENT_KEY) === "en-GB" ? "en-GB" : "en-US";
  } catch {
    return "en-US";
  }
}

export function saveAccent(accent: EnglishAccent) {
  try { window.localStorage.setItem(ACCENT_KEY, accent); } catch { /* chỉ giữ trong trang này */ }
  window.dispatchEvent(new Event(ACCENT_CHANGED));
}
