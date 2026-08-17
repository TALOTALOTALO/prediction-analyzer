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

interface AnalyzerPitchEmailProps {
  firstName?: string;
  picks?: Pick[];
  wins: number;
  losses: number;
  winRate: number | null;
}

const gradeColor = (grade: string): string => {
  if (grade === "S") return "#00dc82";
  if (grade === "A") return "#00c86e";
  if (grade === "B") return "#60a5fa";
  return "#facc15";
};

export default function AnalyzerPitchEmail({ firstName, picks = [], wins, losses, winRate }: AnalyzerPitchEmailProps) {
  const greeting = firstName ? `Hey ${firstName}` : "Hey";

  return (
    <Html>
      <Head />
      <Preview>Snap a photo of any bet. Get an AI grade in 10 seconds. Here's how it works.</Preview>
      <Body style={body}>
        <Container style={container}>

          <Section style={header}>
            <Text style={logo}>FadeMe.ai</Text>
            <Text style={tagline}>Analyze your own bets</Text>
          </Section>

          <Section style={section}>
            <Text style={greeting_style}>{greeting},</Text>

            <Text style={p}>
              You&apos;ve been getting our picks all week. Here&apos;s what most people
              don&apos;t realize: the same AI we use to find edges in the market can
              grade <em>your</em> bets too.
            </Text>

            <Text style={p}>
              Before you pull the trigger on a trade, you can screenshot it —
              or paste the URL — and get back a full breakdown in about 10 seconds.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={section}>
            <Text style={h2}>What you get on every bet you analyze:</Text>

            {[
              { label: "Grade S–F", desc: "based on edge between market price and true probability" },
              { label: "BUY / FADE / HOLD", desc: "clear recommendation with reasoning" },
              { label: "Bull case & bear case", desc: "what has to go right, and what can go wrong" },
              { label: "Key risks", desc: "the 3 things most likely to kill the trade" },
              { label: "Edge score", desc: "exactly how much value the market is leaving on the table" },
            ].map(({ label, desc }) => (
              <div key={label}>
                <Text style={featureRow}>
                  <span style={featureLabel}>{label}</span>
                  <span style={featureDesc}> — {desc}</span>
                </Text>
              </div>
            ))}
          </Section>

          <Hr style={divider} />

          {/* Track record teaser */}
          {(wins > 0 || losses > 0) && (
            <>
              <Section style={recordSection}>
                <Text style={recordLabel}>Our public track record this week</Text>
                <table width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td align="center" style={{ paddingRight: 24 }}>
                        <Text style={statNum_green}>{wins}W</Text>
                        <Text style={statLabel}>Wins</Text>
                      </td>
                      <td align="center" style={{ paddingRight: 24 }}>
                        <Text style={statNum_red}>{losses}L</Text>
                        <Text style={statLabel}>Losses</Text>
                      </td>
                      {winRate !== null && (
                        <td align="center">
                          <Text style={statNum_white}>{winRate}%</Text>
                          <Text style={statLabel}>Win Rate</Text>
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
                <Text style={recordFootnote}>
                  Every result is verified by Kalshi &amp; Polymarket&apos;s settlement APIs.
                  Not cherry-picked. Not us.
                </Text>
              </Section>
              <Hr style={divider} />
            </>
          )}

          {/* Today's picks teaser */}
          {picks.length > 0 && (
            <>
              <Section style={section}>
                <Text style={h2}>Today&apos;s top picks — what the AI is calling right now:</Text>
                {picks.slice(0, 3).map((pick, i) => (
                  <div key={i} style={pickRow}>
                    <table width="100%" cellPadding={0} cellSpacing={0}>
                      <tbody>
                        <tr>
                          <td>
                            <Text style={pickEvent}>{pick.event}</Text>
                            <Text style={pickMeta}>{pick.platform} · {pick.recommendation}</Text>
                          </td>
                          <td align="right" style={{ verticalAlign: "top", paddingTop: 2 }}>
                            <span style={{ ...gradeBadge, color: gradeColor(pick.grade), borderColor: gradeColor(pick.grade) }}>
                              {pick.grade}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
                <Text style={blurredNote}>
                  Full edge scores, reasoning, and risk breakdowns are unlocked for subscribers.
                </Text>
              </Section>
              <Hr style={divider} />
            </>
          )}

          <Section style={ctaSection}>
            <Text style={ctaHeading}>Try the analyzer free — first week is $1.</Text>
            <Text style={p}>
              Analyze unlimited bets. Get daily picks with full breakdowns.
              Portfolio tracking, parlay builder, AI coach. Everything for $1 to start.
            </Text>
            <Button style={ctaButton} href="https://www.fademe.ai/analyze">
              Analyze your first bet →
            </Button>
            <Text style={ctaFootnote}>$1 for your first week, then $19.99/mo. Cancel anytime.</Text>
          </Section>

          <Hr style={divider} />

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
  margin: 0,
  textTransform: "uppercase",
  letterSpacing: "1.5px",
};

const section: React.CSSProperties = {
  padding: "24px 40px",
};

const greeting_style: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 600,
  margin: "0 0 16px",
};

const p: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 15,
  lineHeight: "24px",
  margin: "0 0 14px",
};

const h2: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 18,
  fontWeight: 700,
  margin: "0 0 12px",
  lineHeight: "26px",
};

const divider: React.CSSProperties = {
  borderColor: "#1f1f1f",
  margin: 0,
};

const featureRow: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 14,
  lineHeight: "22px",
  margin: "0 0 8px",
  paddingLeft: 12,
  borderLeft: "2px solid #1f1f1f",
};

const featureLabel: React.CSSProperties = {
  color: "#ffffff",
  fontWeight: 600,
};

const featureDesc: React.CSSProperties = {
  color: "#71717a",
};

const recordSection: React.CSSProperties = {
  padding: "24px 40px",
  backgroundColor: "#0d0d0d",
  textAlign: "center",
};

const recordLabel: React.CSSProperties = {
  color: "#52525b",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "1px",
  margin: "0 0 16px",
};

const statNum_green: React.CSSProperties = {
  color: "#00dc82",
  fontSize: 28,
  fontWeight: 900,
  margin: "0 0 2px",
  lineHeight: "1",
};

const statNum_red: React.CSSProperties = {
  color: "#f87171",
  fontSize: 28,
  fontWeight: 900,
  margin: "0 0 2px",
  lineHeight: "1",
};

const statNum_white: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 28,
  fontWeight: 900,
  margin: "0 0 2px",
  lineHeight: "1",
};

const statLabel: React.CSSProperties = {
  color: "#52525b",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  margin: 0,
};

const recordFootnote: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: 11,
  margin: "16px 0 0",
  lineHeight: "16px",
};

const pickRow: React.CSSProperties = {
  marginBottom: 12,
  paddingBottom: 12,
  borderBottom: "1px solid #1a1a1a",
};

const pickEvent: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 600,
  margin: "0 0 3px",
  lineHeight: "20px",
};

const pickMeta: React.CSSProperties = {
  color: "#52525b",
  fontSize: 11,
  margin: 0,
};

const gradeBadge: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: "2px 9px",
  borderRadius: 20,
  border: "1px solid",
};

const blurredNote: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: 11,
  fontStyle: "italic",
  margin: "8px 0 0",
};

const ctaSection: React.CSSProperties = {
  padding: "28px 40px",
  textAlign: "center",
};

const ctaHeading: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 18,
  fontWeight: 700,
  margin: "0 0 12px",
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
  margin: "6px 0 0",
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
