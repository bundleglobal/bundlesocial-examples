import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "bundle.social Next.js example",
  description:
    "Compose posts, connect social accounts, and receive webhooks using the bundlesocial SDK from a Next.js App Router app.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              bundle.social · Next.js example
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Compose
              </Link>
              <Link href="/connect" className="hover:underline">
                Connect
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
