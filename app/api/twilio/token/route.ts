import { NextResponse } from "next/server";
import { createHmac } from "crypto";

// GET /api/twilio/token
// Generates a Twilio Access Token for the browser Twilio Client SDK.
// Built manually (no Twilio SDK) to avoid Next.js serverless bundling issues.
// Twilio Access Token spec: https://www.twilio.com/docs/iam/access-tokens

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function buildAccessToken(
  accountSid: string,
  apiKey: string,
  apiSecret: string,
  twimlAppSid: string,
  identity: string,
  ttl = 3600
): string {
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: "JWT", alg: "HS256" };

  const payload = {
    jti:    `${apiKey}-${now}`,
    iss:    apiKey,
    sub:    accountSid,
    nbf:    now,
    exp:    now + ttl,
    grants: {
      identity,
      voice: {
        outgoing: { application_sid: twimlAppSid },
        incoming: { allow: false },
      },
    },
  };

  const headerB64  = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const sig = createHmac("sha256", apiSecret)
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64url(sig)}`;
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

  const token = buildAccessToken(accountSid, apiKey, apiSecret, twimlAppSid, "spear-agent");
  return NextResponse.json({ token });
}
