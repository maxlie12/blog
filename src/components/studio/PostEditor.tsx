"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BlogCard } from "@/components/BlogCard";
import { slugify } from "@/lib/slug";
import { saveDraft, publishPost, unpublishPost, deletePost, type PostFormState } from "@/app/studio/(dashboard)/posts/actions";
import { renderPostPreview } from "@/app/studio/(dashboard)/posts/previewAction";

export interface EditablePost {
  id?: string;
  title: string;
  excerpt: string;
  slug: string;
  category: string;
  tags: string[];
  coverImage: string;
  content: string;
  status: "draft" | "published";
  relatedLearning: boolean;
}

const EMPTY: EditablePost = {
  title: "",
  excerpt: "",
  slug: "",
  category: "",
  tags: [],
  coverImage: "",
  content: "",
  status: "draft",
  relatedLearning: false,
};

const TOOLBAR_INSERTS: { label: string; before: string; after?: string }[] = [
  { label: "B", before: "**", after: "**" },
  { label: "I", before: "_", after: "_" },
  { label: "Link", before: "[", after: "](https://)" },
  { label: "• List", before: "- " },
  { label: "1. List", before: "1. " },
  { label: "Quote", before: "> " },
  { label: "Code", before: "`", after: "`" },
  { label: "Image", before: "![alt](", after: ")" },
];

function snapshot(post: EditablePost): string {
  return JSON.stringify(post);
}

export function PostEditor({ initial }: { initial?: EditablePost }) {
  const router = useRouter();
  const [post, setPost] = useState<EditablePost>(initial ?? EMPTY);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot(initial ?? EMPTY));
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [message, setMessage] = useState<PostFormState | null>(null);
  const [pending, startTransition] = useTransition();
  const [previewNode, setPreviewNode] = useState<ReactNode>(null);
  const [previewPending, startPreviewTransition] = useTransition();

  const dirty = snapshot(post) !== savedSnapshot;

  useEffect(() => {
    if (mode !== "preview") return;
    let cancelled = false;
    startPreviewTransition(async () => {
      const node = await renderPostPreview(post.content || "_Nothing written yet._");
      if (!cancelled) setPreviewNode(node);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, post.content, startPreviewTransition]);

  function update<K extends keyof EditablePost>(key: K, value: EditablePost[K]) {
    setPost((p) => ({ ...p, [key]: value }));
  }

  function handleTitleChange(value: string) {
    update("title", value);
    if (!slugTouched) update("slug", slugify(value));
  }

  function insertMarkdown(before: string, after = "") {
    const textarea = document.getElementById("post-content") as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = post.content;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    update("content", next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function toFormData(): FormData {
    const fd = new FormData();
    if (post.id) fd.set("id", post.id);
    fd.set("title", post.title);
    fd.set("excerpt", post.excerpt);
    fd.set("slug", post.slug);
    fd.set("category", post.category);
    fd.set("tags", post.tags.join(","));
    fd.set("coverImage", post.coverImage);
    fd.set("content", post.content);
    if (post.relatedLearning) fd.set("relatedLearning", "on");
    return fd;
  }

  function handleSave(intent: "save" | "publish") {
    setMessage(null);
    startTransition(async () => {
      const action = intent === "save" ? saveDraft : publishPost;
      const result = await action(toFormData());
      setMessage(result);
      if (!result?.fieldErrors && !result?.error) {
        const wasNew = !post.id;
        setPost((p) => ({
          ...p,
          id: result.id ?? p.id,
          status: result.status ?? p.status,
        }));
        setSavedSnapshot(snapshot({ ...post, id: result.id ?? post.id, status: result.status ?? post.status }));
        if (wasNew && result.id) {
          router.replace(`/studio/posts/${result.id}`);
        } else {
          router.refresh();
        }
      }
    });
  }

  const previewArticle = useMemo(
    () => ({
      slug: post.slug || "preview",
      title: post.title || "Untitled post",
      summary: post.excerpt,
      date: new Date().toISOString().slice(0, 10),
      areas: [post.category.toLowerCase() || "dev"],
      content: post.content,
      readingMinutes: Math.max(1, Math.round(post.content.split(/\s+/).length / 200)),
      coverImage: post.coverImage || undefined,
      tags: post.tags,
    }),
    [post]
  );

  return (
    <div className="post-editor">
      <header className="post-editor__topbar">
        <div>
          <h1>{post.id ? post.title || "Edit post" : "New blog post"}</h1>
          <p>Write, reflect, and share what I&apos;m learning.</p>
        </div>
        <div className="post-editor__topbar-actions">
          <span className={`status-pill status-pill--${post.status}`}>{post.status}</span>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => handleSave("save")}
            disabled={pending}
          >
            Save draft
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setMode(mode === "write" ? "preview" : "write")}
          >
            {mode === "write" ? "Preview" : "Back to editor"}
          </button>
          {post.status === "published" && post.id && (
            <button
              type="button"
              className="button button--ghost"
              onClick={() =>
                startTransition(async () => {
                  await unpublishPost(post.id!);
                  setPost((p) => ({ ...p, status: "draft" }));
                  router.refresh();
                })
              }
              disabled={pending}
            >
              Unpublish
            </button>
          )}
          <button
            type="button"
            className="button button--primary"
            onClick={() => handleSave("publish")}
            disabled={pending}
          >
            ↑ Publish
          </button>
        </div>
      </header>

      <div className="post-editor__status-row">
        {pending && <span className="post-editor__saving">Saving…</span>}
        {!pending && message?.savedAt && <span className="post-editor__saved">Saved ✓</span>}
        {message?.error && <span className="post-editor__error">{message.error}</span>}
        {message?.fieldErrors?.map((err) => (
          <span className="post-editor__error" key={err}>
            {err}
          </span>
        ))}
        {dirty && !pending && <span className="post-editor__unsaved">Unsaved changes</span>}
      </div>

      {mode === "write" ? (
        <div className="post-editor__grid">
          <div className="post-editor__main">
            <label className="field">
              <span>
                Title <span className="field__required">*</span>
              </span>
              <input
                value={post.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="What I learned debugging a pending API"
                required
              />
            </label>

            <label className="field">
              <span>Excerpt</span>
              <textarea
                value={post.excerpt}
                onChange={(e) => update("excerpt", e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="A one or two sentence summary shown in lists."
              />
              <span className="field__hint">{post.excerpt.length}/300</span>
            </label>

            <label className="field">
              <span>Cover image URL</span>
              <input
                value={post.coverImage}
                onChange={(e) => update("coverImage", e.target.value)}
                placeholder="https://…"
              />
              {post.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.coverImage} alt="" className="post-editor__cover-preview" />
              )}
            </label>

            <div className="field">
              <span>
                Content <span className="field__required">*</span>
              </span>
              <div className="post-editor__toolbar">
                {TOOLBAR_INSERTS.map((btn) => (
                  <button
                    type="button"
                    key={btn.label}
                    onClick={() => insertMarkdown(btn.before, btn.after)}
                    title={btn.label}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <textarea
                id="post-content"
                className="post-editor__content"
                value={post.content}
                onChange={(e) => update("content", e.target.value)}
                rows={18}
                placeholder="Write in Markdown — headings, lists, quotes, links, `code`, and ![images](url) are all supported."
                required
              />
            </div>
          </div>

          <aside className="post-editor__settings">
            <h2>Post settings</h2>
            <p className="post-editor__settings-hint">Control how this post appears on your site.</p>

            <label className="field">
              <span>Slug</span>
              <input
                value={post.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  update("slug", slugify(e.target.value));
                }}
                placeholder="what-i-learned-debugging-a-pending-api"
              />
              <span className="field__hint">Lowercase, letters, numbers and hyphens only.</span>
            </label>

            <label className="field">
              <span>Category</span>
              <input
                value={post.category}
                onChange={(e) => update("category", e.target.value)}
                placeholder="Programming"
                list="post-categories"
              />
              <datalist id="post-categories">
                <option value="dev" />
                <option value="work" />
                <option value="learning" />
                <option value="life" />
              </datalist>
            </label>

            <label className="field">
              <span>Tags (comma-separated)</span>
              <input
                value={post.tags.join(", ")}
                onChange={(e) =>
                  update(
                    "tags",
                    e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                  )
                }
                placeholder="debugging, api, web development"
              />
            </label>

            <label className="field field--toggle">
              <input
                type="checkbox"
                checked={post.relatedLearning}
                onChange={(e) => update("relatedLearning", e.target.checked)}
              />
              <span>
                Related learning
                <small>Link this post to relevant lessons and skills.</small>
              </span>
            </label>

            <h2 className="post-editor__preview-heading">Live preview</h2>
            <p className="post-editor__settings-hint">This is how your post will look on the site.</p>
            <div className="post-editor__mini-preview">
              <BlogCard article={previewArticle} />
            </div>

            {post.id && (
              <form
                action={deletePost.bind(null, post.id)}
                onSubmit={(e) => {
                  if (!confirm("Delete this post permanently? This cannot be undone.")) {
                    e.preventDefault();
                  }
                }}
              >
                <button type="submit" className="button button--ghost button--danger post-editor__delete">
                  Delete post
                </button>
              </form>
            )}
          </aside>
        </div>
      ) : (
        <div className="post-editor__preview-full">
          <p className="post-editor__preview-note">
            Preview — same rendering and card design as the public blog.
          </p>
          <BlogCard article={previewArticle} />
          <article className="article-page">
            <header className="article-page__header">
              {post.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.coverImage} alt="" className="article-page__cover" />
              )}
              <h1>{post.title || "Untitled post"}</h1>
              <p className="article-page__meta">{previewArticle.date} · {previewArticle.readingMinutes} min read</p>
            </header>
            {previewPending ? <p className="empty-state">Rendering preview…</p> : previewNode}
          </article>
        </div>
      )}
    </div>
  );
}
