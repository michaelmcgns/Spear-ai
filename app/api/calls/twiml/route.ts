export async function POST(req: Request) {
  const form = await req.formData()
  const phone = ((form.get('Phone') ?? form.get('To')) as string) ?? ''
  const sessionId = (form.get('SessionId') as string) ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const callerId = process.env.TWILIO_PHONE_NUMBER!

  const isValidPhone = /^\+?[1-9]\d{7,14}$/.test(phone.replace(/[\s\-().]/g, ''))
  const cbUrl = `${appUrl}/api/calls/transcript-webhook?sessionId=${encodeURIComponent(sessionId)}`

  const twiml = isValidPhone
    ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Transcription
      statusCallbackUrl="${cbUrl}"
      statusCallbackMethod="POST"
      track="both_tracks"
      partial="true"
      languageCode="en-US"
    />
  </Start>
  <Dial callerId="${callerId}" timeout="30">
    <Number>${phone.replace(/[\s\-().]/g, '')}</Number>
  </Dial>
</Response>`
    : `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Invalid phone number.</Say>
  <Hangup />
</Response>`

  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}
