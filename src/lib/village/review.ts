/**
 * Daily review for Làng Rêu. Every word the learner has met — pieces unlocked with a lesson and
 * words found with the Look tool — comes back after 1, 3, 7 and 14 days (the site's review rhythm),
 * then once a month. A wrong answer starts the word again from one day. Pure, tested in Node.
 *
 * This is practice for the game's own vocabulary; it is not a lesson review and never counts
 * toward Done, the rhythm or a level.
 */
import { REVIEW_INTERVALS } from "../reviewSchedule.ts";
import { CATEGORIES, TOOL, WORDS, type VillageProgress, type WordId } from "./data.ts";
import { PARTS, RESIDENTS, VERBS, type PartId, type ResidentId, type VerbId } from "./vocab.ts";

export const DAY = 86_400_000;
/** Most questions in one sitting. */
export const SESSION = 10;
export interface ReviewState { due: number; step: number }
export interface ReviewItem { key: string; en: string; ipa: string; vi: string; group: string; groupLabel: string }

/** Local midnight at or before `ms`, so a word is due for the whole day, not from a clock time. */
export function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Days until the next review after `step` correct answers in a row (1, 3, 7, 14, then 30). */
export const intervalDays = (step: number) => REVIEW_INTERVALS[step] ?? 30;

/** The schedule after one answer. */
export function nextReview(prev: ReviewState | undefined, right: boolean, now: number): ReviewState {
  const step = right ? (prev?.step ?? 0) + 1 : 0;
  return { due: startOfDay(now) + intervalDays(step) * DAY, step };
}

/** A review key's word, or null for a key this version does not know. */
export function itemOf(key: string): ReviewItem | null {
  const [kind, id] = key.split(":");
  if (kind === "word" && id in WORDS) {
    const word = id as WordId, cat = TOOL[word].cat ?? "build";
    return { key, en: word, ipa: WORDS[word].ipa, vi: WORDS[word].vi, group: `word:${cat}`, groupLabel: CATEGORIES.find((c) => c.id === cat)?.label ?? "" };
  }
  if (kind === "verb" && id in VERBS) return { key, ...entry(VERBS[id as VerbId]), group: "verb", groupLabel: "Động từ" };
  if (kind === "part" && id in PARTS) return { key, ...entry(PARTS[id as PartId]), group: "part", groupLabel: "Bộ phận" };
  if (kind === "noun" && id in RESIDENTS) return { key, ...entry(RESIDENTS[id as ResidentId]), group: "noun", groupLabel: "Dân làng" };
  return null;
}
const entry = (e: { en: string; ipa: string; vi: string }) => ({ en: e.en, ipa: e.ipa, vi: e.vi });
export const isReviewKey = (key: string) => itemOf(key) !== null;

/** Each word the learner has met and when: lessons (not the starter tools) and Look finds. */
export function metKeys(progress: Pick<VillageProgress, "learned" | "seen">): [string, number][] {
  const out: [string, number][] = [];
  for (const [word, info] of Object.entries(progress.learned)) out.push([`word:${word}`, info.at]);
  for (const [key, at] of Object.entries(progress.seen)) out.push([key, at]);
  return out.filter(([key]) => isReviewKey(key));
}

/** A met word's schedule: saved, or due the day after it was met. */
export const stateOf = (progress: Pick<VillageProgress, "review">, key: string, met: number): ReviewState =>
  progress.review[key] ?? { due: startOfDay(met) + DAY, step: 0 };

/** Words due today, the longest-waiting first, at most one session. */
export function dueItems(progress: Pick<VillageProgress, "learned" | "seen" | "review">, now: number, limit = SESSION): ReviewItem[] {
  return metKeys(progress)
    .map(([key, met]) => ({ key, due: stateOf(progress, key, met).due }))
    .filter((e) => e.due <= now)
    .sort((a, b) => a.due - b.due || a.key.localeCompare(b.key))
    .slice(0, limit)
    .map((e) => itemOf(e.key) as ReviewItem);
}

/** Four choices for a question: the answer and three words from the same group. */
export function choicesFor(item: ReviewItem, random: () => number = Math.random): ReviewItem[] {
  const pool: string[] = item.group.startsWith("word:")
    ? (Object.keys(WORDS) as WordId[]).filter((w) => `word:${TOOL[w].cat}` === item.group).map((w) => `word:${w}`)
    : Object.keys(item.group === "verb" ? VERBS : item.group === "part" ? PARTS : RESIDENTS).map((id) => `${item.group}:${id}`);
  const others = pool.filter((key) => key !== item.key && itemOf(key)?.vi !== item.vi);
  const picked: ReviewItem[] = [];
  while (picked.length < 3 && others.length) picked.push(itemOf(others.splice(Math.floor(random() * others.length), 1)[0]) as ReviewItem);
  const all = [item, ...picked];
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}
