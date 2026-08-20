import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await getSupabase()
    .from("user_preferences")
    .select("category_filter")
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({ categoryFilter: (data?.category_filter as string[] | null) ?? null });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const categoryFilter: string[] | null = body.categoryFilter ?? null;

  const { error } = await getSupabase()
    .from("user_preferences")
    .upsert(
      { user_id: userId, category_filter: categoryFilter, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("Preferences upsert error:", error);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
