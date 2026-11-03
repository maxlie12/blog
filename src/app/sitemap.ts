import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/content";

const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/about", "/blog", "/learning", "/play", "/learning/village", "/learning/world"].map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));

  const articleRoutes = getAllArticles().map((a) => ({
    url: `${SITE_URL}/blog/${a.slug}`,
    lastModified: new Date(a.updated || a.date),
  }));

  return [...staticRoutes, ...articleRoutes];
}
