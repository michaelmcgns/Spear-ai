// Manager: fetch full call history for a specific agent in their org
// GET /api/manager/agents/[agentId]/calls

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Confirm caller is manager in same org as target agent
  const { data: myMembership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single();

  if (!myMembership) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  // Confirm target agent is in same org
  const { data: agentMembership } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", myMembership.org_id)
    .eq("user_id", agentId)
    .single();

  if (!agentMembership) {
    return NextResponse.json({ error: "Agent not in your org" }, { status: 403 });
  }

  // Fetch calls — RLS "managers_read_org_calls" policy allows this
  const { data: calls, error } = await supabase
    .from("call_sessions")
    .select(`
      id, created_at, duration_seconds, outcome,
      overall_score, disc_profile_detected,
      objections_raised, nepq_phases_completed,
      talk_ratio_agent, notes, prospect_name, product_name
    `)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ calls });
}
