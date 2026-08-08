import {
  Body, Button, Container, Head, Hr, Html, Preview, Section, Text,
} from "@react-email/components";
import * as React from "react";

interface Pick {
  event: string;
  platform: string;
  grade: string;
  recommendation: string;
}

interface FreeUserNurtureEmailProps {
  picks: Pick[];
  analysisGrade?: string;
  firstName?: string;
}

export default function FreeUserNurtureEmail({ picks, analysisGrade, firstName }: FreeUserNurtureEmailProps) {
  const greeting = firstName ? `Hey ${firstName}` : "Hey";

  return (
    <Html>
      <Head />
      <Preview>You ran your free analysis — here's what you're missing on the other side.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>FadeMe.ai</Text>
            <Text style={tagline}>You left some edge on the table</Text>
          </Section>

          <Section style={section}>
            <Text style={h2}>{greeting}. You ran your free analysis yesterday.</Text>
            {analysisGrade && (
              <Text style={body2}>
                Your bet came back a <strong style={{ color: "#ffffff" }}>Grade {analysisGrade}</strong>.
                Hope you made a good call with it.
              </Text>
            )}
            <Text style={body2}>
              What you got yesterday was one analysis. What subscribers get every day is our AI
              scanning hundreds of markets before they wake up and dropping only the highest-edge
              plays straight to their inbox.
            </Text>
            <Text style={body2}>
              Here&apos;s what today&apos;s slate looks like:
            </Text>
          </Section>

          <Hr style={divider} />

          {picks.slice(0, 3).map((pick, i) => (
            <Section key={i} style={pickRow}>
              <table width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td>
                      <Text style={pickEvent}>{pick.event}</Text>
                      <Text style={pickMeta}>{pick.platform}</Text>
                    </td>
                    <td align="right" style={{ verticalAlign: "middle" }}>
                      <span style={gradeBadge}>{pick.grade}</span>
                      <span style={{ ...recBadge, color: pick.recommendation === "BUY" ? "#00dc82" : "#f87171" }}>
                        {pick.recommendation}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          ))}

          <Section style={blurSection}>
            <Text style={blurText}>+ full edge scores, bull/bear cases, key risks on each</Text>
          </Section>

          <Hr style={divider} />

          <Section style={ctaSection}>
            <Text style={ctaHeading}>Unlock everything for $1 this week.</Text>
            <Text style={body2}>
              Full analysis on any bet you want to run. Daily picks in your inbox. AI coach that
              thinks like a sharp. If it doesn&apos;t pay for itself, cancel before day 8.
              You&apos;re out a dollar.
            </Text>
            <Button style={ctaButton} href="https://www.fademe.ai/analyze">
              Start for $1 →
            </Button>
            <Text style={footnote}>Then $19.99/month. Cancel anytime.</Text>
          </Section>

          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              You created a FadeMe account and used a free analysis.
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
const gradeBadge: React.CSSProperties = { color: "#00dc82", fontSize: 13, fontWeight: 900, marginRight: "8px" };
const recBadge: React.CSSProperties = { fontSize: 11, fontWeight: 700 };
const blurSection: React.CSSProperties = { padding: "12px 40px", backgroundColor: "#0d0d0d" };
const blurText: React.CSSProperties = { color: "#3f3f46", fontSize: 12, margin: 0, fontStyle: "italic" };
const ctaSection: React.CSSProperties = { padding: "28px 40px", textAlign: "center" };
const ctaHeading: React.CSSProperties = { color: "#ffffff", fontSize: 17, fontWeight: 700, margin: "0 0 10px" };
const ctaButton: React.CSSProperties = { backgroundColor: "#00dc82", color: "#070d1a", fontSize: 14, fontWeight: 700, padding: "11px 26px", borderRadius: 8, textDecoration: "none", display: "inline-block", margin: "8px 0 6px" };
const footnote: React.CSSProperties = { color: "#52525b", fontSize: 11, margin: "4px 0 0" };
const footer: React.CSSProperties = { padding: "20px 40px" };
const footerText: React.CSSProperties = { color: "#3f3f46", fontSize: 11, lineHeight: "17px", margin: 0, textAlign: "center" };
