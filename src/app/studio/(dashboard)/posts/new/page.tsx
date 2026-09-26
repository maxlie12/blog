import type { Metadata } from "next";
import { PostEditor } from "@/components/studio/PostEditor";

export const metadata: Metadata = { title: "New post · Studio" };

export default function NewPostPage() {
  return <PostEditor />;
}
