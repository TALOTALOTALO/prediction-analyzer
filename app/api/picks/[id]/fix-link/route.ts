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

  // Search Polymarket Gamma events API for the best matching event
  const query = encodeURIComponent(pick.event as string);
  const res = await fetch(
    `https://gamma-api.polymarket.com/events?search=${query}&limit=5&active=true`,
    { headers: { "Content-Type": "application/json" } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Gamma API request failed" }, { status: 502 });
  }

  const events: Record<string, unknown>[] = await res.json();

  if (!events || events.length === 0) {
    // Try without active filter — market may be resolved
    const res2 = await fetch(
      `https://gamma-api.polymarket.com/events?search=${query}&limit=5`,
      { headers: { "Content-Type": "application/json" } }
    );
    const events2: Record<string, unknown>[] = res2.ok ? await res2.json() : [];
    if (!events2 || events2.length === 0) {
      return NextResponse.json({ error: "No matching Polymarket event found" }, { status: 404 });
    }
    events.push(...events2);
  }

  const eventSlug = events[0]?.slug as string | undefined;
  if (!eventSlug) {
    return NextResponse.json({ error: "Event has no slug" }, { status: 404 });
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
