/**
 * Giọng đọc tiếng Anh của máy: người học chọn Anh-Mỹ (en-US) hay Anh-Anh (en-GB), và có thể chọn
 * hẳn một giọng. Dùng giọng có sẵn trên thiết bị (không thêm thư viện).
 *
 * Vì sao cần xếp hạng: iPhone/Mac trả về cả chục giọng "vui" rất máy (Albert, Bad News, Bahh, Zarvox…)
 * và các giọng Eloquence (Eddy, Flo, Grandma…) cùng mã en-US/en-GB. Lấy giọng đầu danh sách là dễ
 * trúng chúng. Thứ tự ưu tiên: giọng người học đã chọn → Premium/Natural/Neural → Enhanced/Google/
 * Online → giọng thường quen thuộc (Samantha, Daniel…) → giọng khác. Giọng "vui" bị loại hẳn.
 */
export type EnglishAccent = "en-US" | "en-GB";
export const ACCENTS: { id: EnglishAccent; label: string }[] = [
  { id: "en-US", label: "Anh-Mỹ" },
  { id: "en-GB", label: "Anh-Anh" },
];
export const ACCENT_KEY = "english-voice-accent-v1";
const VOICE_KEY = "english-voice-name-v1";
export const ACCENT_CHANGED = "english-voice-accent-changed";

interface VoiceLike { lang: string; name: string; voiceURI?: string }

const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|deranged|hysterical|pipe organ)\b/i;
// Tên giọng có thể theo ngôn ngữ máy: iPhone tiếng Việt ghi "Cao cấp" / "Nâng cao".
const TOP = /premium|natural|neural|cao cấp/i;
const GOOD = /enhanced|google|online|siri|nâng cao/i;
const FAMILIAR = /^(samantha|ava|zoe|evan|nathan|allison|susan|tom|alex|aaron|nicky|joelle|noelle|daniel|kate|serena|jamie|oliver|stephanie|arthur|martha|sonia|ryan|libby|aria|jenny|guy)\b/i;

const langOf = (voice: VoiceLike) => voice.lang.replace("_", "-").toLowerCase();

/** 0 tốt nhất … 3 kém nhất; giọng "vui" là -1 (loại). */
export function voiceQuality(voice: VoiceLike): number {
  const uri = voice.voiceURI ?? "";
  if (NOVELTY.test(voice.name) || /eloquence/i.test(uri)) return -1;
  if (TOP.test(voice.name) || /\.premium\./i.test(uri)) return 0;
  if (GOOD.test(voice.name) || /\.enhanced\./i.test(uri)) return 1;
  if (FAMILIAR.test(voice.name)) return 2;
  return 3;
}

export function qualityLabel(voice: VoiceLike): string {
  const quality = voiceQuality(voice);
  return quality === 0 ? "chất lượng cao" : quality === 1 ? "khá" : "cơ bản";
}

/** Giọng tiếng Anh dùng được, xếp theo độ hợp: giọng đã chọn → đúng accent → chất lượng. */
export function pickVoices<T extends VoiceLike>(voices: T[], accent: EnglishAccent, preferred?: string | null): T[] {
  const usable = voices.filter((voice) => langOf(voice).startsWith("en") && voiceQuality(voice) >= 0);
  const rank = (voice: T) => (voice.name === preferred ? -10 : 0) + (langOf(voice) === accent.toLowerCase() ? 0 : 10) + voiceQuality(voice);
  return [...usable].sort((a, b) => rank(a) - rank(b));
}

/** Giọng của đúng accent (không gồm giọng "vui"), tốt nhất trước — để người học chọn. */
export function accentVoices<T extends VoiceLike>(voices: T[], accent: EnglishAccent): T[] {
  return pickVoices(voices, accent).filter((voice) => langOf(voice) === accent.toLowerCase());
}

export function hasAccentVoice(voices: VoiceLike[], accent: EnglishAccent): boolean {
  return accentVoices(voices, accent).length > 0;
}

/** Máy chỉ có giọng cơ bản cho accent này → gợi ý tải giọng Enhanced/Premium. */
export function onlyBasicVoices(voices: VoiceLike[], accent: EnglishAccent): boolean {
  const list = accentVoices(voices, accent);
  return list.length > 0 && list.every((voice) => voiceQuality(voice) >= 2);
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

/** Giọng người học đã chọn cho từng accent (tên giọng), lưu theo thiết bị. */
export function readVoiceName(accent: EnglishAccent): string | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(VOICE_KEY) ?? "{}") as Record<string, unknown>;
    return typeof saved[accent] === "string" ? (saved[accent] as string) : null;
  } catch {
    return null;
  }
}

export function saveVoiceName(accent: EnglishAccent, name: string | null) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(VOICE_KEY) ?? "{}") as Record<string, unknown>;
    if (name) saved[accent] = name; else delete saved[accent];
    window.localStorage.setItem(VOICE_KEY, JSON.stringify(saved));
  } catch { /* chỉ giữ trong trang này */ }
  window.dispatchEvent(new Event(ACCENT_CHANGED));
}
