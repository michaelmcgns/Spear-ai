import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ calls: [], userId: null });

  // Try full select first; fall back to minimal columns if schema is missing some
  let calls: unknown[] | null = null;

  const { data: fullData, error: fullError } = await supabase
    .from("call_sessions")
    .select("id, created_at, duration_seconds, outcome, overall_score, disc_profile_detected, objections_raised, nepq_phases_completed, talk_ratio_agent, notes, prospect_name, product_name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!fullError) {
    calls = fullData;
  } else {
    // Some columns don't exist yet — fall back to columns guaranteed to exist
    console.warn("[calls/list] Full select failed, falling back:", fullError.message);
    const { data: minData } = await supabase
      .from("call_sessions")
      .select("id, created_at, duration_seconds, notes, prospect_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    calls = minData;
  }

  return NextResponse.json({ calls: calls ?? [], userId: user.id });
}
