import { readProfileStorage, writeProfileStorage } from "./learnerProfiles.ts";
import type { SkillId } from "./lessonTypes.ts";

export interface PathTopic {
  slug: string;
  title: string;
  lessonId?: string;
  words: string[];
}

export type PathStepId = "read" | "words" | "speak" | "lesson";

export interface TodayLesson {
  id: string;
  title: string;
  skill: SkillId;
  language: string;
}

const KNOWN_KEY = "study-words-known-v1";
const MARKS_KEY = "study-path-v1";

function readList(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(readProfileStorage(key) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeList(key: string, value: string[]) {
  try {
    writeProfileStorage(key, JSON.stringify(value));
  } catch {
    // Blocked storage only means the marks last for this visit.
  }
}

export const readKnownWords = () => readList(KNOWN_KEY);
export const writeKnownWords = (words: string[]) => writeList(KNOWN_KEY, words);
export const readPathMarks = () => readList(MARKS_KEY);

export function addPathMark(slug: string, step: "read" | "speak") {
  const mark = `${slug}:${step}`;
  const marks = readPathMarks();
  if (!marks.includes(mark)) writeList(MARKS_KEY, [...marks, mark]);
}

export function pathSteps(
  topic: PathTopic,
  known: readonly string[],
  marks: readonly string[],
  completedLessons: ReadonlySet<string>,
): { id: PathStepId; done: boolean }[] {
  const steps: { id: PathStepId; done: boolean }[] = [
    { id: "read", done: marks.includes(`${topic.slug}:read`) },
    { id: "words", done: topic.words.length > 0 && topic.words.every((word) => known.includes(word)) },
    { id: "speak", done: marks.includes(`${topic.slug}:speak`) },
  ];
  if (topic.lessonId) steps.push({ id: "lesson", done: completedLessons.has(topic.lessonId) });
  return steps;
}

// Packets mark extra work only in the title, e.g. "Tùy chọn 5 phút — …" or "Blog Seed tùy chọn — …".
export function todaySteps(lessons: readonly TodayLesson[], completedLessons: ReadonlySet<string>) {
  return lessons.map((lesson) => ({
    ...lesson,
    optional: /tùy chọn/i.test(lesson.title),
    done: completedLessons.has(lesson.id),
  }));
}
