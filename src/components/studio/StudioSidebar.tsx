"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/studio/login/actions";

const NAV = [
  { href: "/studio", label: "Overview", icon: "⌂" },
  { href: "/studio/posts", label: "Blog posts", icon: "▤" },
  { href: "/studio/learning", label: "Learning", icon: "▥" },
  { href: "/studio/journey", label: "Mountain journey", icon: "▲" },
];

function isActive(pathname: string, href: string) {
  if (href === "/studio") return pathname === "/studio";
  return pathname.startsWith(href);
}

export function StudioSidebar() {
  const pathname = usePathname();

  return (
    <aside className="studio-sidebar">
      <div className="studio-sidebar__brand">
        <span className="studio-sidebar__mark" aria-hidden="true">
          ▲
        </span>
        <span>
          <span className="studio-sidebar__name">LUÂN / STUDIO</span>
          <span className="studio-sidebar__tagline">Private workspace</span>
        </span>
      </div>

      <nav aria-label="Studio navigation" className="studio-sidebar__nav">
        <ul>
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="studio-sidebar__footer">
        <p className="studio-sidebar__quote">&ldquo;A little progress every day.&rdquo;</p>
        <form action={logout}>
          <button type="submit" className="studio-sidebar__logout">
            Log out
          </button>
        </form>
        <Link href="/" className="studio-sidebar__view-site">
          ← View public site
        </Link>
      </div>
    </aside>
  );
}
