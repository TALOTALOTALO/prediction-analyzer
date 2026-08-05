import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "FadeMe — AI Prediction Market Analyzer",
  description:
    "Upload any prediction market screenshot and get an instant AI-powered grade, edge analysis, and recommendation.",
  openGraph: {
    title: "FadeMe — AI Prediction Market Analyzer",
    description: "Grade any bet. Know your edge before you commit.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-bg text-white antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
