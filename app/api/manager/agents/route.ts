// Manager: list all agents in the same org with aggregated stats
// Requires: manager or owner role in org_members

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Confirm caller is a manager/owner
  const { data: myMembership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single();

  if (!myMembership) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  const orgId = myMembership.org_id;

  // Fetch all members in this org
  const { data: members, error: membersErr } = await supabase
    .from("org_members")
    .select("user_id, role, invite_email, joined_at, invite_accepted")
    .eq("org_id", orgId)
    .neq("user_id", null);

  if (membersErr) {
    return NextResponse.json({ error: membersErr.message }, { status: 500 });
  }

  // Fetch call stats for all org agents in one query
  // Using agent_id = user_id (call_sessions.agent_id is stored as text uuid)
  const memberIds = (members ?? [])
    .map((m) => m.user_id)
    .filter(Boolean) as string[];

  const { data: callStats } = await supabase
    .from("call_sessions")
    .select("agent_id, overall_score, outcome, created_at, duration_seconds")
    .in("agent_id", memberIds);

  // Fetch agent profiles for display names
  const { data: profiles } = await supabase
    .from("agent_profiles")
    .select("user_id, product_focus, agency_name")
    .in("user_id", memberIds);

  // Aggregate per agent
  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  const agentStats = memberIds.map((uid) => {
    const agentCalls = (callStats ?? []).filter((c) => c.agent_id === uid);
    const member = members!.find((m) => m.user_id === uid)!;

    const totalCalls = agentCalls.length;
    const closedCalls = agentCalls.filter((c) => c.outcome === "closed").length;
    const closeRate = totalCalls > 0
      ? Math.round((closedCalls / totalCalls) * 100)
      : 0;
    const scores = agentCalls
      .map((c) => c.overall_score)
      .filter((s): s is number => s != null);
    const avgScore = scores.length > 0
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : null;

    // Last 5 scores to determine trend
    const recentScores = agentCalls
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((c) => c.overall_score)
      .filter((s): s is number => s != null);

    let trend: "up" | "down" | "flat" = "flat";
    if (recentScores.length >= 4) {
      const half = Math.floor(recentScores.length / 2);
      const recent = recentScores.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const older  = recentScores.slice(half).reduce((a, b) => a + b, 0) / half;
      if (recent - older > 0.3) trend = "up";
      else if (older - recent > 0.3) trend = "down";
    }

    // Calls this month
    const now = new Date();
    const callsThisMonth = agentCalls.filter((c) => {
      const d = new Date(c.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const lastCall = agentCalls.length > 0
      ? agentCalls.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0].created_at
      : null;

    return {
      user_id:       uid,
      role:          member.role,
      invite_email:  member.invite_email,
      joined_at:     member.joined_at,
      product_focus: profileMap[uid]?.product_focus ?? null,
      agency_name:   profileMap[uid]?.agency_name ?? null,
      total_calls:   totalCalls,
      calls_month:   callsThisMonth,
      close_rate:    closeRate,
      avg_score:     avgScore,
      trend,
      last_call_at:  lastCall,
    };
  });

  return NextResponse.json({ agents: agentStats, org_id: orgId });
}
