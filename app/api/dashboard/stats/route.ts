import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export interface DashboardStats {
  totalCalls:       number;
  closeRate:        number;   // percentage 0-100
  avgScore:         string;   // "7.4"
  objectionsCaught: number;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const empty: DashboardStats = { totalCalls: 0, closeRate: 0, avgScore: "—", objectionsCaught: 0 };
  if (!user) return NextResponse.json(empty);

  const { data: calls } = await supabase
    .from("call_sessions")
    .select("outcome, overall_score, objections_raised")
    .eq("user_id", user.id);

  if (!calls || calls.length === 0) return NextResponse.json(empty);

  const totalCalls       = calls.length;
  const closedCalls      = calls.filter(c => c.outcome === "closed").length;
  const closeRate        = Math.round((closedCalls / totalCalls) * 100);
  const scoredCalls      = calls.filter(c => c.overall_score != null);
  const avgScore         = scoredCalls.length > 0
    ? (scoredCalls.reduce((s: number, c) => s + (c.overall_score as number), 0) / scoredCalls.length).toFixed(1)
    : "—";
  const objectionsCaught = calls.reduce(
    (s: number, c) => s + ((c.objections_raised as unknown[])?.length ?? 0), 0
  );

  return NextResponse.json({ totalCalls, closeRate, avgScore, objectionsCaught } satisfies DashboardStats);
}
