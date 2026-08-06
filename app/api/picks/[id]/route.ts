import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const VALID_RESULTS = ["won", "lost", "void"] as const;

export async function PATCH(
  req: NextRequest,
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

  const body = await req.json();
  const result: string | null = body.result ?? null;

  if (result !== null && !VALID_RESULTS.includes(result as (typeof VALID_RESULTS)[number])) {
    return NextResponse.json({ error: "Invalid result value" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("daily_picks")
    .update({ result })
    .eq("id", id);

  if (error) {
    console.error("Failed to update pick result:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id, result });
}
