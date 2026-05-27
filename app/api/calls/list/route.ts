import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ calls: [], userId: null });

  const { data: calls } = await supabase
    .from("call_sessions")
    .select("id, created_at, duration_seconds, outcome, overall_score, disc_profile_detected, objections_raised, nepq_phases_completed, talk_ratio_agent, notes")
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ calls: calls ?? [], userId: user.id });
}
