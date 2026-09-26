import type { Metadata } from "next";
import Link from "next/link";
import { getAllProjects } from "@/lib/content";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  const projects = getAllProjects();

  return (
    <div className="section-page">
      <header className="section-page__header">
        <h1>Projects</h1>
        <p>What I&apos;ve built, what I&apos;m building, and what I learned along the way.</p>
      </header>
      {projects.length === 0 ? (
        <p className="empty-state">
          No projects yet. Add an .mdx file to <code>content/projects/</code>.
        </p>
      ) : (
        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.slug}>
              <Link href={`/projects/${p.slug}`} className="project-card">
                <div className="project-card__header">
                  <h2>{p.title}</h2>
                  {p.sample && <span className="tag tag--sample">sample</span>}
                  <span className="tag tag--status">{p.status}</span>
                </div>
                <p className="project-card__summary">{p.summary}</p>
                <p className="project-card__tech">{p.tech.join(" · ")}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
