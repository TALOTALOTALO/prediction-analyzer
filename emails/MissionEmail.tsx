import {
  Body, Button, Container, Head, Hr, Html, Preview, Section, Text,
} from "@react-email/components";
import * as React from "react";

interface MissionEmailProps {
  firstName?: string;
}

export default function MissionEmail({ firstName }: MissionEmailProps) {
  const greeting = firstName ? `Hey ${firstName}` : "Hey";

  return (
    <Html>
      <Head />
      <Preview>Prediction markets were built to take your money. Here's the receipts — and what we're doing about it.</Preview>
      <Body style={body}>
        <Container style={container}>

          <Section style={header}>
            <Text style={logo}>FadeMe.ai</Text>
            <Text style={tagline}>Why we built this</Text>
          </Section>

          <Section style={section}>
            <Text style={greeting_style}>{greeting},</Text>

            <Text style={p}>
              Yesterday you signed up for free picks. Today I want to tell you why FadeMe exists —
              because if you&apos;ve ever lost money on a prediction market bet you thought was a lock,
              this might sound familiar.
            </Text>

            <Text style={pullquote}>
              "Prediction markets are efficient."
            </Text>

            <Text style={p}>
              That&apos;s what they&apos;ll tell you. And in the long run, for big liquid markets,
              it&apos;s roughly true. But in the short run — on the hundreds of smaller markets that
              open every day on Kalshi and Polymarket — there are real, exploitable gaps between what
              the market thinks will happen and what the data says.
            </Text>

            <Text style={p}>
              The problem is: retail traders are the last to find them.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={section}>
            <Text style={h2}>The deck is stacked against you.</Text>

            <Text style={p}>
              Market makers on these platforms are running algorithms. Professional traders have
              Bloomberg terminals, early access to data feeds, and teams of analysts. News reaches
              their models before it reaches your timeline.
            </Text>

            <Text style={p}>
              The retail trader — you, betting on who wins the next Fed vote or whether some tech
              CEO is getting fired — is almost always trading on vibes, not edge.
            </Text>

            <Text style={p}>
              That&apos;s not your fault. It&apos;s just how these markets were designed.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={section}>
            <Text style={h2}>Here&apos;s what edge actually looks like.</Text>

            <Text style={p}>
              Edge isn&apos;t a gut feeling. It&apos;s math.
            </Text>

            <Text style={p}>
              A market has edge when the true probability of an outcome is meaningfully different
              from the implied probability baked into the price. If a contract is trading at 35¢
              but the real probability of it resolving YES is 52%, that&apos;s 17 percentage points
              of edge. That&apos;s a Grade S pick.
            </Text>

            <Text style={p}>
              Finding those gaps manually — across hundreds of markets, every morning, before they
              close — is a full-time job. Our AI does it in minutes.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={section}>
            <Text style={h2}>We don&apos;t hide our losses.</Text>

            <Text style={p}>
              Every pick FadeMe makes is logged publicly. Wins and losses. Grades. Reasoning.
              All of it verified by Kalshi and Polymarket&apos;s own settlement APIs — not by us.
            </Text>

            <Text style={p}>
              We think that&apos;s the only honest way to do this. If the AI is wrong, you should
              know. If it&apos;s right, you should be able to verify it independently.
            </Text>

            <Button style={ctaButton} href="https://www.fademe.ai/record">
              See our full track record →
            </Button>

            <Text style={footnote}>Every win. Every loss. All verified.</Text>
          </Section>

          <Hr style={divider} />

          <Section style={section}>
            <Text style={p}>
              Tomorrow you&apos;ll get an update on the picks we sent you — whether they hit or not.
              That&apos;s the real test.
            </Text>

            <Text style={p}>Talk soon,</Text>
            <Text style={sig}>The FadeMe Team</Text>
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

const pullquote: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 16,
  fontStyle: "italic",
  borderLeft: "3px solid #00dc82",
  paddingLeft: 16,
  margin: "4px 0 14px",
  lineHeight: "24px",
};

const divider: React.CSSProperties = {
  borderColor: "#1f1f1f",
  margin: 0,
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#00dc82",
  color: "#070d1a",
  fontSize: 14,
  fontWeight: 700,
  padding: "12px 24px",
  borderRadius: 8,
  textDecoration: "none",
  display: "inline-block",
  margin: "4px 0 8px",
};

const footnote: React.CSSProperties = {
  color: "#52525b",
  fontSize: 11,
  margin: "4px 0 0",
};

const sig: React.CSSProperties = {
  color: "#00dc82",
  fontSize: 15,
  fontWeight: 600,
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
