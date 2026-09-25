import Link from "next/link";
import { getAllArticles, getAllProjects } from "@/lib/content";

export default function Home() {
  const latestArticles = getAllArticles().slice(0, 3);
  const featuredProjects = getAllProjects().filter((p) => p.featured).slice(0, 3);

  return (
    <div className="space-y-14">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Max Lie</h1>
        <p className="mt-3 max-w-xl text-neutral-600 dark:text-neutral-400">
          This is a public record of what I&apos;m building, what I&apos;m learning, and what I
          try and get wrong along the way. It covers software projects, English and Chinese
          practice, and interview preparation.
        </p>
        <div className="mt-5 flex gap-3 text-sm">
          <Link
            href="/about"
            className="rounded-md bg-neutral-900 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            About me
          </Link>
          <Link
            href="/projects"
            className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700"
          >
            See projects
          </Link>
        </div>
      </section>

      {featuredProjects.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Featured projects</h2>
            <Link href="/projects" className="text-sm text-neutral-500 hover:underline">
              All projects →
            </Link>
          </div>
          <ul className="space-y-4">
            {featuredProjects.map((p) => (
              <li key={p.slug}>
                <Link href={`/projects/${p.slug}`} className="group block">
                  <h3 className="font-medium group-hover:underline">
                    {p.title}
                    {p.sample && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        sample
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{p.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Latest writing</h2>
          <Link href="/writing" className="text-sm text-neutral-500 hover:underline">
            All articles →
          </Link>
        </div>
        {latestArticles.length === 0 ? (
          <p className="text-sm text-neutral-500">No articles published yet.</p>
        ) : (
          <ul className="space-y-4">
            {latestArticles.map((a) => (
              <li key={a.slug}>
                <Link href={`/writing/${a.slug}`} className="group block">
                  <h3 className="font-medium group-hover:underline">
                    {a.title}
                    {a.sample && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        sample
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{a.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
