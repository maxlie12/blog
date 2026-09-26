import Link from "next/link";
import type { Metadata } from "next";
import { getAllLessons, getSkillProgress, SKILLS } from "@/lib/lessonsData";

export const metadata: Metadata = { title: "Learning · Studio" };
export const dynamic = "force-dynamic";

export default async function StudioLearningPage() {
  const [lessons, progress] = await Promise.all([getAllLessons(), getSkillProgress()]);

  return (
    <div className="studio-page">
      <header className="studio-page__header">
        <div>
          <h1>Learning</h1>
          <p>{lessons.length} lessons across 4 skills.</p>
        </div>
        <Link href="/studio/learning/lessons/new" className="button button--primary">
          + New lesson
        </Link>
      </header>

      <div className="skill-cards skill-cards--studio">
        {SKILLS.map((skill) => {
          const { completed, total } = progress[skill.id];
          return (
            <div key={skill.id} className="skill-card">
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
            </div>
          );
        })}
      </div>

      {lessons.length === 0 ? (
        <p className="empty-state">No lessons yet. Create your first one.</p>
      ) : (
        <table className="studio-table">
          <thead>
            <tr>
              <th>Lesson</th>
              <th>Skill</th>
              <th>Level</th>
              <th>Attempts</th>
              <th>Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => (
              <tr key={lesson.id}>
                <td>
                  <Link href={`/studio/learning/lessons/${lesson.id}`}>{lesson.title}</Link>
                </td>
                <td>{SKILLS.find((s) => s.id === lesson.skill)?.label}</td>
                <td>{lesson.level}</td>
                <td>{lesson.attemptCount}</td>
                <td>{lesson.reviewedCount > 0 ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
