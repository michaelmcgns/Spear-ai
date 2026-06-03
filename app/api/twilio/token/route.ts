import { NextResponse } from "next/server";
import { createHmac } from "crypto";

// GET /api/twilio/token
// Generates a Twilio Access Token for the Twilio Voice Client SDK.
// Twilio requires a specific JWT structure including "cty":"twilio-fpa;v=1" in the header.
// Built with Node crypto — no SDK required.

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input as string, "utf8");
  return buf.toString("base64url");
}

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

  // Twilio requires this exact header format
  const header = {
    cty: "twilio-fpa;v=1",
    typ: "JWT",
    alg: "HS256",
  };

  const payload = {
    jti:    `${apiKey}-${now}`,
    iss:    apiKey,
    sub:    accountSid,
    nbf:    now,
    exp:    now + 3600,
    grants: {
      identity: "spear-agent",
      voice: {
        outgoing: { application_sid: twimlAppSid },
      },
    },
  };

  const headerB64  = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const sig = createHmac("sha256", apiSecret)
    .update(signingInput)
    .digest();

  const token = `${signingInput}.${b64url(sig)}`;

  return NextResponse.json({ token });
}
