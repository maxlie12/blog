"use server";

import type { ReactNode } from "react";
import { Mdx } from "@/lib/mdx";
import { requireStudioSession } from "@/lib/studioSession";

/** Renders content through the exact same Mdx component the public blog uses, so Studio's
 * preview can never drift from what a published post actually looks like. Server Actions can
 * return React nodes directly (RSC payload), which lets a client component request a
 * server-rendered result without a full page navigation. */
export async function renderPostPreview(content: string): Promise<ReactNode> {
  await requireStudioSession();
  return <Mdx source={content} />;
}
