import { NextResponse } from "next/server";
import { jwt } from "twilio";

// GET /api/twilio/token
// Returns a short-lived Twilio Client access token so the browser can make/receive calls.
// Requires a TwiML App SID (TWILIO_TWIML_APP_SID) — create one in Twilio console:
//   Voice → TwiML Apps → Create → set Voice Request URL to https://spearai.live/api/twilio/stream

export async function GET() {
  const accountSid   = process.env.TWILIO_ACCOUNT_SID;
  const authToken    = process.env.TWILIO_AUTH_TOKEN;
  const apiKey       = process.env.TWILIO_API_KEY;
  const apiSecret    = process.env.TWILIO_API_SECRET;
  const twimlAppSid  = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !authToken || !apiKey || !apiSecret || !twimlAppSid) {
    return NextResponse.json(
      { error: "Missing Twilio env vars: TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID" },
      { status: 500 }
    );
  }

  // Create an Access Token with a Voice grant
  const { AccessToken } = jwt;
  const { VoiceGrant }  = AccessToken;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: false, // agent only makes outbound calls
  });

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity: "spear-agent",
    ttl: 3600, // 1 hour
  });
  token.addGrant(voiceGrant);

  return NextResponse.json({ token: token.toJwt() });
}
