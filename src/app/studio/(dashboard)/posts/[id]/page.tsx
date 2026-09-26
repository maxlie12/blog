import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStudioPostById } from "@/lib/posts";
import { PostEditor, type EditablePost } from "@/components/studio/PostEditor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getStudioPostById(id);
  return { title: post ? `Edit: ${post.title} · Studio` : "Edit post · Studio" };
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getStudioPostById(id);
  if (!post) notFound();

  const initial: EditablePost = {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    slug: post.slug,
    category: post.category ?? "",
    tags: JSON.parse(post.tags || "[]"),
    coverImage: post.coverImage ?? "",
    content: post.content,
    status: post.status as "draft" | "published",
    relatedLearning: post.relatedLearning,
  };

  return <PostEditor initial={initial} />;
}
