import { NextRequest, NextResponse } from "next/server";

// POST /api/twilio/stream
// Twilio calls this webhook when the outbound call connects.
// We respond with TwiML that:
//   1. Connects the call
//   2. Opens a bidirectional media stream (both audio legs) to our WebSocket endpoint
//
// The live-call page connects to Deepgram directly via the browser mic for the agent leg.
// Twilio streams the PROSPECT leg (what comes through the earpiece) to /api/twilio/ws
// so we can pipe it to Deepgram with speaker=prospect labeling.
//
// For now this TwiML keeps the call alive and streams audio.
// The agent's browser mic handles the agent leg via the existing Deepgram WebSocket.

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") ?? "unknown";
  const leadId  = url.searchParams.get("leadId")  ?? "";

  // Base app URL for the media stream WebSocket
  const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "https://spearai.live";
  // WebSocket URL: wss:// version of the app URL
  const wsBaseUrl = baseUrl.replace(/^https?:\/\//, "wss://");

  const wsUrl = new URL("/api/twilio/ws", wsBaseUrl);
  wsUrl.searchParams.set("agentId", agentId);
  if (leadId) wsUrl.searchParams.set("leadId", leadId);

  // TwiML response:
  // <Start><Stream> opens a WebSocket from Twilio to our server carrying raw mulaw audio.
  // track="inbound_track" means we receive the prospect's audio (what the agent hears).
  // We could also add track="outbound_track" for the agent's audio, but we already
  // capture that via the browser mic → Deepgram directly.
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsUrl.toString()}" track="inbound_track" />
  </Start>
  <Pause length="120"/>
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
