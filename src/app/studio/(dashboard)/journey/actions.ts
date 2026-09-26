"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireStudioSession } from "@/lib/studioSession";

function revalidateJourney() {
  revalidatePath("/");
  revalidatePath("/learning");
  revalidatePath("/studio/journey");
}

export async function createCheckpoint(formData: FormData): Promise<void> {
  await requireStudioSession();
  const label = String(formData.get("label") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const optional = formData.get("optional") === "on";
  if (!label || !title) return;

  const count = await prisma.journeyCheckpoint.count();
  await prisma.journeyCheckpoint.create({
    data: { label, title, order: count, optional, isCurrent: false },
  });
  revalidateJourney();
}

export async function updateCheckpoint(formData: FormData): Promise<void> {
  await requireStudioSession();
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const optional = formData.get("optional") === "on";
  if (!id || !label || !title) return;

  await prisma.journeyCheckpoint.update({ where: { id }, data: { label, title, optional } });
  revalidateJourney();
}

/**
 * Sets exactly one checkpoint as "you are here." This is a deliberate, hand-triggered action —
 * nothing in the codebase ever calls this automatically from lesson/attempt counts. See
 * docs/DECISIONS.md.
 */
export async function setCurrentCheckpoint(id: string): Promise<void> {
  await requireStudioSession();
  await prisma.$transaction([
    prisma.journeyCheckpoint.updateMany({ data: { isCurrent: false }, where: {} }),
    prisma.journeyCheckpoint.update({ where: { id }, data: { isCurrent: true } }),
  ]);
  revalidateJourney();
}

export async function deleteCheckpoint(id: string): Promise<void> {
  await requireStudioSession();
  await prisma.journeyCheckpoint.delete({ where: { id } });
  revalidateJourney();
}

export async function addEvidence(formData: FormData): Promise<void> {
  await requireStudioSession();
  const checkpointId = String(formData.get("checkpointId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!checkpointId || !label) return;

  await prisma.journeyEvidence.create({ data: { checkpointId, label, note } });
  revalidateJourney();
}

export async function deleteEvidence(id: string): Promise<void> {
  await requireStudioSession();
  await prisma.journeyEvidence.delete({ where: { id } });
  revalidateJourney();
}
