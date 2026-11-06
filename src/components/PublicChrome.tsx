"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import dynamic from "next/dynamic";

const StudyMusic = dynamic(() => import("./StudyMusic").then(module => module.StudyMusic), { ssr: false });

/** /studio has its own sidebar chrome (src/app/studio/layout.tsx) — the public
 * header/footer only wrap everything else. */
export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/studio")) {
    return <>{children}</>;
  }
  return (
    <>
      <SiteHeader />
      {!pathname?.startsWith("/learning/world") && !pathname?.startsWith("/learning/village") && <StudyMusic key={pathname} />}
      <main className="site-main">{children}</main>
      <SiteFooter />
    </>
  );
}
