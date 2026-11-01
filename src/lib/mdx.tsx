import { MDXRemote, type MDXComponents } from "next-mdx-remote-client/rsc";

export function Mdx({ source, components }: { source: string; components?: MDXComponents }) {
  return (
    <div className="prose-content">
      <MDXRemote source={source} components={components} />
    </div>
  );
}
