import type { Metadata } from "next";
import { profile } from "@/data/profile";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="sample-banner">
        This page is placeholder content — edit <code>src/data/profile.ts</code> with real bio,
        skills, and experience before launch.
      </div>

      <header className="about-page__header">
        <h1>{profile.name}</h1>
        <p>{profile.tagline}</p>
      </header>

      <section className="about-page__bio">
        {profile.bio.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </section>

      <section>
        <h2>Skills</h2>
        <ul className="pill-list">
          {profile.skills.map((skill) => (
            <li key={skill} className="pill">
              {skill}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Experience</h2>
        <ol className="timeline">
          {profile.experience.map((job, i) => (
            <li key={i}>
              <p className="timeline__role">
                {job.role} · {job.org}
              </p>
              <p className="timeline__period">{job.period}</p>
              <p className="timeline__summary">{job.summary}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
