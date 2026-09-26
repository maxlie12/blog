import Link from "next/link";
import type { Metadata } from "next";
import { getStudioPosts } from "@/lib/posts";
import { getAllLessons, getSkillProgress, getRecentAttempts, SKILLS } from "@/lib/lessonsData";
import { getJourneyCheckpoints } from "@/lib/journeyData";

export const metadata: Metadata = { title: "Overview · Studio" };
export const dynamic = "force-dynamic";

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default async function StudioOverviewPage() {
  const [posts, lessons, progress, recentAttempts, checkpoints] = await Promise.all([
    getStudioPosts(),
    getAllLessons(),
    getSkillProgress(),
    getRecentAttempts(5),
    getJourneyCheckpoints(),
  ]);

  const drafts = posts.filter((p) => p.status === "draft").length;
  const published = posts.filter((p) => p.status === "published").length;
  const attemptsToday = recentAttempts.filter((a) => isToday(a.createdAt)).length;
  const currentCheckpoint = checkpoints.find((c) => c.isCurrent);

  return (
    <div className="studio-page">
      <header className="studio-page__header">
        <div>
          <h1>Overview</h1>
          <p>Your private workspace at a glance.</p>
        </div>
      </header>

      <div className="studio-stats">
        <Link href="/studio/posts" className="stat-tile">
          <p className="stat-tile__value">{published}</p>
          <p className="stat-tile__label">Published posts</p>
        </Link>
        <Link href="/studio/posts" className="stat-tile">
          <p className="stat-tile__value">{drafts}</p>
          <p className="stat-tile__label">Draft posts</p>
        </Link>
        <Link href="/studio/learning" className="stat-tile">
          <p className="stat-tile__value">{lessons.length}</p>
          <p className="stat-tile__label">Lessons</p>
        </Link>
        <div className="stat-tile">
          <p className="stat-tile__value">{attemptsToday}</p>
          <p className="stat-tile__label">Attempts logged today</p>
        </div>
      </div>

      <div className="skill-cards skill-cards--studio">
        {SKILLS.map((skill) => {
          const { completed, total } = progress[skill.id];
          return (
            <Link href="/studio/learning" key={skill.id} className="skill-card">
              <span className="skill-card__body">
                <span className="skill-card__title-row">
                  <span className="skill-card__title">{skill.label}</span>
                  <span className="skill-card__count">
                    {completed}/{total}
                  </span>
                </span>
                <span className="skill-card__progress" aria-hidden="true">
                  <span
                    className="skill-card__progress-fill"
                    style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
                  />
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {currentCheckpoint && (
        <div className="studio-journey-note">
          <span className="tag tag--level">{currentCheckpoint.label}</span>
          Current mountain-journey checkpoint: {currentCheckpoint.title}.{" "}
          <Link href="/studio/journey">Manage journey →</Link>
        </div>
      )}

      <div className="studio-quicklinks">
        <Link href="/studio/posts/new" className="button button--primary">
          + New blog post
        </Link>
        <Link href="/studio/learning/lessons/new" className="button button--ghost">
          + New lesson
        </Link>
      </div>
    </div>
  );
}
