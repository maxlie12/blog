import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticles, getArticleBySlug, getProjectBySlug } from "@/lib/content";
import { Mdx } from "@/lib/mdx";

export function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  return { title: article?.title ?? "Article" };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const relatedProjects = (article.relatedProjects ?? [])
    .map((s) => getProjectBySlug(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <article className="article-page">
      {article.sample && <div className="sample-banner">This is a sample article — see <code>content/articles/{article.slug}.mdx</code>.</div>}
      <header className="article-page__header">
        <h1>{article.title}</h1>
        <p className="article-page__meta">
          {article.date} · {article.readingMinutes} min read · {article.areas.join(", ")}
        </p>
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
