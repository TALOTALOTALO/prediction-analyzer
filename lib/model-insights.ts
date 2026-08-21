import { getSupabase } from "@/lib/supabase";

interface CalibrationBucket {
  wins: number;
  losses: number;
  win_rate: number | null;
  total: number;
}

interface ModelInsightsRow {
  analysis_date: string;
  resolved_count: number;
  calibration: {
    overall: CalibrationBucket;
    by_grade: Record<string, CalibrationBucket>;
    by_platform: Record<string, CalibrationBucket>;
    by_category: Record<string, CalibrationBucket>;
    by_edge_bucket: Record<string, CalibrationBucket>;
  };
  patterns: string;
  win_factors: string;
  loss_factors: string;
}

function fmtGroup(entries: [string, CalibrationBucket][]): string {
  return entries
    .filter(([, b]) => b.total >= 3)
    .map(([label, b]) => `${label}→${b.win_rate ?? "?"}% (n=${b.total})`)
    .join(" | ");
}

export async function getModelInsightsBlock(): Promise<string> {
  try {
    const { data } = await getSupabase()
      .from("model_insights")
      .select("analysis_date, resolved_count, calibration, patterns, win_factors, loss_factors")
      .order("analysis_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return "";

    const row = data as ModelInsightsRow;
    const cal = row.calibration;
    const ov = cal.overall;

    const lines: string[] = [
      `=== FADEME PERFORMANCE MEMORY (${row.analysis_date} · ${row.resolved_count} resolved picks) ===`,
      `Use this data to calibrate edge estimates. Where we've been systematically wrong, apply extra skepticism.`,
      ``,
      `OVERALL: ${ov.wins}W-${ov.losses}L (${ov.win_rate ?? "?"}% win rate)`,
    ];

    const grades = fmtGroup(Object.entries(cal.by_grade ?? {}));
    if (grades) lines.push(`BY GRADE: ${grades}`);

    const platforms = fmtGroup(Object.entries(cal.by_platform ?? {}));
    if (platforms) lines.push(`BY PLATFORM: ${platforms}`);

    const categories = fmtGroup(Object.entries(cal.by_category ?? {}));
    if (categories) lines.push(`BY CATEGORY: ${categories}`);

    const buckets = fmtGroup(Object.entries(cal.by_edge_bucket ?? {}));
    if (buckets) lines.push(`BY EDGE RANGE: ${buckets}`);

    if (row.win_factors) lines.push(``, `WHAT DRIVES CORRECT CALLS:`, row.win_factors);
    if (row.loss_factors) lines.push(``, `WHAT DRIVES INCORRECT CALLS:`, row.loss_factors);
    if (row.patterns) lines.push(``, `CALIBRATION GUIDANCE:`, row.patterns);

    return lines.join("\n");
  } catch {
    return "";
  }
}
