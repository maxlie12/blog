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
    <article>
      {article.sample && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          This is a sample article — see <code>content/articles/{article.slug}.mdx</code>.
        </div>
      )}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{article.title}</h1>
        <p className="mt-2 text-xs text-neutral-500">
          {article.date} · {article.readingMinutes} min read · {article.areas.join(", ")}
        </p>
      </header>
      <Mdx source={article.content} />

      {relatedProjects.length > 0 && (
        <aside className="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="mb-2 text-sm font-semibold text-neutral-500">Related projects</h2>
          <ul className="flex flex-wrap gap-2">
            {relatedProjects.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/projects/${p.slug}`}
                  className="rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
                >
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
