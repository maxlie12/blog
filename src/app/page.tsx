import Link from "next/link";
import { getAllProjects } from "@/lib/content";
import { getPublicArticles } from "@/lib/posts";
import { getAllLessons } from "@/lib/lessonsData";
import { BlogCard } from "@/components/BlogCard";
import { MountainJourney } from "@/components/MountainJourney";
import { SkillCards, LessonPicker } from "@/components/LearningExplorer";
import { LessonFilterProvider } from "@/lib/lessonFilter";
import { getJourneyCheckpoints } from "@/lib/journeyData";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [articles, lessons, checkpoints] = await Promise.all([
    getPublicArticles(),
    getAllLessons(),
    getJourneyCheckpoints(),
  ]);
  const latestArticles = articles.slice(0, 3);
  const featuredProjects = getAllProjects().filter((p) => p.featured).slice(0, 1);

  return (
    <div className="home-grid">
      <section className="field-intro" aria-label="Welcome to Field Notes">
        <div>
          <p className="eyebrow">A PERSONAL NOTEBOOK · LUÂN</p>
          <h1>Build with purpose.<br /><em>Grow a little every day.</em></h1>
          <p>Notes on code, language, and the things worth learning along the way.</p>
        </div>
        <div className="field-intro__actions">
          <Link href="/learning/session" className="button button--primary">Start a 5-minute session ↗</Link>
          <Link href="/blog" className="field-link">Explore the journal →</Link>
        </div>
      </section>
      <section className="home-grid__blog" aria-label="Recent blog posts">
        <header className="section-page__header section-page__header--compact">
          <p className="eyebrow">THE JOURNAL</p>
          <h2>Recent field notes</h2>
          <p>Thoughts at the intersection of code, language, and a wider world.</p>
        </header>
        {latestArticles.length === 0 ? (
          <p className="empty-state">No published posts yet.</p>
        ) : (
          <div className="home-grid__blog-list">
            {latestArticles.map((a) => (
              <BlogCard key={a.slug} article={a} />
            ))}
          </div>
        )}
        {featuredProjects.map((p) => (
          <a key={p.slug} href={`/projects/${p.slug}`} className="featured-project-card">
            <span className="featured-project-card__label">Featured project</span>
            <h3>{p.title}</h3>
            <p>{p.summary}</p>
          </a>
        ))}
      </section>

      <LessonFilterProvider>
        <section className="home-grid__journey" aria-label="Learning journey">
          <div className="journey-hero">
            <h2>The ascent to C1</h2>
            <p>A long-term journey to clearer expression, deeper understanding, and a more open world.</p>
            <MountainJourney checkpoints={checkpoints} />
          </div>
          <SkillCards lessons={lessons} />
        </section>

        <aside className="home-grid__lessons" aria-label="Lesson picker">
          <LessonPicker lessons={lessons} compact />
        </aside>
      </LessonFilterProvider>
    </div>
  );
}
