import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/*": ["./content/daily-lessons/*.json"] },
};

export default nextConfig;
