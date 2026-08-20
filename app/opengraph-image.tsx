import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "FadeMe — Analyze. Predict. Fade.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoData = await readFile(join(process.cwd(), "public/logo-icon.png"), "base64");
const logoSrc = `data:image/png;base64,${logoData}`;

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#070d1a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          position: "relative",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,220,130,0.07) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
          }}
        />

        {/* Logo + Name */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={logoSrc} width={80} height={80} />
          <span
            style={{ color: "#ffffff", fontSize: 72, fontWeight: 800, lineHeight: 1 }}
          >
            FadeMe
          </span>
        </div>

        {/* Tagline */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {["Analyze.", "Predict.", "Fade."].map((word, i) => (
            <span
              key={i}
              style={{
                color: i === 2 ? "#00dc82" : "rgba(255,255,255,0.65)",
                fontSize: 38,
                fontWeight: i === 2 ? 700 : 400,
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* Description */}
        <span
          style={{
            color: "rgba(255,255,255,0.38)",
            fontSize: 22,
            textAlign: "center",
            maxWidth: 680,
          }}
        >
          AI-powered prediction market grader for Kalshi, Polymarket &amp; PredictIt
        </span>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: 12 }}>
          {["Screenshot Analysis", "Daily AI Picks", "Track Record", "Parlay Builder"].map(
            (f) => (
              <div
                key={f}
                style={{
                  display: "flex",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 20,
                  padding: "8px 20px",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 16 }}>{f}</span>
              </div>
            )
          )}
        </div>

        {/* Bottom URL */}
        <span
          style={{
            position: "absolute",
            bottom: 40,
            color: "rgba(255,255,255,0.2)",
            fontSize: 18,
          }}
        >
          fademe.ai
        </span>
      </div>
    ),
    { ...size }
  );
}
