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
  category: string;
  grade: string;
  grade_label: string;
  edge_score: number;
  recommendation: string;
  recommendation_reason: string;
  summary: string;
}

interface DailyPicksEmailProps {
  picks: Pick[];
  dateLabel: string;
}

const gradeColor = (grade: string) => (grade === "S" ? "#22c55e" : "#86efac");

export default function DailyPicksEmail({ picks, dateLabel }: DailyPicksEmailProps) {
  const topPick = picks[0];

  return (
    <Html>
      <Head />
      <Preview>
        {String(picks.length)} AI picks for {dateLabel} — top play: {topPick?.event ?? "See inside"}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>FadeMe.ai</Text>
            <Text style={tagline}>Daily Picks Digest</Text>
            <Text style={dateText}>{dateLabel}</Text>
          </Section>

          {/* Intro */}
          <Section style={section}>
            <Text style={intro}>
              Your AI-powered prediction market edge for today. {picks.length} high-conviction plays
              identified across politics, sports, and finance.
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
                      <Text style={pickNumber}>#{i + 1}</Text>
                    </td>
                    <td align="right">
                      <span style={{ ...gradeBadge, backgroundColor: gradeColor(pick.grade) }}>
                        {pick.grade} · {pick.grade_label}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <Text style={pickEvent}>{pick.event}</Text>

              <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 12 }}>
                <tbody>
                  <tr>
                    <td>
                      <Text style={metaLabel}>Platform</Text>
                      <Text style={metaValue}>{pick.platform}</Text>
                    </td>
                    <td>
                      <Text style={metaLabel}>Position</Text>
                      <Text style={metaValue}>{pick.position}</Text>
                    </td>
                    <td>
                      <Text style={metaLabel}>Odds</Text>
                      <Text style={metaValue}>{pick.odds}</Text>
                    </td>
                    <td>
                      <Text style={metaLabel}>Category</Text>
                      <Text style={metaValue}>{pick.category}</Text>
                    </td>
                  </tr>
                </tbody>
              </table>

              <Text style={{ ...recLabel, color: pick.recommendation === "BUY" ? "#22c55e" : "#f87171" }}>
                {pick.recommendation} · {pick.recommendation_reason}
              </Text>

              <Text style={summaryText}>{pick.summary}</Text>

              <Text style={edgeText}>Edge Score: {String(pick.edge_score)}/100</Text>
            </Section>
          ))}

          <Hr style={divider} />

          {/* CTA */}
          <Section style={ctaSection}>
            <Text style={ctaText}>View full analysis with bull/bear cases and key risks</Text>
            <Button style={ctaButton} href="https://www.fademe.ai/picks">
              See Full Picks →
            </Button>
          </Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this because you're a FadeMe.ai subscriber.
            </Text>
            <Text style={footerText}>
              These are not financial recommendations. Prediction markets carry risk.
            </Text>
            <Text style={footerText}>
              To stop receiving these emails,{" "}
              <a href="https://www.fademe.ai/analyze" style={footerLink}>manage your subscription</a>{" "}
              and cancel at any time.
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
  maxWidth: 600,
  margin: "0 auto",
  padding: "0 0 40px",
};

const header: React.CSSProperties = {
  backgroundColor: "#111111",
  padding: "32px 40px 24px",
  borderBottom: "1px solid #1f1f1f",
};

const logo: React.CSSProperties = {
  color: "#22c55e",
  fontSize: 22,
  fontWeight: 700,
  margin: "0 0 4px",
  letterSpacing: "-0.5px",
};

const tagline: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 13,
  margin: "0 0 8px",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

const dateText: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 24,
  fontWeight: 700,
  margin: 0,
};

const section: React.CSSProperties = {
  padding: "20px 40px",
};

const intro: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 15,
  lineHeight: "24px",
  margin: 0,
};

const divider: React.CSSProperties = {
  borderColor: "#1f1f1f",
  margin: 0,
};

const pickCard: React.CSSProperties = {
  padding: "24px 40px",
  borderBottom: "1px solid #1f1f1f",
};

const pickNumber: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: 13,
  fontWeight: 700,
  margin: "0 0 8px",
};

const gradeBadge: React.CSSProperties = {
  color: "#000000",
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 10px",
  borderRadius: 20,
  letterSpacing: "0.5px",
};

const pickEvent: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 17,
  fontWeight: 600,
  lineHeight: "24px",
  margin: "8px 0 16px",
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
  margin: "0 0 0",
};

const recLabel: React.CSSProperties = {
  color: "#22c55e",
  fontSize: 13,
  fontWeight: 600,
  margin: "12px 0 8px",
};

const summaryText: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 14,
  lineHeight: "22px",
  margin: "0 0 12px",
};

const edgeText: React.CSSProperties = {
  color: "#52525b",
  fontSize: 12,
  margin: 0,
};

const ctaSection: React.CSSProperties = {
  padding: "32px 40px",
  textAlign: "center",
};

const ctaText: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 14,
  margin: "0 0 16px",
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#22c55e",
  color: "#000000",
  fontSize: 14,
  fontWeight: 700,
  padding: "12px 28px",
  borderRadius: 8,
  textDecoration: "none",
};

const footer: React.CSSProperties = {
  padding: "24px 40px",
};

const footerText: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: 12,
  lineHeight: "18px",
  margin: "0 0 4px",
  textAlign: "center",
};

const footerLink: React.CSSProperties = {
  color: "#52525b",
};
