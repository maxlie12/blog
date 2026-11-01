import { MDXRemote, type MDXComponents } from "next-mdx-remote-client/rsc";

export function Mdx({ source, components, lang }: { source: string; components?: MDXComponents; lang?: string }) {
  return (
    <div className="prose-content" lang={lang}>
      <MDXRemote source={source} components={components} />
    </div>
  );
}
