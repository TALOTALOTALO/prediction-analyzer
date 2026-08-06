import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "FadeMe — Analyze. Predict. Fade.",
  description:
    "Upload any prediction market screenshot and get an instant AI-powered grade, edge analysis, and recommendation.",
  metadataBase: new URL("https://www.fademe.ai"),
  openGraph: {
    title: "FadeMe — Analyze. Predict. Fade.",
    description: "Grade any bet. Know your edge before you commit.",
    type: "website",
    url: "https://www.fademe.ai",
    images: [{ url: "/logo-full.png", width: 1080, height: 1080, alt: "FadeMe" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FadeMe — Analyze. Predict. Fade.",
    description: "Grade any bet. Know your edge before you commit.",
    images: ["/logo-full.png"],
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FadeMe",
  url: "https://www.fademe.ai",
  description: "AI-powered prediction market bet analyzer. Upload a screenshot, get a grade, edge score, and BUY/HOLD/FADE recommendation.",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "1.00", priceCurrency: "USD", description: "First week $1, then $19.99/month" },
  logo: "https://www.fademe.ai/logo-icon.png",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-bg text-white antialiased">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
