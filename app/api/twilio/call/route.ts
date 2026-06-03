import { NextRequest, NextResponse } from "next/server";

// POST /api/twilio/call
// Initiates an outbound call via Twilio REST API (no SDK — avoids bundling issues).
// Twilio calls the prospect, then hits /api/twilio/stream for TwiML instructions.

export async function POST(req: NextRequest) {
  let body: { to?: string; agentId?: string; leadId?: string };
  try {
    body = await req.json() as { to?: string; agentId?: string; leadId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, agentId, leadId } = body;

  if (!to) {
    return NextResponse.json({ error: "Missing 'to' phone number" }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: "Twilio env vars not configured" }, { status: 500 });
  }

  const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "https://spearai.live";
  const streamUrl = new URL("/api/twilio/stream", baseUrl);
  if (agentId) streamUrl.searchParams.set("agentId", agentId);
  if (leadId)  streamUrl.searchParams.set("leadId", leadId);

  const statusUrl = new URL("/api/twilio/status", baseUrl);

  // Encode credentials for Basic Auth
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  // Call Twilio REST API directly — no SDK
  const params = new URLSearchParams({
    To:                    to,
    From:                  fromNumber,
    Url:                   streamUrl.toString(),
    StatusCallback:        statusUrl.toString(),
    StatusCallbackMethod:  "POST",
    StatusCallbackEvent:   "initiated ringing answered completed",
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const data = await res.json() as { sid?: string; status?: string; message?: string };

    if (!res.ok) {
      console.error("[Spear/Twilio] call failed:", data.message);
      return NextResponse.json({ error: data.message ?? "Twilio error" }, { status: res.status });
    }

    return NextResponse.json({ callSid: data.sid, status: data.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Spear/Twilio] fetch error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
