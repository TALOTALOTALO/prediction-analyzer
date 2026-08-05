import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — FadeMe",
  description: "Privacy Policy for FadeMe.ai",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border-subtle px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-dim hover:text-white transition-colors">
            <ArrowLeft size={16} />
            <span className="text-sm">Back</span>
          </Link>
          <span className="text-white font-semibold tracking-tight">
            Fade<span className="text-green-bright">Me</span>
          </span>
          <div className="w-16" />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-black mb-2">Privacy Policy</h1>
        <p className="text-text-dim text-sm mb-12">Last updated: August 5, 2026</p>

        <div className="space-y-10 text-white/80 leading-relaxed">
          <Section title="1. Who We Are">
            <p>
              FadeMe.ai is operated by Repeak Media. This Privacy Policy explains how we collect,
              use, and protect your information when you use FadeMe.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect the following categories of information:</p>
            <ul className="list-disc list-inside mt-3 space-y-2 text-white/70">
              <li>
                <span className="text-white font-medium">Account information</span> — your name and
                email address, collected via Clerk when you sign up
              </li>
              <li>
                <span className="text-white font-medium">Payment information</span> — billing details
                processed by Stripe. We never store your card number; Stripe handles all payment data
              </li>
              <li>
                <span className="text-white font-medium">Subscription status</span> — whether you have
                an active subscription, stored in our database (Supabase)
              </li>
              <li>
                <span className="text-white font-medium">Uploaded screenshots</span> — images you
                submit for analysis. These are sent to Anthropic's Claude API for processing and are
                not stored by us after the analysis is returned
              </li>
              <li>
                <span className="text-white font-medium">Usage data</span> — standard server logs
                including IP address, browser type, and pages visited
              </li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use your information to:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5 text-white/70">
              <li>Provide and improve the FadeMe service</li>
              <li>Authenticate your account and verify subscription status</li>
              <li>Process payments and manage your subscription</li>
              <li>Respond to support requests</li>
              <li>Send transactional emails (receipts, billing notifications)</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information to third parties.
            </p>
          </Section>

          <Section title="4. Third-Party Services">
            <p>FadeMe uses the following third-party services, each with their own privacy policies:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5 text-white/70">
              <li><span className="text-white font-medium">Clerk</span> — authentication and user management</li>
              <li><span className="text-white font-medium">Stripe</span> — payment processing and billing</li>
              <li><span className="text-white font-medium">Supabase</span> — database (subscription data only)</li>
              <li><span className="text-white font-medium">Anthropic (Claude)</span> — AI analysis of uploaded screenshots</li>
              <li><span className="text-white font-medium">Vercel</span> — hosting and infrastructure</li>
            </ul>
          </Section>

          <Section title="5. Screenshot Data">
            <p>
              Screenshots you upload are sent directly to Anthropic's Claude API for analysis.
              We do not store, log, or retain your screenshots after the analysis response is
              returned to you. Anthropic's data handling is governed by their{" "}
              <a
                href="https://www.anthropic.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-bright hover:underline"
              >
                Privacy Policy
              </a>
              .
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your account and subscription data for as long as your account is active.
              If you cancel and request deletion, we will remove your data within 30 days, except
              where retention is required by law (e.g., billing records).
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5 text-white/70">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Opt out of any marketing communications</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:italo@repeakmedia.com" className="text-green-bright hover:underline">
                italo@repeakmedia.com
              </a>
              .
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We use industry-standard measures to protect your data, including encrypted connections
              (HTTPS), secure third-party services, and access controls. No method of transmission
              over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by posting the new policy on this page with an updated date.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions or concerns about your privacy? Reach us at{" "}
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
