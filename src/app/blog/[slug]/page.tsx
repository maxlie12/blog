import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicArticleBySlug } from "@/lib/posts";
import { getProjectBySlug } from "@/lib/content";
import { Mdx } from "@/lib/mdx";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug);
  return { title: article?.title ?? "Article" };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug);
  if (!article) notFound();

  const relatedProjects = (article.relatedProjects ?? [])
    .map((s) => getProjectBySlug(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <article className="article-page">
      {article.sample && (
        <div className="sample-banner">
          This is a sample article — see <code>content/articles/{article.slug}.mdx</code>.
        </div>
      )}
      <header className="article-page__header">
        {article.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.coverImage} alt="" className="article-page__cover" />
        )}
        <h1>{article.title}</h1>
        <p className="article-page__meta">
          {article.date} · {article.readingMinutes} min read · {article.areas.join(", ")}
        </p>
        {article.tags && article.tags.length > 0 && (
          <ul className="article-page__tags">
            {article.tags.map((t) => (
              <li key={t} className="tag">
                {t}
              </li>
            ))}
          </ul>
        )}
        {article.relatedLearning && (
          <p className="article-page__learning-note">
            <Link href="/learning">↗ Linked to learning</Link> — this post connects to practice
            on the Learning page.
          </p>
        )}
      </header>
      <Mdx source={article.content} />

      {relatedProjects.length > 0 && (
        <aside className="article-page__related">
          <h2>Related projects</h2>
          <ul>
            {relatedProjects.map((p) => (
              <li key={p.slug}>
                <Link href={`/projects/${p.slug}`} className="pill">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}
