import { NextResponse } from "next/server";
import { SignJWT } from "jose";

// GET /api/twilio/token
// Generates a Twilio Access Token using jose (lightweight JWT library).
// Twilio Access Token spec: https://www.twilio.com/docs/iam/access-tokens

export async function GET() {
  const accountSid  = process.env.TWILIO_ACCOUNT_SID;
  const apiKey      = process.env.TWILIO_API_KEY;
  const apiSecret   = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    return NextResponse.json(
      { error: "Missing env vars: TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID" },
      { status: 500 }
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    jti:    `${apiKey}-${now}`,
    iss:    apiKey,
    sub:    accountSid,
    nbf:    now,
    exp:    now + 3600,
    grants: {
      identity: "spear-agent",
      voice: {
        outgoing: { application_sid: twimlAppSid },
        incoming: { allow: false },
      },
    },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(new TextEncoder().encode(apiSecret));

  return NextResponse.json({ token });
}
