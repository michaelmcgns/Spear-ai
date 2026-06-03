import { NextRequest, NextResponse } from "next/server";

// POST /api/twilio/stream
// TwiML webhook — called by Twilio when:
//   (a) Browser (Twilio Client) initiates an outbound call, OR
//   (b) Server creates a call via REST API
//
// Responds with TwiML that:
//   1. Dials the prospect's number (passed as "To" param from Twilio Client)
//   2. Bridges the browser ↔ prospect phone so both can hear each other

export async function POST(req: NextRequest) {
  const body = await req.formData();

  // When Twilio Client makes a call, the "To" param contains the number the agent dialed
  const to      = body.get("To")      as string | null;
  const from    = body.get("From")    as string | null;
  const callSid = body.get("CallSid") as string | null;

  console.log(`[Spear/Twilio] stream TwiML request — To:${to} From:${from} CallSid:${callSid}`);

  const fromNumber = process.env.TWILIO_PHONE_NUMBER ?? "";

  let twiml: string;

  if (to && to.startsWith("+")) {
    // Outbound call from browser — dial the prospect and bridge audio
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${fromNumber}" record="do-not-record" timeout="30">
    <Number statusCallbackEvent="initiated ringing answered completed"
            statusCallback="https://spearai.live/api/twilio/status">
      ${to}
    </Number>
  </Dial>
</Response>`;
  } else {
    // Fallback — just keep the call alive (shouldn't normally hit this)
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Spear is ready. Please wait.</Say>
  <Pause length="60"/>
</Response>`;
  }

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
