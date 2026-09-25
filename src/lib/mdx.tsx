import { MDXRemote } from "next-mdx-remote-client/rsc";

export function Mdx({ source }: { source: string }) {
  return (
    <div className="prose-content">
      <MDXRemote source={source} />
    </div>
  );
}
