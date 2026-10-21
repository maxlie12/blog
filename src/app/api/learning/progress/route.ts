import { HabitProfileAccessError, mergeHabitCompletions, syncRequestSchema } from "@/lib/habitSyncServer";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";

export const runtime = "nodejs";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 2_000_000) {
    return Response.json({ error: "Payload too large" }, { status: 413, headers: NO_STORE });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 2_000_000) {
      return Response.json({ error: "Payload too large" }, { status: 413, headers: NO_STORE });
    }
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid progress data" }, { status: 400, headers: NO_STORE });
  }

  try {
    const userId = await getAuthenticatedLearnerId();
    const result = await mergeHabitCompletions(parsed.data.token, parsed.data.completions, userId);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof HabitProfileAccessError) {
      return Response.json({ error: error.message }, { status: 403, headers: NO_STORE });
    }
    console.error("Habit progress sync failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Sync unavailable" }, { status: 503, headers: NO_STORE });
  }
}
