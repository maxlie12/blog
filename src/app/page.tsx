import { getAllArticles, getAllProjects } from "@/lib/content";
import { BlogCard } from "@/components/BlogCard";
import { MountainJourney } from "@/components/MountainJourney";
import { SkillCards, LessonPicker } from "@/components/LearningExplorer";
import { DailyGoalWidget } from "@/components/DailyGoalWidget";
import { LessonFilterProvider } from "@/lib/lessonFilter";

export default function Home() {
  const latestArticles = getAllArticles().slice(0, 3);
  const featuredProjects = getAllProjects().filter((p) => p.featured).slice(0, 1);

  return (
    <div className="home-grid">
      <section className="home-grid__blog" aria-label="Recent blog posts">
        <header className="section-page__header section-page__header--compact">
          <h1>Blog</h1>
          <p>Thoughts at the intersection of code, language, and a wider world.</p>
        </header>
        {latestArticles.length === 0 ? (
          <p className="empty-state">
            No articles yet. Add an .mdx file to <code>content/articles/</code>.
          </p>
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
            <MountainJourney />
          </div>
          <SkillCards />
        </section>

        <aside className="home-grid__lessons" aria-label="Lesson picker">
          <LessonPicker />
          <DailyGoalWidget />
        </aside>
      </LessonFilterProvider>
    </div>
  );
}
