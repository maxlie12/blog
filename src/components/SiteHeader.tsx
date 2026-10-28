"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PALETTES } from "@/lib/palettes";
import { useTheme } from "@/lib/theme";

const NAV_LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/projects", label: "Projects" },
  { href: "/learning", label: "Learning" },
  { href: "/about", label: "About" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { mode, palette, setMode, setPalette } = useTheme();

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
          <button
            type="button"
            className="theme-toggle"
            popoverTarget="palette-picker"
            aria-label="Choose color palette"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-7.8-9-7.8Z" />
              <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
              <circle cx="12" cy="7.5" r="1" fill="currentColor" />
              <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
            </svg>
          </button>
          <div id="palette-picker" popover="auto" className="palette-picker">
            <fieldset>
              <legend>Color palette</legend>
              {PALETTES.map((p) => (
                <label key={p.id} className="palette-picker__option">
                  <input
                    type="radio"
                    name="palette"
                    value={p.id}
                    checked={palette === p.id}
                    onChange={() => setPalette(p.id)}
                  />
                  <span className="palette-picker__swatch" data-swatch={p.id} aria-hidden="true" />
                  {p.label}
                </label>
              ))}
            </fieldset>
          </div>
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
