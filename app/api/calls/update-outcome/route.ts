import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, outcome } = await req.json() as { id: string; outcome: "closed" | "lost" | "follow_up" | "pending" };
  if (!id || !["closed", "lost", "follow_up", "pending"].includes(outcome)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const dbOutcome =
    outcome === "lost" ? "not_closed" :
    outcome === "pending" ? "unknown" :
    outcome;

  const { error } = await supabase
    .from("call_sessions")
    .update({ outcome: dbOutcome })
    .eq("id", id)
    .eq("user_id", user.id); // ensures agents can only update their own calls

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
