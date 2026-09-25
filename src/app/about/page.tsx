import type { Metadata } from "next";
import { profile } from "@/data/profile";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="space-y-10">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
        This page is placeholder content — edit <code>src/data/profile.ts</code> with real bio,
        skills, and experience before launch.
      </div>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">{profile.tagline}</p>
      </header>

      <section className="space-y-3 text-neutral-700 dark:text-neutral-300">
        {profile.bio.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Skills</h2>
        <ul className="flex flex-wrap gap-2">
          {profile.skills.map((skill) => (
            <li
              key={skill}
              className="rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
            >
              {skill}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Experience</h2>
        <ol className="space-y-4">
          {profile.experience.map((job, i) => (
            <li key={i} className="border-l-2 border-neutral-300 pl-4 dark:border-neutral-700">
              <p className="font-medium">
                {job.role} · {job.org}
              </p>
              <p className="text-xs text-neutral-500">{job.period}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{job.summary}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
