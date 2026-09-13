import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routed Ops",
  description: "Operations console for Routed — vehicles, routes, and deliveries.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-white">
          <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg text-accent">
              Routed Ops
            </Link>
            <nav className="flex gap-6 text-sm font-medium text-foreground/70">
              <Link href="/vehicles" className="hover:text-accent">
                Vehicles
              </Link>
              <Link href="/routes" className="hover:text-accent">
                Routes
              </Link>
              <Link href="/deliver" className="hover:text-accent">
                Deliver
              </Link>
              <Link href="/deliveries" className="hover:text-accent">
                Proof of Delivery
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
