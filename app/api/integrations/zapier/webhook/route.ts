import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Zapier catches POST requests to this URL.
// Trigger URL to paste into Zapier: https://[your-domain]/api/integrations/zapier/webhook
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow empty body */ }

  const callId = body.callId as string | undefined;
  if (!callId) return NextResponse.json({ error: "callId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: session, error } = await supabase
    .from("call_sessions")
    .select("*")
    .eq("id", callId)
    .single();

  if (error || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const objections: string[] = (session.objections_raised ?? []).map(
    (o: Record<string, string>) => o.type ?? o.text ?? ""
  );

  const payload = {
    spear_call_id:       session.id,
    agent_id:            session.agent_id,
    call_date:           session.created_at,
    duration_seconds:    session.duration_seconds,
    overall_score:       session.overall_score,
    disc_profile:        session.disc_profile_detected,
    outcome:             session.outcome,
    objections_raised:   objections,
    talk_ratio_agent:    session.talk_ratio_agent,
    talk_ratio_prospect: session.talk_ratio_prospect,
    transcript_link:     `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?call=${session.id}`,
  };

  return NextResponse.json(payload);
}
