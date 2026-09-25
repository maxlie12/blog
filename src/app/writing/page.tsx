import type { Metadata } from "next";
import Link from "next/link";
import { getAllArticles } from "@/lib/content";

export const metadata: Metadata = { title: "Writing" };

export default function WritingPage() {
  const articles = getAllArticles();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Writing</h1>
      {articles.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No articles yet. Add an .mdx file to <code>content/articles/</code>.
        </p>
      ) : (
        <ul className="space-y-6">
          {articles.map((a) => (
            <li key={a.slug} className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
              <Link href={`/writing/${a.slug}`} className="group block">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium group-hover:underline">{a.title}</h2>
                  {a.sample && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      sample
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{a.summary}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {a.date} · {a.readingMinutes} min read · {a.areas.join(", ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
