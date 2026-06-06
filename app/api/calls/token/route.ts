import twilio from 'twilio'

export async function GET() {
  try {
    const { AccessToken } = twilio.jwt
    const { VoiceGrant } = AccessToken

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      { identity: `agent_${Date.now()}`, ttl: 3600 }
    )

    const grant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: false,
    })
    token.addGrant(grant)

    return Response.json({ token: token.toJwt() })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
