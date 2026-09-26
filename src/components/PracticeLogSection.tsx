import { prisma } from "@/lib/db";
import { computeStreaks } from "@/lib/streak";

const AREA_LABELS: Record<string, string> = {
  english: "English",
  chinese: "Chinese",
  dev: "Dev",
  other: "Other",
};

export async function PracticeLogSection() {
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
      <section className="practice-log">
        <h2>Practice log (tracked)</h2>
        <div className="error-banner">
          <p>
            <strong>Learning log database is not set up.</strong>
          </p>
          <p>
            Run <code>npx prisma migrate dev</code> (see <code>docs/OPERATIONS.md</code>) to
            create it locally, or check <code>DATABASE_URL</code> in production.
          </p>
        </div>
      </section>
    );
  }

  const { current, longest } = computeStreaks(allDates.map((d) => d.date));

  return (
    <section className="practice-log">
      <div className="practice-log__intro">
        <h2>Practice log (tracked)</h2>
        <p>
          This section is real, recorded practice data — separate from the lesson exercises
          above. A streak counts a day of practice, not a public post; private entries still
          count toward the streak but their content is never shown here.
        </p>
      </div>

      <div className="practice-log__stats">
        <div className="stat-tile">
          <p className="stat-tile__value">{current}</p>
          <p className="stat-tile__label">Current streak (days)</p>
        </div>
        <div className="stat-tile">
          <p className="stat-tile__value">{longest}</p>
          <p className="stat-tile__label">Longest streak (days)</p>
        </div>
      </div>

      <div>
        <h3>Recent public entries</h3>
        {publicEntries.length === 0 ? (
          <p className="empty-state">
            No public entries yet. Add one with <code>npm run log</code> (see{" "}
            <code>docs/OPERATIONS.md</code>).
          </p>
        ) : (
          <ul className="practice-log__list">
            {publicEntries.map((e) => (
              <li key={e.id}>
                <div className="practice-log__entry-meta">
                  <span>{e.date}</span>
                  <span className="tag">{AREA_LABELS[e.area] ?? e.area}</span>
                  {e.minutes != null && <span>{e.minutes} min</span>}
                </div>
                <p className="practice-log__entry-activity">{e.activity}</p>
                {e.note && <p className="practice-log__entry-note">{e.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
