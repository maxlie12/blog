import type { Metadata } from "next";
import { getPublicArticles } from "@/lib/posts";
import { BlogCard } from "@/components/BlogCard";

export const metadata: Metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const articles = await getPublicArticles();

  return (
    <div className="section-page">
      <header className="section-page__header">
        <h1>Blog</h1>
        <p>Thoughts at the intersection of code, language, and a wider world.</p>
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
