import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/twilio/status
// Receives Twilio call status callbacks.
// Tracks call lifecycle: initiated → ringing → answered → completed.
// Writes status updates to call_sessions via twilio_call_sid.

export async function POST(req: NextRequest) {
  const body = await req.formData();

  const callSid    = body.get("CallSid")      as string;
  const callStatus = body.get("CallStatus")   as string;
  const to         = body.get("To")           as string;
  const from       = body.get("From")         as string;
  const duration   = body.get("CallDuration") as string | null;

  console.log(`[Spear/Twilio] ${callSid} | ${from} → ${to} | ${callStatus}${duration ? ` | ${duration}s` : ""}`);

  // Update call_sessions record that has this twilio_call_sid
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey && callSid) {
    const supabase = createClient(supabaseUrl, serviceKey);

    const update: Record<string, unknown> = { twilio_status: callStatus };
    if (callStatus === "completed" && duration) {
      update.duration_seconds = Number(duration);
    }

    const { error } = await supabase
      .from("call_sessions")
      .update(update)
      .eq("twilio_call_sid", callSid);

    if (error) {
      console.error("[Spear/Twilio] Supabase update failed:", error.message);
    }
  }

  return new NextResponse("OK", { status: 200 });
}
