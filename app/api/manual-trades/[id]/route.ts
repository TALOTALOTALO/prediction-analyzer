import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

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

  const body = await req.json() as { result: string | null };
  const { result } = body;

  if (result !== null && !["won", "lost", "void"].includes(result)) {
    return NextResponse.json({ error: "Invalid result" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("manual_trades")
    .update({ result })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("manual_trades update error:", error);
    return NextResponse.json({ error: "Failed to update trade" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("manual_trades")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("manual_trades delete error:", error);
    return NextResponse.json({ error: "Failed to delete trade" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
