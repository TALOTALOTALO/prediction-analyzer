import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { data: pick, error: fetchErr } = await getSupabase()
    .from("daily_picks")
    .select("event, platform, market_id")
    .eq("id", id)
    .single();

  if (fetchErr || !pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  if (pick.platform !== "Polymarket") {
    return NextResponse.json({ error: "Only Polymarket picks supported" }, { status: 400 });
  }

  // Search Polymarket Gamma markets API — try exact title first, then first 5 words
  const fullQuery = encodeURIComponent(pick.event as string);
  const shortQuery = encodeURIComponent((pick.event as string).split(" ").slice(0, 5).join(" "));

  const trySearch = async (q: string) => {
    const r = await fetch(
      `https://gamma-api.polymarket.com/markets?search=${q}&limit=5`,
      { headers: { "Content-Type": "application/json" } }
    );
    if (!r.ok) return null;
    return r.json() as Promise<Record<string, unknown>[]>;
  };

  let markets = await trySearch(fullQuery);
  if (!markets || markets.length === 0) markets = await trySearch(shortQuery);

  if (!markets || markets.length === 0) {
    return NextResponse.json({ error: "No matching Polymarket market found — the market may have been resolved or delisted" }, { status: 404 });
  }

  // Extract event slug from the market's parent events array (same pattern as fetchPolymarkets)
  const firstMarket = markets[0];
  const eventSlug = (firstMarket.events as Array<{ slug?: string }>)?.[0]?.slug
    ?? (firstMarket.slug as string)?.replace(/-yes$|-no$/i, "");

  if (!eventSlug) {
    return NextResponse.json({ error: "Could not determine event slug" }, { status: 404 });
  }

  const { error: updateErr } = await getSupabase()
    .from("daily_picks")
    .update({ market_id: eventSlug })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update market_id" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, market_id: eventSlug, url: `https://polymarket.com/event/${eventSlug}` });
}
