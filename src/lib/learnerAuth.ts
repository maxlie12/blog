import type { LearnerProfileId } from "@/lib/learnerProfiles";

export type LearnerAccountLink = {
  learnerProfileId: LearnerProfileId;
  linkedAt: string;
};

export function isLearnerAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  );
}

export async function getAuthenticatedLearnerId(): Promise<string | null> {
  if (!isLearnerAuthConfigured()) return null;
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId;
}
