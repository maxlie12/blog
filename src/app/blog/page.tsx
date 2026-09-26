import type { Metadata } from "next";
import { getAllArticles } from "@/lib/content";
import { BlogCard } from "@/components/BlogCard";

export const metadata: Metadata = { title: "Blog" };

export default function BlogPage() {
  const articles = getAllArticles();

  return (
    <div className="section-page">
      <header className="section-page__header">
        <h1>Blog</h1>
        <p>Thoughts at the intersection of code, language, and a wider world.</p>
      </header>
      {articles.length === 0 ? (
        <p className="empty-state">
          No articles yet. Add an .mdx file to <code>content/articles/</code>.
        </p>
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
