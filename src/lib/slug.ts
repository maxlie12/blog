// Pure, dependency-free so client components (e.g. PostEditor) can import it without pulling
// in server-only modules like src/lib/content.ts (which touches the filesystem).
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
