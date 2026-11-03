import Link from "next/link";
import { getPublicArticles } from "@/lib/posts";
import { getAllLessons } from "@/lib/lessonsData";
import { BlogCard } from "@/components/BlogCard";
import { MountainJourney } from "@/components/MountainJourney";
import { StartLearning } from "@/components/StartLearning";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";
import { getJourneyCheckpoints } from "@/lib/journeyData";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [articles, lessons, checkpoints] = await Promise.all([
    getPublicArticles(),
    getAuthenticatedLearnerId().then((learnerId) => getAllLessons({ learnerId })),
    getJourneyCheckpoints(),
  ]);
  const latestArticles = articles.slice(0, 3);

  return (
    <div className="home-grid">
      <section className="field-intro" aria-label="Welcome to Field Notes">
        <div>
          <p className="eyebrow">A PERSONAL NOTEBOOK · LUÂN</p>
          <h1>Build with purpose.<br /><em>Grow a little every day.</em></h1>
          <p>Notes on code, language, and the things worth learning along the way.</p>
        </div>
        <div className="field-intro__actions">
          <Link href="/learning/world" className="button button--primary">Enter the Learning Farm ↗</Link>
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
        <Link href="/play" className="featured-card">
          <span className="featured-card__label">Nghỉ dưỡng &amp; vui chơi</span>
          <h3>Làng Rêu và Nông trại</h3>
          <p>Xây làng trên đảo bay hoặc chăm nông trại khi cần nghỉ tay. Không tính vào Done.</p>
        </Link>
      </section>

      <section className="home-grid__journey" aria-label="Learning journey">
        <div className="journey-hero">
          <h2>The ascent to C1</h2>
          <p>A long-term journey to clearer expression, deeper understanding, and a more open world.</p>
          <MountainJourney checkpoints={checkpoints} />
        </div>
      </section>

      <aside className="home-grid__lessons" aria-label="Học hôm nay">
        <StartLearning lessons={lessons} />
        <Link href="/learning" className="field-link">Xem tiến độ và kho bài →</Link>
      </aside>
    </div>
  );
}
