import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const lessonSchema = z.object({
  id: z.string().regex(/^daily-[a-z0-9-]+$/),
  skill: z.enum(["listening", "reading", "speaking", "writing"]),
  language: z.enum(["en", "zh"]),
  title: z.string().min(1), level: z.string().min(1),
  instructions: z.string().min(1), material: z.string().nullable(),
  exercises: z.string().min(1), completionCriteria: z.string().min(1),
});
const packetSchema = z.object({
  date: z.iso.date(), title: z.string().min(1),
  kind: z.enum(["restart", "practice", "weekly-test", "monthly-test"]),
  note: z.string(), lessons: z.array(lessonSchema).min(1),
});
export type DailyPacket = z.infer<typeof packetSchema>;

export async function getDailyPackets(): Promise<DailyPacket[]> {
  const directory = path.join(process.cwd(), "content/daily-lessons");
  const files = (await readdir(directory)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  const packets = await Promise.all(files.map(async (file) => {
    const packet = packetSchema.parse(JSON.parse(await readFile(path.join(directory, file), "utf8")));
    if (file !== `${packet.date}.json`) throw new Error(`Daily lesson date mismatch: ${file}`);
    return packet;
  }));
  const ids = packets.flatMap((p) => p.lessons.map((l) => l.id));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate daily lesson ID");
  return packets;
}

export async function getDailyLesson(id: string) {
  return (await getDailyPackets()).flatMap((p) => p.lessons).find((l) => l.id === id);
}
