import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repruv — AI-native reputation management",
  description:
    "Get more reviews compliantly, answer every one in your voice within minutes, and run operations on what customers actually say.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
