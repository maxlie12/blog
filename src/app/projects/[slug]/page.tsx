import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllProjects, getProjectBySlug } from "@/lib/content";
import { Mdx } from "@/lib/mdx";

export function generateStaticParams() {
  return getAllProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  return { title: project?.title ?? "Project" };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  return (
    <article>
      {project.sample && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          This is placeholder content — see <code>content/projects/{project.slug}.mdx</code>.
        </div>
      )}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">{project.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
            {project.status}
          </span>
          {project.tech.map((t) => (
            <span key={t} className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          {project.repoUrl && (
            <a href={project.repoUrl} className="underline underline-offset-2">
              Repository
            </a>
          )}
          {project.liveUrl && (
            <a href={project.liveUrl} className="underline underline-offset-2">
              Live
            </a>
          )}
        </div>
      </header>
      <Mdx source={project.content} />
    </article>
  );
}
