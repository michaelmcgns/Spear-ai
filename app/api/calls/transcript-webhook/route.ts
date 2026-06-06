export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId') ?? ''

    const form = await req.formData()
    const text = ((form.get('TranscriptionText') as string) ?? '').trim()
    const isFinal = (form.get('Final') as string) === 'true'
    const event = (form.get('TranscriptionEvent') as string) ?? ''
    const callSid = (form.get('CallSid') as string) ?? ''

    // Skip non-content events
    if (!text || event === 'transcription-started' || event === 'transcription-stopped') {
      return new Response('OK')
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `call:${sessionId}`,
            event: 'transcript',
            payload: { text, final: isFinal, callSid },
          },
        ],
      }),
    })
  } catch (err) {
    console.error('[transcript-webhook]', err)
  }

  // Always 200 — Twilio retries on non-2xx
  return new Response('OK')
}
