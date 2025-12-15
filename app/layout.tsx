import "./globals.css";

import { Space_Mono, Syne } from "next/font/google";

import type { Metadata } from "next";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "@mux/ai workflows demo | @mux/ai + Vercel Workflows",
  description: "A reference architecture demonstrating how to integrate @mux/ai with Vercel Workflows to build video intelligence pipelines in Next.js.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${syne.variable} ${spaceMono.variable} antialiased`}
        style={{ fontFamily: "var(--font-syne), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
