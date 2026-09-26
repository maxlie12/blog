import Link from "next/link";
import type { Metadata } from "next";
import { getStudioPosts } from "@/lib/posts";
import { unpublishPost, deletePost } from "./actions";

export const metadata: Metadata = { title: "Blog posts · Studio" };
export const dynamic = "force-dynamic";

export default async function StudioPostsPage() {
  const posts = await getStudioPosts();
  const drafts = posts.filter((p) => p.status === "draft");
  const published = posts.filter((p) => p.status === "published");

  return (
    <div className="studio-page">
      <header className="studio-page__header">
        <div>
          <h1>Blog posts</h1>
          <p>{posts.length} total · {published.length} published · {drafts.length} draft</p>
        </div>
        <Link href="/studio/posts/new" className="button button--primary">
          + New post
        </Link>
      </header>

      {posts.length === 0 ? (
        <p className="empty-state">No posts yet. Create your first one.</p>
      ) : (
        <table className="studio-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Category</th>
              <th>Updated</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>
                  <Link href={`/studio/posts/${post.id}`}>{post.title}</Link>
                  <span className="studio-table__slug">/{post.slug}</span>
                </td>
                <td>
                  <span className={`status-pill status-pill--${post.status}`}>{post.status}</span>
                </td>
                <td>{post.category ?? "—"}</td>
                <td>{post.updatedAt.toISOString().slice(0, 10)}</td>
                <td className="studio-table__actions">
                  <Link href={`/studio/posts/${post.id}`} className="button button--ghost button--sm">
                    Edit
                  </Link>
                  {post.status === "published" ? (
                    <form action={unpublishPost.bind(null, post.id)}>
                      <button type="submit" className="button button--ghost button--sm">
                        Unpublish
                      </button>
                    </form>
                  ) : null}
                  <form action={deletePost.bind(null, post.id)}>
                    <button type="submit" className="button button--ghost button--sm button--danger">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
