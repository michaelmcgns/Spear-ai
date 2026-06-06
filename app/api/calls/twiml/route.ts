export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const raw = ((form.get('Phone') ?? form.get('To')) as string | null)?.trim() ?? ''
    const clean = raw.replace(/[\s\-().]/g, '')
    const callerId = process.env.TWILIO_PHONE_NUMBER ?? ''

    // Accept 7–15 digit numbers, with or without leading +
    const isValid = clean.length >= 7 && /^\+?[1-9]\d{6,14}$/.test(clean)
    const dialTo = clean.startsWith('+') ? clean : clean.length === 10 ? `+1${clean}` : `+${clean}`

    const twiml = isValid
      ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" timeout="30">
    <Number>${dialTo}</Number>
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
  } catch (err) {
    console.error('[twiml]', err)
    // Always return valid TwiML — a 500 makes Twilio play "application error"
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Server error.</Say><Hangup/></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
    )
  }
}
