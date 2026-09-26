import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { ProgressProvider } from "@/lib/progress";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Luân — Field Notes",
    template: "%s · Luân",
  },
  description:
    "Code. Learn. Explore a sharper self. Portfolio, writing, and an English-learning space — projects, articles, and practice tracked as it actually happens.",
};

// Applies the persisted theme/accent before first paint to avoid a flash of the default theme.
const NO_FLASH_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("site-theme");
    if (!theme) theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    var accent = localStorage.getItem("site-accent") || "amber";
    document.documentElement.setAttribute("data-accent", accent);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <ProgressProvider>
            <SiteHeader />
            <main className="site-main">{children}</main>
            <SiteFooter />
          </ProgressProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
