import type { Metadata } from "next";
import { getPublicArticles } from "@/lib/posts";
import { BlogCard } from "@/components/BlogCard";

export const metadata: Metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const articles = await getPublicArticles();

  return (
    <div className="section-page journal-page">
      <header className="section-page__header journal-header">
        <p className="eyebrow">THE JOURNAL / FIELD NOTES</p>
        <h1>Ideas, explored.<br /><em>Lessons, collected.</em></h1>
        <p>Thoughts at the intersection of code, language, and a wider world.</p>
        <span className="journal-header__count">{articles.length} {articles.length === 1 ? "story" : "stories"} to explore · Take your time.</span>
      </header>
      {articles.length === 0 ? (
        <p className="empty-state">No published posts yet.</p>
      ) : (
        <div className="blog-grid">
          {articles.map((a) => (
            <BlogCard key={a.slug} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
