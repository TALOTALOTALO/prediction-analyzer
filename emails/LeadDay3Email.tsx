import {
  Body, Button, Container, Head, Hr, Html, Preview, Section, Text,
} from "@react-email/components";
import * as React from "react";

interface Pick {
  event: string;
  platform: string;
  recommendation: string;
  result: "won" | "lost" | "void" | null;
}

interface LeadDay3EmailProps {
  picks: Pick[];
  dateLabel: string;
}

export default function LeadDay3Email({ picks, dateLabel }: LeadDay3EmailProps) {
  const resolved = picks.filter((p) => p.result !== null);
  const wins = picks.filter((p) => p.result === "won").length;
  const losses = picks.filter((p) => p.result === "lost").length;

  return (
    <Html>
      <Head />
      <Preview>{`Update on the picks we sent you${resolved.length > 0 ? ` — ${wins}W ${losses}L so far` : " — still live"}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>FadeMe.ai</Text>
            <Text style={tagline}>Picks Update · {dateLabel}</Text>
          </Section>

          <Section style={section}>
            <Text style={h2}>Quick update on those picks we sent you.</Text>
            <Text style={body2}>
              A few days ago we sent you our AI&apos;s top calls. Here&apos;s where things stand.
            </Text>
          </Section>

          <Hr style={divider} />

          {picks.map((pick, i) => (
            <Section key={i} style={pickRow}>
              <table width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td style={{ width: "75%" }}>
                      <Text style={pickEvent}>{pick.event}</Text>
                      <Text style={pickMeta}>{pick.platform} · {pick.recommendation}</Text>
                    </td>
                    <td align="right" style={{ verticalAlign: "middle" }}>
                      {pick.result === "won" && (
                        <span style={{ ...resultBadge, color: "#00dc82", borderColor: "#00dc82" }}>Won ✓</span>
                      )}
                      {pick.result === "lost" && (
                        <span style={{ ...resultBadge, color: "#f87171", borderColor: "#f87171" }}>Lost</span>
                      )}
                      {pick.result === "void" && (
                        <span style={{ ...resultBadge, color: "#71717a", borderColor: "#71717a" }}>Void</span>
                      )}
                      {pick.result === null && (
                        <span style={{ ...resultBadge, color: "#52525b", borderColor: "#3f3f46" }}>Live</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          ))}

          <Hr style={divider} />

          <Section style={section}>
            {resolved.length > 0 ? (
              <Text style={body2}>
                {wins > 0 && losses === 0 && `${wins} for ${wins} so far. The AI's been on it.`}
                {wins > 0 && losses > 0 && `${wins}W - ${losses}L. Not perfect — nobody is. But that's the game.`}
                {wins === 0 && losses > 0 && `${losses} didn't land. It happens. The edge plays out over time, not pick by pick.`}
              </Text>
            ) : (
              <Text style={body2}>
                Still live — no outcomes yet. We&apos;ll keep tracking.
              </Text>
            )}
            <Text style={body2}>
              Every call we&apos;ve ever made is logged publicly at fademe.ai/record. Wins, losses, all of it.
              We don&apos;t hide the bad ones.
            </Text>
            <Button style={secondaryButton} href="https://www.fademe.ai/record">
              See the full record →
            </Button>
          </Section>

          <Hr style={divider} />

          <Section style={ctaSection}>
            <Text style={ctaHeading}>Want fresh picks every morning?</Text>
            <Text style={body2}>
              Subscribers get our AI&apos;s daily calls with full edge scores, bull &amp; bear cases, and
              analysis on any bet they want to place. First week is $1.
            </Text>
            <Button style={ctaButton} href="https://www.fademe.ai/analyze">
              Start for $1 →
            </Button>
            <Text style={footnote}>Then $19.99/month. Cancel anytime.</Text>
          </Section>

          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              You signed up for free picks at fademe.ai.
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
const pickRow: React.CSSProperties = { padding: "14px 40px", borderBottom: "1px solid #1a1a1a" };
const pickEvent: React.CSSProperties = { color: "#ffffff", fontSize: 14, fontWeight: 600, margin: "0 0 2px", lineHeight: "20px" };
const pickMeta: React.CSSProperties = { color: "#52525b", fontSize: 12, margin: 0 };
const resultBadge: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, border: "1px solid", letterSpacing: "0.5px" };
const ctaSection: React.CSSProperties = { padding: "28px 40px", textAlign: "center" };
const ctaHeading: React.CSSProperties = { color: "#ffffff", fontSize: 17, fontWeight: 700, margin: "0 0 10px" };
const ctaButton: React.CSSProperties = { backgroundColor: "#00dc82", color: "#070d1a", fontSize: 14, fontWeight: 700, padding: "11px 26px", borderRadius: 8, textDecoration: "none", display: "inline-block", margin: "8px 0 6px" };
const secondaryButton: React.CSSProperties = { backgroundColor: "transparent", color: "#00dc82", fontSize: 13, fontWeight: 600, padding: "9px 20px", borderRadius: 8, border: "1px solid #00dc82", textDecoration: "none", display: "inline-block" };
const footnote: React.CSSProperties = { color: "#52525b", fontSize: 11, margin: "4px 0 0" };
const footer: React.CSSProperties = { padding: "20px 40px" };
const footerText: React.CSSProperties = { color: "#3f3f46", fontSize: 11, lineHeight: "17px", margin: 0, textAlign: "center" };
