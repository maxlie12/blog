import type { MetadataRoute } from "next";
import { getAllArticles, getAllProjects } from "@/lib/content";

const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/about", "/projects", "/writing", "/learning"].map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));

  const articleRoutes = getAllArticles().map((a) => ({
    url: `${SITE_URL}/writing/${a.slug}`,
    lastModified: new Date(a.updated || a.date),
  }));

  const projectRoutes = getAllProjects().map((p) => ({
    url: `${SITE_URL}/projects/${p.slug}`,
    lastModified: new Date(p.date),
  }));

  return [...staticRoutes, ...articleRoutes, ...projectRoutes];
}
