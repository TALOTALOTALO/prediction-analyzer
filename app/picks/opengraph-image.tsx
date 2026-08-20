import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSupabase } from "@/lib/supabase";

export const alt = "Today's AI Prediction Market Picks — FadeMe";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const logoData = await readFile(join(process.cwd(), "public/logo-icon.png"), "base64");
const logoSrc = `data:image/png;base64,${logoData}`;

const GRADE_COLOR: Record<string, string> = {
  S: "#00dc82",
  A: "#00c86e",
  B: "#3b82f6",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};

const GRADE_ORDER = ["S", "A", "B", "C", "D", "F"];

export default async function Image() {
  const supabase = getSupabase();

  const { data: latest } = await supabase
    .from("daily_picks")
    .select("pick_date")
    .order("pick_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const today = (latest?.pick_date as string) ?? null;

  const { data: rawPicks } = today
    ? await supabase
        .from("daily_picks")
        .select("grade, recommendation, platform, event, edge_score")
        .eq("pick_date", today)
        .order("edge_score", { ascending: false })
    : { data: null };

  const picks = rawPicks ?? [];
  const topPick = picks[0] ?? null;

  const gradeCount = picks.reduce(
    (acc: Record<string, number>, p: { grade: string }) => {
      acc[p.grade] = (acc[p.grade] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const dateLabel = today
    ? new Date(today + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Today";

  const sACount = (gradeCount["S"] ?? 0) + (gradeCount["A"] ?? 0);

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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={logoSrc} width={44} height={44} />
          <span style={{ color: "#ffffff", fontSize: 26, fontWeight: 700 }}>FadeMe</span>
          <span
            style={{
              marginLeft: "auto",
              color: "rgba(255,255,255,0.35)",
              fontSize: 20,
            }}
          >
            {dateLabel}
          </span>
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: 20,
          }}
        >
          {/* Pick count */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span
              style={{
                color: "#ffffff",
                fontSize: 80,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {picks.length}
            </span>
            <span
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 36,
                fontWeight: 500,
              }}
            >
              AI Picks Today
            </span>
            {sACount > 0 && (
              <div
                style={{
                  display: "flex",
                  marginLeft: 8,
                  background: "rgba(0,220,130,0.12)",
                  border: "1px solid rgba(0,220,130,0.3)",
                  borderRadius: 8,
                  padding: "4px 16px",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#00dc82", fontSize: 20, fontWeight: 600 }}>
                  {sACount} high-edge
                </span>
              </div>
            )}
          </div>

          {/* Grade badges */}
          {Object.keys(gradeCount).length > 0 && (
            <div style={{ display: "flex", gap: 10 }}>
              {GRADE_ORDER.filter((g) => gradeCount[g]).map((grade) => (
                <div
                  key={grade}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: `${GRADE_COLOR[grade]}18`,
                    border: `1px solid ${GRADE_COLOR[grade]}55`,
                    borderRadius: 8,
                    padding: "8px 18px",
                  }}
                >
                  <span
                    style={{
                      color: GRADE_COLOR[grade],
                      fontSize: 28,
                      fontWeight: 800,
                    }}
                  >
                    {grade}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 18 }}>
                    ×{gradeCount[grade]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Top pick preview */}
          {topPick && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                padding: "16px 24px",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 46,
                  height: 46,
                  background: `${GRADE_COLOR[topPick.grade] ?? "#888"}18`,
                  border: `1px solid ${GRADE_COLOR[topPick.grade] ?? "#888"}`,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    color: GRADE_COLOR[topPick.grade] ?? "#888",
                    fontSize: 22,
                    fontWeight: 800,
                  }}
                >
                  {topPick.grade}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ color: "#ffffff", fontSize: 20, fontWeight: 600 }}>
                  {topPick.event.length > 65
                    ? topPick.event.slice(0, 65) + "…"
                    : topPick.event}
                </span>
                <span style={{ color: "rgba(255,255,255,0.38)", fontSize: 16 }}>
                  {topPick.platform} · {topPick.recommendation}
                </span>
              </div>
            </div>
          )}
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
            fademe.ai/picks
          </span>
          <span style={{ color: "#00dc82", fontSize: 17, fontWeight: 600 }}>
            Kalshi · Polymarket · PredictIt
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
