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
    <article className="article-page">
      {project.sample && (
        <div className="sample-banner">
          This is placeholder content — see <code>content/projects/{project.slug}.mdx</code>.
        </div>
      )}
      <header className="article-page__header">
        <h1>{project.title}</h1>
        <p className="article-page__meta">{project.summary}</p>
        <div className="project-detail__tags">
          <span className="tag tag--status">{project.status}</span>
          {project.tech.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <div className="project-detail__links">
          {project.repoUrl && <a href={project.repoUrl}>Repository</a>}
          {project.liveUrl && <a href={project.liveUrl}>Live</a>}
        </div>
      </header>
      <Mdx source={project.content} />
    </article>
  );
}
