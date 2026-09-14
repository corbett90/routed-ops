import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routed Ops",
  description: "Operations console for Routed — vehicles, routes, and deliveries.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
