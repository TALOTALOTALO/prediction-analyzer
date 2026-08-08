import {
  Body, Button, Container, Head, Hr, Html, Preview, Section, Text,
} from "@react-email/components";
import * as React from "react";

interface LeadDay7EmailProps {
  wins: number;
  losses: number;
  winRate: number | null;
}

export default function LeadDay7Email({ wins, losses, winRate }: LeadDay7EmailProps) {
  const hasRecord = wins + losses > 0;

  return (
    <Html>
      <Head />
      <Preview>Last one from us — wanted to leave you with the honest numbers before we stop bugging you.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>FadeMe.ai</Text>
            <Text style={tagline}>One Last Thing</Text>
          </Section>

          <Section style={section}>
            <Text style={h2}>We&apos;re not going to spam you. This is the last one.</Text>
            <Text style={body2}>
              A week ago you asked for our free AI picks. We sent them. We hope some landed.
            </Text>
            <Text style={body2}>
              We&apos;re not going to pretend this is a magic winning machine — prediction markets
              are hard and nobody wins every bet. But we do genuinely try to put better information
              in your hands than you&apos;d have flying solo.
            </Text>
          </Section>

          {hasRecord && (
            <>
              <Hr style={divider} />
              <Section style={statsSection}>
                <Text style={statsLabel}>Our AI record this week</Text>
                <div>
                  <span style={winsNum}>{wins}W</span>
                  <span style={dash}> — </span>
                  <span style={lossesNum}>{losses}L</span>
                  {winRate !== null && (
                    <span style={rateNum}> · {winRate}%</span>
                  )}
                </div>
                <Text style={statsNote}>Every result verified by market settlement APIs. Full history at fademe.ai/record.</Text>
              </Section>
            </>
          )}

          <Hr style={divider} />

          <Section style={ctaSection}>
            <Text style={ctaHeading}>If you want in, it&apos;s $1 for your first week.</Text>
            <Text style={body2}>
              Daily picks in your inbox, full edge analysis on any bet you want to run, and an AI
              coach that thinks like a sharp. If it doesn&apos;t pay for itself, cancel before day 8.
              It cost you a dollar.
            </Text>
            <Button style={ctaButton} href="https://www.fademe.ai/analyze">
              Try it for $1 →
            </Button>
            <Text style={footnote}>Then $19.99/month. Cancel anytime — no email required.</Text>
          </Section>

          <Hr style={divider} />

          <Section style={section}>
            <Text style={body2}>
              Either way — good luck out there. Play smart, size right, and don&apos;t fade a bet just
              because everyone else is on it. (Actually, sometimes that&apos;s exactly why you should.)
            </Text>
            <Text style={signoff}>— The FadeMe team</Text>
          </Section>

          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              You signed up for free picks at fademe.ai. This is the last email in this series.
              Not financial advice. Prediction markets carry risk.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = { backgroundColor: "#0a0a0a", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };
const container: React.CSSProperties = { maxWidth: 560, margin: "0 auto", padding: "0 0 40px" };
const header: React.CSSProperties = { backgroundColor: "#0f0f0f", padding: "28px 40px 20px", borderBottom: "1px solid #1f1f1f" };
const logo: React.CSSProperties = { color: "#00dc82", fontSize: 18, fontWeight: 700, margin: "0 0 4px" };
const tagline: React.CSSProperties = { color: "#52525b", fontSize: 11, margin: 0, textTransform: "uppercase", letterSpacing: "1.5px" };
const section: React.CSSProperties = { padding: "24px 40px" };
const h2: React.CSSProperties = { color: "#ffffff", fontSize: 19, fontWeight: 700, margin: "0 0 10px", lineHeight: "27px" };
const body2: React.CSSProperties = { color: "#a1a1aa", fontSize: 14, lineHeight: "22px", margin: "0 0 10px" };
const divider: React.CSSProperties = { borderColor: "#1f1f1f", margin: 0 };
const statsSection: React.CSSProperties = { padding: "24px 40px", textAlign: "center" };
const statsLabel: React.CSSProperties = { color: "#52525b", fontSize: 11, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px" };
const winsNum: React.CSSProperties = { color: "#00dc82", fontSize: 32, fontWeight: 900 };
const dash: React.CSSProperties = { color: "#3f3f46", fontSize: 24 };
const lossesNum: React.CSSProperties = { color: "#f87171", fontSize: 32, fontWeight: 900 };
const rateNum: React.CSSProperties = { color: "#ffffff", fontSize: 24, fontWeight: 700 };
const statsNote: React.CSSProperties = { color: "#3f3f46", fontSize: 11, margin: "8px 0 0", lineHeight: "16px" };
const ctaSection: React.CSSProperties = { padding: "28px 40px", textAlign: "center" };
const ctaHeading: React.CSSProperties = { color: "#ffffff", fontSize: 17, fontWeight: 700, margin: "0 0 10px" };
const ctaButton: React.CSSProperties = { backgroundColor: "#00dc82", color: "#070d1a", fontSize: 14, fontWeight: 700, padding: "11px 26px", borderRadius: 8, textDecoration: "none", display: "inline-block", margin: "8px 0 6px" };
const footnote: React.CSSProperties = { color: "#52525b", fontSize: 11, margin: "4px 0 0" };
const signoff: React.CSSProperties = { color: "#71717a", fontSize: 14, margin: "10px 0 0", fontStyle: "italic" };
const footer: React.CSSProperties = { padding: "20px 40px" };
const footerText: React.CSSProperties = { color: "#3f3f46", fontSize: 11, lineHeight: "17px", margin: 0, textAlign: "center" };
