import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service — FadeMe",
  description: "Terms of Service for FadeMe.ai",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border-subtle px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-dim hover:text-white transition-colors">
            <ArrowLeft size={16} />
            <span className="text-sm">Back</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="FadeMe" width={24} height={24} className="rounded-md" />
            <span className="text-white font-semibold tracking-tight">
              Fade<span className="text-green-bright">Me</span>
            </span>
          </Link>
          <div className="w-16" />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-black mb-2">Terms of Service</h1>
        <p className="text-text-dim text-sm mb-12">Last updated: August 5, 2026</p>

        <div className="space-y-10 text-white/80 leading-relaxed">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using FadeMe.ai ("FadeMe," "we," "us," or "our"), you agree to be bound by
              these Terms of Service. If you do not agree, do not use the service.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              FadeMe provides AI-powered analysis of prediction market bets. You upload a screenshot of a
              bet from platforms such as Kalshi, Polymarket, or PredictIt, and our service returns a grade,
              probability estimate, and recommendation.
            </p>
            <p className="mt-3 font-semibold text-white">
              FadeMe is for informational purposes only. Nothing on this site constitutes financial,
              investment, or legal advice. Prediction markets involve risk, and past analysis performance
              does not guarantee future results.
            </p>
          </Section>

          <Section title="3. Subscription and Billing">
            <p>
              Access to FadeMe requires a paid subscription. Pricing is as follows:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-1.5 text-white/70">
              <li>Introductory offer: $1.00 for the first week</li>
              <li>Ongoing rate: $19.99 per month, billed monthly</li>
              <li>Your subscription renews automatically until cancelled</li>
            </ul>
            <p className="mt-3">
              All payments are processed securely by Stripe. By subscribing, you authorize us to charge
              your payment method on a recurring basis.
            </p>
          </Section>

          <Section title="4. Cancellation and Refunds">
            <p>
              You may cancel your subscription at any time through the billing portal accessible from your
              account. Upon cancellation, you retain access until the end of your current billing period.
              We do not offer refunds for partial billing periods.
            </p>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5 text-white/70">
              <li>Use the service for any unlawful purpose</li>
              <li>Attempt to reverse engineer, scrape, or automate access to the service</li>
              <li>Share your account credentials with others</li>
              <li>Use the service to generate content that violates any applicable laws</li>
            </ul>
          </Section>

          <Section title="6. Intellectual Property">
            <p>
              All content, design, and code on FadeMe.ai is owned by Repeak Media and protected by
              applicable intellectual property laws. You may not reproduce or redistribute any part of the
              service without prior written permission.
            </p>
          </Section>

          <Section title="7. Disclaimer of Warranties">
            <p>
              FadeMe is provided "as is" without warranties of any kind, express or implied. We do not
              guarantee that the service will be uninterrupted, error-free, or that any analysis will be
              accurate or profitable. AI-generated analysis may contain errors.
            </p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Repeak Media shall not be liable for any indirect,
              incidental, special, or consequential damages arising from your use of FadeMe, including
              any financial losses from betting decisions informed by our analysis.
            </p>
          </Section>

          <Section title="9. Changes to Terms">
            <p>
              We may update these Terms at any time. Continued use of the service after changes are posted
              constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about these Terms? Email us at{" "}
              <a href="mailto:italo@repeakmedia.com" className="text-green-bright hover:underline">
                italo@repeakmedia.com
              </a>
              .
            </p>
          </Section>
        </div>
      </div>

      <footer className="border-t border-border-subtle py-8 px-6 mt-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-white font-bold">
            Fade<span className="text-green-bright">Me</span>
          </span>
          <div className="flex items-center gap-6 text-xs text-text-dim">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
          <p className="text-text-dim text-xs">© 2026 FadeMe · Repeak Media</p>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
      <div className="text-white/70 text-sm">{children}</div>
    </div>
  );
}
