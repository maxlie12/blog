import type { Metadata } from "next";
import Link from "next/link";
import { getAllProjects } from "@/lib/content";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  const projects = getAllProjects();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Projects</h1>
      {projects.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No projects yet. Add an .mdx file to <code>content/projects/</code>.
        </p>
      ) : (
        <ul className="space-y-6">
          {projects.map((p) => (
            <li key={p.slug} className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
              <Link href={`/projects/${p.slug}`} className="group block">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium group-hover:underline">{p.title}</h2>
                  {p.sample && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      sample
                    </span>
                  )}
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {p.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{p.summary}</p>
                <p className="mt-2 text-xs text-neutral-500">{p.tech.join(" · ")}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
