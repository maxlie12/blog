/**
 * Bài mới mỗi ngày của Phòng nghe: mỗi file `content/listening-lab/YYYY-MM-DD.json` là một bài cùng
 * khuôn với 18 bài cố định (từ vựng → nghe → đọc → viết → nói). ChatGPT thêm file theo
 * `docs/DAILY-LEARNING.md`; file sai khuôn làm build và `npm test` thất bại, nên không lên web.
 * Chỉ dùng ở server (đọc file); phần dùng chung cho client nằm ở `listeningLab.ts`.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { DailyLabSummary, LabLesson } from "./listeningLab.ts";

const text = (max: number) => z.string().trim().min(1).max(max);
const line = z.strictObject({ s: text(40).optional(), t: text(240) });
const choice = z.strictObject({ q: text(240), a: z.array(text(160)).length(4), c: z.number().int().min(0).max(3), why: text(400) });

export const dailyLabSchema = z.strictObject({
  date: z.iso.date(),
  id: z.string().regex(/^d-\d{4}-\d{2}-\d{2}$/),
  level: z.enum(["easy", "medium", "hard"]),
  title: text(90),
  titleVi: text(90),
  minutes: z.number().int().min(5).max(25),
  intro: text(300),
  vocab: z.array(z.strictObject({ w: text(40), pos: text(12), vi: text(120), ex: text(200) })).min(4).max(8),
  transcript: z.array(line).min(6).max(16),
  listening: z.array(choice).min(3).max(5),
  reading: z.array(choice).min(2).max(4),
  dictation: z.array(z.number().int().min(0)).length(2),
  speaking: z.array(z.number().int().min(0)).min(2).max(3),
  write: z.strictObject({ prompt: text(300), model: text(600) }),
}).superRefine((lesson, ctx) => {
  if (lesson.id !== `d-${lesson.date}`) ctx.addIssue({ code: "custom", path: ["id"], message: `id must be d-${lesson.date}` });
  for (const key of ["dictation", "speaking"] as const) {
    lesson[key].forEach((index, i) => {
      if (index >= lesson.transcript.length) ctx.addIssue({ code: "custom", path: [key, i], message: `line ${index} is outside the transcript` });
    });
  }
  for (const key of ["listening", "reading"] as const) {
    lesson[key].forEach((item, i) => {
      if (new Set(item.a.map((answer) => answer.toLowerCase())).size !== 4) ctx.addIssue({ code: "custom", path: [key, i, "a"], message: "the four options must differ" });
    });
  }
});

export type DailyLabLesson = LabLesson & { date: string };

export function parseDailyLabLesson(raw: unknown, file: string): DailyLabLesson {
  const lesson = dailyLabSchema.parse(raw);
  if (file !== `${lesson.date}.json`) throw new Error(`Listening lab file name must be ${lesson.date}.json, got ${file}`);
  return lesson;
}

const DIRECTORY = path.join(process.cwd(), "content/listening-lab");

/** Mọi bài theo ngày, mới nhất trước. */
export async function getDailyLabLessons(directory = DIRECTORY): Promise<DailyLabLesson[]> {
  let files: string[];
  try {
    files = (await readdir(directory)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
  } catch {
    return [];
  }
  const lessons = await Promise.all(files.map(async (file) => parseDailyLabLesson(JSON.parse(await readFile(path.join(directory, file), "utf8")), file)));
  return lessons.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getDailyLabLesson(id: string): Promise<DailyLabLesson | null> {
  return (await getDailyLabLessons()).find((lesson) => lesson.id === id) ?? null;
}

/** Phần nhẹ gửi xuống trình duyệt: 30 bài gần nhất (kể cả bài đã soạn trước cho ngày mai). */
export function dailySummaries(lessons: DailyLabLesson[], limit = 30): DailyLabSummary[] {
  return lessons.slice(0, limit).map(({ id, date, title, titleVi, level, minutes }) => ({ id, date, title, titleVi, level, minutes }));
}
