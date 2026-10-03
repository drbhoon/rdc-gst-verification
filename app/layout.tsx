import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GST Verify | RDC Finance",
  description: "Verify supplier GST invoices and review reporting status.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
