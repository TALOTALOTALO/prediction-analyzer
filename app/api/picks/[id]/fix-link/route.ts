import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

// Convert a market title into a slug-style prefix suitable for slug_contains search
function titleToSlugPrefix(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .split("-")
    .slice(0, 6) // first 6 slug words — enough to be specific, not so many we miss due to wording differences
    .join("-");
}

interface GammaEvent {
  id: string;
  slug: string;
  title: string;
}

interface GammaMarket {
  slug?: string;
  events?: GammaEvent[];
}

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

  const eventTitle = pick.event as string;
  const slugPrefix = titleToSlugPrefix(eventTitle);

  // Strategy 1: search Polymarket events endpoint by slug_contains
  // This is more reliable than full-text search — event slugs are derived from titles
  const searchEventsBySlug = async (prefix: string): Promise<GammaEvent | null> => {
    try {
      const r = await fetch(
        `https://gamma-api.polymarket.com/events?slug_contains=${encodeURIComponent(prefix)}&limit=10`,
        { headers: { "Content-Type": "application/json" } }
      );
      if (!r.ok) return null;
      const events: GammaEvent[] = await r.json();
      if (!events?.length) return null;
      // Prefer exact title match, fall back to first result
      const exact = events.find((e) =>
        e.title?.toLowerCase().includes(eventTitle.toLowerCase().slice(0, 30))
      );
      return exact ?? events[0];
    } catch {
      return null;
    }
  };

  // Strategy 2: fallback to markets search + extract events[0].slug
  const searchMarkets = async (query: string): Promise<string | null> => {
    try {
      const r = await fetch(
        `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(query)}&limit=10`,
        { headers: { "Content-Type": "application/json" } }
      );
      if (!r.ok) return null;
      const markets: GammaMarket[] = await r.json();
      if (!markets?.length) return null;
      for (const m of markets) {
        const eventSlug = m.events?.[0]?.slug;
        if (eventSlug) return eventSlug;
      }
      // Last resort: strip -yes/-no from market slug
      const first = markets[0];
      return (first.slug ?? "").replace(/-yes$|-no$/i, "") || null;
    } catch {
      return null;
    }
  };

  // Try strategies in order: slug prefix (most reliable) → shorter prefix → markets search
  let eventSlug: string | null = null;

  const ev = await searchEventsBySlug(slugPrefix);
  if (ev?.slug) {
    eventSlug = ev.slug;
  } else {
    // Try with just the first 4 words in case title wording diverges
    const shortPrefix = slugPrefix.split("-").slice(0, 4).join("-");
    const ev2 = await searchEventsBySlug(shortPrefix);
    if (ev2?.slug) {
      eventSlug = ev2.slug;
    } else {
      // Final fallback: markets full-text search
      eventSlug = await searchMarkets(eventTitle);
    }
  }

  if (!eventSlug) {
    return NextResponse.json(
      { error: "No matching Polymarket event found — the market may have been resolved or delisted" },
      { status: 404 }
    );
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
