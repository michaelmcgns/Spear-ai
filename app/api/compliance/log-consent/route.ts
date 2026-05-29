import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  try {
    const { prospectState, sessionId, confirmedAt } = await req.json();

    if (!prospectState || !sessionId || !confirmedAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service client to bypass RLS — consent_log is an append-only audit table
    const db = createServiceClient();
    const { error } = await db.from("consent_log").insert({
      agent_id: user.id,
      prospect_state: prospectState,
      session_id: sessionId,
      confirmed_at: confirmedAt,
    });

    if (error) {
      console.error("consent_log insert error:", error);
      // Non-fatal — return 200 so client isn't blocked by a DB error
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
