import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface Pick {
  platform: string;
  event: string;
  position: string;
  odds: string;
  implied_probability: number;
  grade: string;
  recommendation: string;
  recommendation_reason: string;
}

interface FreePicksEmailProps {
  picks: Pick[];
  dateLabel: string;
}

const gradeColor = (grade: string): string => {
  if (grade === "S") return "#00dc82";
  if (grade === "A") return "#00c86e";
  if (grade === "B") return "#60a5fa";
  return "#facc15";
};

export default function FreePicksEmail({ picks, dateLabel }: FreePicksEmailProps) {
  const topPick = picks[0];

  return (
    <Html>
      <Head />
      <Preview>
        {`${picks.length} AI picks for ${dateLabel} — ${topPick?.event ?? "see inside"}. Track how they perform all week.`}
      </Preview>
      <Body style={body}>
        <Container style={container}>

          {/* Header */}
          <Section style={header}>
            <Text style={logo}>FadeMe.ai</Text>
            <Text style={tagline}>Free Weekly Picks</Text>
            <Text style={dateText}>{dateLabel}</Text>
          </Section>

          {/* Intro */}
          <Section style={section}>
            <Heading style={h2}>Here are your {picks.length} free AI picks.</Heading>
            <Text style={body2}>
              No credit card. No catch. We&apos;re sending you exactly what our AI is calling this week
              — grades, positions, and reasoning — so you can see for yourself if this is worth your time.
            </Text>
            <Text style={body2}>
              Every pick gets tracked publicly. Come back later this week and see how we did.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Picks */}
          {picks.map((pick, i) => (
            <Section key={i} style={pickCard}>
              <table width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td>
                      <Text style={pickNum}>Pick #{i + 1}</Text>
                    </td>
                    <td align="right">
                      <span style={{ ...gradeBadge, color: gradeColor(pick.grade), borderColor: gradeColor(pick.grade) }}>
                        Grade {pick.grade}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <Text style={pickEvent}>{pick.event}</Text>

              <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: "14px" }}>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: "16px" }}>
                      <Text style={metaLabel}>Platform</Text>
                      <Text style={metaValue}>{pick.platform}</Text>
                    </td>
                    <td style={{ paddingRight: "16px" }}>
                      <Text style={metaLabel}>Position</Text>
                      <Text style={metaValue}>{pick.position}</Text>
                    </td>
                    {pick.odds && (
                      <td>
                        <Text style={metaLabel}>Odds</Text>
                        <Text style={metaValue}>{pick.odds}</Text>
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>

              <Text style={{ ...recTag, color: pick.recommendation === "BUY" ? "#00dc82" : "#f87171" }}>
                {pick.recommendation} — {pick.recommendation_reason}
              </Text>
            </Section>
          ))}

          <Hr style={divider} />

          {/* Track results CTA */}
          <Section style={section}>
            <Text style={trackLabel}>See how these picks actually perform →</Text>
            <Text style={body2}>
              Every call we make is logged and verified by Kalshi and Polymarket&apos;s own settlement
              APIs — not by us. Hit the button to see our full win/loss record.
            </Text>
            <Button style={secondaryButton} href="https://www.fademe.ai/record">
              View Our Track Record
            </Button>
          </Section>

          <Hr style={divider} />

          {/* Upgrade CTA */}
          <Section style={ctaSection}>
            <Text style={ctaHeading}>Want this every morning?</Text>
            <Text style={body2}>
              Subscribers get the full picks daily — edge scores, bull &amp; bear cases, key risks,
              and AI analysis on every bet they want to place. First week is $1.
            </Text>
            <Button style={ctaButton} href="https://www.fademe.ai/analyze">
              Start for $1 →
            </Button>
            <Text style={ctaFootnote}>Then $19.99/month. Cancel anytime.</Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You&apos;re receiving this because you signed up for free picks at fademe.ai.
            </Text>
            <Text style={footerText}>
              Not financial advice. Prediction markets carry real risk.
            </Text>
            <Text style={footerText}>
              <a href="https://www.fademe.ai" style={footerLink}>fademe.ai</a>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

/* ── Styles ── */

const body: React.CSSProperties = {
  backgroundColor: "#0a0a0a",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: 580,
  margin: "0 auto",
  padding: "0 0 40px",
};

const header: React.CSSProperties = {
  backgroundColor: "#0f0f0f",
  padding: "32px 40px 24px",
  borderBottom: "1px solid #1f1f1f",
};

const logo: React.CSSProperties = {
  color: "#00dc82",
  fontSize: 20,
  fontWeight: 700,
  margin: "0 0 4px",
  letterSpacing: "-0.5px",
};

const tagline: React.CSSProperties = {
  color: "#52525b",
  fontSize: 11,
  margin: "0 0 8px",
  textTransform: "uppercase",
  letterSpacing: "1.5px",
};

const dateText: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 22,
  fontWeight: 700,
  margin: 0,
};

const section: React.CSSProperties = {
  padding: "24px 40px",
};

const h2: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 20,
  fontWeight: 700,
  margin: "0 0 12px",
  lineHeight: "28px",
};

const body2: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 14,
  lineHeight: "22px",
  margin: "0 0 10px",
};

const divider: React.CSSProperties = {
  borderColor: "#1f1f1f",
  margin: 0,
};

const pickCard: React.CSSProperties = {
  padding: "22px 40px",
  borderBottom: "1px solid #1a1a1a",
};

const pickNum: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "1px",
  margin: "0 0 6px",
};

const gradeBadge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 10px",
  borderRadius: 20,
  border: "1px solid",
  letterSpacing: "0.5px",
};

const pickEvent: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 600,
  lineHeight: "23px",
  margin: "6px 0 14px",
};

const metaLabel: React.CSSProperties = {
  color: "#52525b",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  margin: "0 0 2px",
};

const metaValue: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 13,
  fontWeight: 500,
  margin: 0,
};

const recTag: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  margin: 0,
  lineHeight: "20px",
};

const trackLabel: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 600,
  margin: "0 0 8px",
};

const secondaryButton: React.CSSProperties = {
  backgroundColor: "transparent",
  color: "#00dc82",
  fontSize: 13,
  fontWeight: 600,
  padding: "10px 22px",
  borderRadius: 8,
  border: "1px solid #00dc82",
  textDecoration: "none",
  display: "inline-block",
};

const ctaSection: React.CSSProperties = {
  padding: "28px 40px",
  textAlign: "center",
};

const ctaHeading: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 18,
  fontWeight: 700,
  margin: "0 0 10px",
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#00dc82",
  color: "#070d1a",
  fontSize: 14,
  fontWeight: 700,
  padding: "12px 28px",
  borderRadius: 8,
  textDecoration: "none",
  display: "inline-block",
  margin: "8px 0 6px",
};

const ctaFootnote: React.CSSProperties = {
  color: "#52525b",
  fontSize: 11,
  margin: "4px 0 0",
};

const footer: React.CSSProperties = {
  padding: "24px 40px",
};

const footerText: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: 11,
  lineHeight: "17px",
  margin: "0 0 3px",
  textAlign: "center",
};

const footerLink: React.CSSProperties = {
  color: "#52525b",
};
