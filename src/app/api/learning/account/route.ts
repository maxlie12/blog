import { z } from "zod";
import { getAuthenticatedLearnerId, isLearnerAuthConfigured } from "@/lib/learnerAuth";
import {
  claimHabitProfile,
  getHabitAccountLink,
  HabitProfileConflictError,
} from "@/lib/habitSyncServer";

export const runtime = "nodejs";
const NO_STORE = { "cache-control": "no-store" };
const claimSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  learnerProfileId: z.enum(["luan", "phi"]),
});

async function currentUserId() {
  if (!isLearnerAuthConfigured()) return null;
  return getAuthenticatedLearnerId();
}

export async function GET(): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  try {
    const link = await getHabitAccountLink(userId);
    return Response.json({ link }, { headers: NO_STORE });
  } catch (error) {
    console.error("Learner account lookup failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Account lookup unavailable" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: Request): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const parsed = claimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid profile claim" }, { status: 400, headers: NO_STORE });

  try {
    const link = await claimHabitProfile(userId, parsed.data.token, parsed.data.learnerProfileId);
    return Response.json({ link }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof HabitProfileConflictError) {
      return Response.json({ error: error.message }, { status: 409, headers: NO_STORE });
    }
    console.error("Learner profile claim failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Không thể liên kết lúc này." }, { status: 503, headers: NO_STORE });
  }
}
