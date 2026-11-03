import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Projects were replaced by the play corner (SITE-001); keep old links working.
  async redirects() {
    return [
      { source: "/projects", destination: "/play", permanent: true },
      { source: "/projects/:slug", destination: "/play", permanent: true },
    ];
  },
  outputFileTracingIncludes: { "/*": ["./content/daily-lessons/*.json", "./content/articles/*.mdx", ...(process.env.BLOG_READ_ONLY_PREVIEW === "1" ? ["./data/preview.db"] : [])] },
};

export default nextConfig;
