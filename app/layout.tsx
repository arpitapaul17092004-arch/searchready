import type { Metadata } from "next";
import Link from "next/link";
import AuthButtons from "@/components/auth-buttons";
import "./globals.css";

export const metadata: Metadata = {
  title: "SearchReady — Unified Search Visibility Platform (SEO + GEO + AEO)",
  description:
    "See how ready your content is for both traditional search engines and AI answer engines — with one clear score and a prioritized checklist.",
};

const navLinks = [
  { href: "/analyze", label: "Analyze" },
  { href: "/templates", label: "Templates" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm text-white">
                SR
              </span>
              SearchReady
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-brand-600">
                  {link.label}
                </Link>
              ))}
              <AuthButtons />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">
            SearchReady — one clear system for SEO, GEO and AEO readiness. Honest
            analysis: no fake guarantees of rankings or AI citations. v1.0.1 ·{" "}
            <a href="/feedback" className="text-brand-600 hover:underline">
              Give feedback
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
