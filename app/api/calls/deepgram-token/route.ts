import { DeepgramClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'

// Returns a short-lived Deepgram API key (10 min TTL) so the browser can open
// a WebSocket directly to Deepgram without exposing the main API key.
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 })
  }

  try {
    const dg = new DeepgramClient({ apiKey })

    const projectsData = await dg.manage.v1.projects.list()
    const projectId = projectsData?.projects?.[0]?.project_id
    if (!projectId) {
      console.error('[deepgram-token] no projects found')
      return NextResponse.json({ error: 'Could not retrieve Deepgram project' }, { status: 500 })
    }

    const keyData = await dg.manage.v1.projects.keys.create(projectId, {
      comment:                  `live-call-${Date.now()}`,
      scopes:                   ['usage:write'],
      time_to_live_in_seconds:  600,
    } as any)

    if (!keyData?.key) {
      console.error('[deepgram-token] key creation failed')
      return NextResponse.json({ error: 'Could not create temporary key' }, { status: 500 })
    }

    return NextResponse.json({ key: keyData.key })
  } catch (err) {
    console.error('[deepgram-token] unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
