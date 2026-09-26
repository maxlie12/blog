import { prisma } from "@/lib/db";

export interface CheckpointWithEvidence {
  id: string;
  label: string;
  title: string;
  order: number;
  optional: boolean;
  isCurrent: boolean;
  evidence: { id: string; label: string; note: string | null; createdAt: string }[];
}

export async function getJourneyCheckpoints(): Promise<CheckpointWithEvidence[]> {
  const checkpoints = await prisma.journeyCheckpoint.findMany({
    orderBy: { order: "asc" },
    include: { evidence: { orderBy: { createdAt: "desc" } } },
  });
  return checkpoints.map((c) => ({
    ...c,
    evidence: c.evidence.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
  }));
}

export const journeyDisclaimer =
  "This map shows a self-set learning milestone, updated by hand — it is not a certified CEFR result and isn't calculated from streaks or lesson counts.";
