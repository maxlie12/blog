import { prisma } from "@/lib/db";
import { getAllArticles, type Article } from "@/lib/content";
import { slugify } from "@/lib/slug";

export { slugify };

export type PostStatus = "draft" | "published";

export interface PostInput {
  title: string;
  excerpt: string;
  slug: string;
  category?: string;
  tags: string[];
  coverImage?: string;
  content: string;
  relatedLearning: boolean;
}

function parseTags(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Maps a DB Post row onto the same shape the public blog already renders (`Article`), so
 * BlogCard/the article page/Studio preview all share one rendering path. */
function postToArticle(post: {
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  tags: string;
  coverImage: string | null;
  content: string;
  publishedAt: Date | null;
  createdAt: Date;
  relatedLearning: boolean;
}): Article {
  const readingTimeMinutes = Math.max(1, Math.round(post.content.split(/\s+/).length / 200));
  return {
    slug: post.slug,
    title: post.title,
    summary: post.excerpt,
    date: (post.publishedAt ?? post.createdAt).toISOString().slice(0, 10),
    areas: [(post.category?.toLowerCase() as Article["areas"][number]) || "dev"],
    content: post.content,
    readingMinutes: readingTimeMinutes,
    coverImage: post.coverImage ?? undefined,
    relatedLearning: post.relatedLearning,
    tags: parseTags(post.tags),
  };
}

/** Published Studio posts, merged with hand-written content/articles/*.mdx. Studio posts win
 * on slug collision (the editor's uniqueness check should prevent this in practice). */
export async function getPublicArticles(): Promise<Article[]> {
  const dbPosts = await prisma.post.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
  });
  const mdxArticles = getAllArticles();
  const dbSlugs = new Set(dbPosts.map((p) => p.slug));
  const merged = [...dbPosts.map(postToArticle), ...mdxArticles.filter((a) => !dbSlugs.has(a.slug))];
  return merged.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPublicArticleBySlug(slug: string): Promise<Article | undefined> {
  const dbPost = await prisma.post.findUnique({ where: { slug } });
  if (dbPost && dbPost.status === "published") return postToArticle(dbPost);
  return getAllArticles().find((a) => a.slug === slug);
}

// ---- Studio (authenticated) reads/writes ----

export async function getStudioPosts() {
  return prisma.post.findMany({ orderBy: { updatedAt: "desc" } });
}

export async function getStudioPostById(id: string) {
  return prisma.post.findUnique({ where: { id } });
}

export async function isSlugTaken(slug: string, excludingId?: string): Promise<boolean> {
  const dbHit = await prisma.post.findFirst({
    where: excludingId ? { slug, NOT: { id: excludingId } } : { slug },
  });
  if (dbHit) return true;
  return getAllArticles().some((a) => a.slug === slug);
}

export function validatePostInput(input: Partial<PostInput>): string[] {
  const errors: string[] = [];
  if (!input.title?.trim()) errors.push("Title is required.");
  if (!input.excerpt?.trim()) errors.push("Excerpt is required.");
  if (!input.slug?.trim()) errors.push("Slug is required.");
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) {
    errors.push("Slug must be lowercase letters, numbers, and hyphens only.");
  }
  if (!input.content?.trim()) errors.push("Content is required.");
  return errors;
}
