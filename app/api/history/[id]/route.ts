import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const VALID_OUTCOMES = ["correct", "incorrect"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json() as { outcome: string | null };
  const outcome = body.outcome ?? null;

  if (outcome !== null && !VALID_OUTCOMES.includes(outcome as (typeof VALID_OUTCOMES)[number])) {
    return NextResponse.json({ error: "Invalid outcome value" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("analyses")
    .update({ outcome })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update analysis outcome:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
