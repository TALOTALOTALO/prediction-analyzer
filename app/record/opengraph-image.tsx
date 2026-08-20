import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSupabase } from "@/lib/supabase";

export const alt = "FadeMe AI Track Record";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const logoData = await readFile(join(process.cwd(), "public/logo-icon.png"), "base64");
const logoSrc = `data:image/png;base64,${logoData}`;

export default async function Image() {
  const supabase = getSupabase();
  const { data: picks } = await supabase
    .from("daily_picks")
    .select("result")
    .not("result", "is", null)
    .not("market_id", "is", null);

  const wins = picks?.filter((p) => p.result === "won").length ?? 0;
  const losses = picks?.filter((p) => p.result === "lost").length ?? 0;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#070d1a",
          display: "flex",
          flexDirection: "column",
          padding: "56px 80px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 0 }}>
          <img src={logoSrc} width={44} height={44} />
          <span style={{ color: "#ffffff", fontSize: 26, fontWeight: 700 }}>FadeMe</span>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              background: "rgba(0,220,130,0.12)",
              border: "1px solid rgba(0,220,130,0.35)",
              borderRadius: 6,
              padding: "4px 14px",
            }}
          >
            <span style={{ color: "#00dc82", fontSize: 14, fontWeight: 600 }}>
              VERIFIED RECORD
            </span>
          </div>
        </div>

        {/* Main Stats */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flex: 1,
            justifyContent: "center",
            gap: 20,
          }}
        >
          {/* W-L */}
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <span
              style={{
                color: "#00dc82",
                fontSize: 108,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {wins}W
            </span>
            <span
              style={{
                color: "rgba(255,255,255,0.2)",
                fontSize: 64,
                fontWeight: 300,
                lineHeight: 1,
              }}
            >
              —
            </span>
            <span
              style={{
                color: "#ef4444",
                fontSize: 108,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {losses}L
            </span>
          </div>

          {/* Win Rate badge */}
          {winRate !== null && (
            <div
              style={{
                display: "flex",
                background: "rgba(0,220,130,0.08)",
                border: "1px solid rgba(0,220,130,0.25)",
                borderRadius: 12,
                padding: "12px 40px",
              }}
            >
              <span style={{ color: "#00dc82", fontSize: 40, fontWeight: 700 }}>
                {winRate}% Win Rate
              </span>
            </div>
          )}

          <span
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 20,
              textAlign: "center",
            }}
          >
            Every pick verified by Kalshi &amp; Polymarket settlement APIs
          </span>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 17 }}>
            fademe.ai/record
          </span>
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 17 }}>
            {total} picks tracked
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
