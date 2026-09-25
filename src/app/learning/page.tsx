import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { computeStreaks } from "@/lib/streak";

export const metadata: Metadata = { title: "Learning" };
export const dynamic = "force-dynamic";

export default async function LearningPage() {
  let allDates: { date: string }[] = [];
  let publicEntries: Awaited<ReturnType<typeof prisma.learningLog.findMany>> = [];
  let dbError: string | null = null;

  try {
    [allDates, publicEntries] = await Promise.all([
      prisma.learningLog.findMany({ select: { date: true } }),
      prisma.learningLog.findMany({
        where: { isPublic: true },
        orderBy: { date: "desc" },
        take: 30,
      }),
    ]);
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Unknown database error";
  }

  if (dbError) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Learning</h1>
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <p className="font-medium">Learning log database is not set up.</p>
          <p className="mt-1">
            Run <code>npx prisma migrate dev</code> (see <code>docs/OPERATIONS.md</code>) to create
            it locally, or check <code>DATABASE_URL</code> in production.
          </p>
        </div>
      </div>
    );
  }

  const { current, longest } = computeStreaks(allDates.map((d) => d.date));
  const areaLabels: Record<string, string> = {
    english: "English",
    chinese: "Chinese",
    dev: "Dev",
    other: "Other",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Learning</h1>
        <p className="mt-2 max-w-xl text-neutral-600 dark:text-neutral-400">
          A streak here counts a day of practice — English, Chinese, or building something — not
          a public post. Entries marked private still count toward the streak; only their date and
          area are ever implied, not their content.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-3xl font-bold">{current}</p>
          <p className="text-sm text-neutral-500">Current streak (days)</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-3xl font-bold">{longest}</p>
          <p className="text-sm text-neutral-500">Longest streak (days)</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent public entries</h2>
        {publicEntries.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No public entries yet. Add one with <code>npm run log</code> (see{" "}
            <code>docs/OPERATIONS.md</code>).
          </p>
        ) : (
          <ul className="space-y-3">
            {publicEntries.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span>{e.date}</span>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
                    {areaLabels[e.area] ?? e.area}
                  </span>
                  {e.minutes != null && <span>{e.minutes} min</span>}
                </div>
                <p className="mt-1">{e.activity}</p>
                {e.note && (
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">{e.note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
