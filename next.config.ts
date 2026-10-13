import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/*": ["./content/daily-lessons/*.json", "./content/articles/*.mdx", "./content/projects/*.mdx", ...(process.env.BLOG_READ_ONLY_PREVIEW === "1" ? ["./data/preview.db"] : [])] },
};

export default nextConfig;
