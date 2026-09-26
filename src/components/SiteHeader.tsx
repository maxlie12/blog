"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme, type AccentId } from "@/lib/theme";

const NAV_LINKS = [
  { href: "/", label: "Blog" },
  { href: "/projects", label: "Projects" },
  { href: "/learning", label: "Learning" },
  { href: "/about", label: "About" },
];

const ACCENTS: { id: AccentId; label: string }[] = [
  { id: "ivory", label: "Ivory accent" },
  { id: "teal", label: "Teal accent" },
  { id: "deep-teal", label: "Deep teal accent" },
  { id: "amber", label: "Amber accent" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { mode, accent, setMode, setAccent } = useTheme();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__brand">
          <span className="site-header__mark" aria-hidden="true">
            ▲
          </span>
          <span>
            <span className="site-header__name">LUÂN</span>
            <span className="site-header__divider"> / </span>
            <span className="site-header__field">FIELD NOTES</span>
            <span className="site-header__tagline">Code. Learn. Explore a sharper self.</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="site-header__nav">
          <ul>
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link href={link.href} aria-current={active ? "page" : undefined}>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="site-header__controls">
          <fieldset className="accent-picker">
            <legend className="sr-only">Accent color</legend>
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={a.label}
                aria-pressed={accent === a.id}
                data-swatch={a.id}
                className="accent-picker__dot"
                onClick={() => setAccent(a.id)}
              />
            ))}
          </fieldset>
          <button
            type="button"
            className="theme-toggle"
            aria-pressed={mode === "dark"}
            aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          >
            {mode === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </div>
      <p className="site-header__quote">&ldquo;A little progress every day.&rdquo;</p>
    </header>
  );
}
