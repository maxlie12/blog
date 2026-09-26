import Link from "next/link";
import type { Article } from "@/lib/content";

const CATEGORY_LABEL: Record<string, string> = {
  dev: "ENGINEERING",
  work: "PROJECTS",
  learning: "LANGUAGE",
  life: "LIFE",
};

export function BlogCard({ article }: { article: Article }) {
  const category = CATEGORY_LABEL[article.areas[0]] ?? article.areas[0]?.toUpperCase();

  return (
    <Link href={`/blog/${article.slug}`} className="blog-card">
      <div className="blog-card__thumb" aria-hidden="true" data-area={article.areas[0]} />
      <div className="blog-card__body">
        <div className="blog-card__meta">
          <span className="blog-card__category">{category}</span>
          <span className="blog-card__date">{article.date}</span>
        </div>
        <h3 className="blog-card__title">
          {article.title}
          {article.sample && <span className="tag tag--sample">sample</span>}
        </h3>
        <p className="blog-card__excerpt">{article.summary}</p>
        <p className="blog-card__footer">
          <span>Read more →</span>
          <span className="blog-card__time">
            <span aria-hidden="true">◷</span> {article.readingMinutes} min read
          </span>
        </p>
      </div>
    </Link>
  );
}
