"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStudioSession } from "@/lib/studioSession";
import { validatePostInput, isSlugTaken, type PostInput } from "@/lib/posts";

function readPostInput(formData: FormData): PostInput {
  return {
    title: String(formData.get("title") ?? "").trim(),
    excerpt: String(formData.get("excerpt") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim() || undefined,
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    coverImage: String(formData.get("coverImage") ?? "").trim() || undefined,
    content: String(formData.get("content") ?? ""),
    relatedLearning: formData.get("relatedLearning") === "on",
  };
}

export interface PostFormState {
  error?: string;
  fieldErrors?: string[];
  savedAt?: string;
  id?: string;
  slug?: string;
  status?: "draft" | "published";
}

async function upsertPost(formData: FormData, intent: "save" | "publish"): Promise<PostFormState> {
  await requireStudioSession();

  const id = String(formData.get("id") ?? "") || undefined;
  const input = readPostInput(formData);
  const fieldErrors = validatePostInput(input);
  if (fieldErrors.length > 0) {
    return { fieldErrors };
  }

  if (await isSlugTaken(input.slug, id)) {
    return { fieldErrors: [`Slug "${input.slug}" is already in use.`] };
  }

  const existing = id ? await prisma.post.findUnique({ where: { id } }) : null;

  // "Save draft" on an already-published post saves edits without unpublishing it — it only
  // creates NEW posts as drafts. "Publish" always sets status to published.
  const status = intent === "publish" ? "published" : existing?.status ?? "draft";

  const data = {
    title: input.title,
    excerpt: input.excerpt,
    slug: input.slug,
    category: input.category ?? null,
    tags: JSON.stringify(input.tags),
    coverImage: input.coverImage ?? null,
    content: input.content,
    relatedLearning: input.relatedLearning,
    status,
    ...(intent === "publish" ? { publishedAt: new Date() } : {}),
  };

  const post = id
    ? await prisma.post.update({ where: { id }, data })
    : await prisma.post.create({ data });

  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/studio/posts");
  revalidatePath("/");

  return {
    savedAt: new Date().toISOString(),
    id: post.id,
    slug: post.slug,
    status: post.status as "draft" | "published",
  };
}

// These intentionally return the saved post's id/status rather than calling redirect(): this
// action can be invoked as a plain function call from a client event handler (not just a
// native <form> submission), and redirect()'s automatic client navigation is only reliable
// for the latter. The caller (PostEditor) updates its own URL/state from the return value.
export async function saveDraft(formData: FormData): Promise<PostFormState> {
  return upsertPost(formData, "save");
}

export async function publishPost(formData: FormData): Promise<PostFormState> {
  return upsertPost(formData, "publish");
}

export async function unpublishPost(id: string): Promise<void> {
  await requireStudioSession();
  const post = await prisma.post.update({ where: { id }, data: { status: "draft" } });
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/studio/posts");
  revalidatePath("/");
}

export async function deletePost(id: string): Promise<void> {
  await requireStudioSession();
  const post = await prisma.post.delete({ where: { id } });
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/studio/posts");
  revalidatePath("/");
  redirect("/studio/posts");
}
