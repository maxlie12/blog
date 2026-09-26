import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";

const CONTENT_DIR = path.join(process.cwd(), "content");

// A small set of known values get a friendly label in BlogCard; any other free-text category
// (Studio posts allow arbitrary categories) falls back to its own uppercased text.
export type ArticleArea = "dev" | "work" | "learning" | "life" | (string & {});

export interface ArticleFrontmatter {
  title: string;
  date: string; // YYYY-MM-DD
  updated?: string;
  summary: string;
  areas: ArticleArea[];
  draft?: boolean;
  sample?: boolean; // true = placeholder/demo content, clearly labelled in the UI
  relatedProjects?: string[]; // project slugs
  relatedLogAreas?: string[]; // LearningLog.area values this article discusses
}

export interface Article extends ArticleFrontmatter {
  slug: string;
  content: string;
  readingMinutes: number;
  coverImage?: string;
  relatedLearning?: boolean;
  tags?: string[];
}

export interface ProjectFrontmatter {
  title: string;
  summary: string;
  date: string;
  status: "active" | "paused" | "shipped" | "archived";
  tech: string[];
  repoUrl?: string;
  liveUrl?: string;
  featured?: boolean;
  sample?: boolean;
}

export interface Project extends ProjectFrontmatter {
  slug: string;
  content: string;
}

function readMdxDir<T>(dir: string): Array<{ slug: string; data: T; content: string }> {
  const full = path.join(CONTENT_DIR, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".mdx"))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(full, filename), "utf8");
      const { data, content } = matter(raw);
      return { slug: filename.replace(/\.mdx$/, ""), data: data as T, content };
    });
}

const isProd = process.env.NODE_ENV === "production";

export function getAllArticles(): Article[] {
  return readMdxDir<ArticleFrontmatter>("articles")
    .map(({ slug, data, content }) => ({
      slug,
      ...data,
      content,
      readingMinutes: Math.max(1, Math.round(readingTime(content).minutes)),
    }))
    .filter((a) => !(isProd && a.draft))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getArticleBySlug(slug: string): Article | undefined {
  return getAllArticles().find((a) => a.slug === slug);
}

export function getAllProjects(): Project[] {
  return readMdxDir<ProjectFrontmatter>("projects")
    .map(({ slug, data, content }) => ({ slug, ...data, content }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getProjectBySlug(slug: string): Project | undefined {
  return getAllProjects().find((p) => p.slug === slug);
}
