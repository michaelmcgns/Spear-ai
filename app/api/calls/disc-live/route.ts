/**
 * /api/calls/disc-live
 *
 * Infers the prospect's DISC personality type from their speech during a live
 * call. Called every ~45 seconds once enough prospect lines have accumulated.
 *
 * Uses Claude Haiku for low latency (~400ms).
 */

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic()

const DISC_TYPES = ['D', 'I', 'S', 'C'] as const
type DiscType = typeof DISC_TYPES[number]

const DISC_NAMES: Record<DiscType, string> = {
  D: 'Dominant',
  I: 'Influential',
  S: 'Steady',
  C: 'Conscientious',
}

export async function POST(req: NextRequest) {
  const { lines, callFocus } = await req.json() as { lines: string[]; callFocus?: string }

  if (!Array.isArray(lines) || lines.length < 3) {
    return NextResponse.json({ skip: true })
  }

  const transcript = lines.slice(-15).map((l, i) => `${i + 1}. "${l}"`).join('\n')

  const system = `You are an expert DISC personality psychologist analyzing a live sales call to profile the prospect's buying behavior in real time.

DISC types:
- D (Dominant): Results-driven, impatient, direct, asks "what's the bottom line", time-conscious, interrupts, short terse answers, wants control
- I (Influential): Emotional, talkative, storytelling, mentions family/friends, laughs, jumps topics, optimistic, seeks approval, uses "feel" language
- S (Steady): Cautious, process-oriented, asks "how does it work", mentions stability/security, slow to decide, says they need to think, loyal, asks about others' experiences
- C (Conscientious): Analytical, detail-seeking, asks specific questions about numbers/terms/data, skeptical, methodical, quiet but precise, wants documentation

Your job is to read the prospect's ACTUAL words and classify their primary DISC type. Return ONLY valid JSON.`

  const user = `PROSPECT UTTERANCES (last ${Math.min(lines.length, 15)} lines):
${transcript}

Analyze these utterances and return JSON:
{
  "skip": false,
  "type": "D" | "I" | "S" | "C",
  "confidence": 0-100,
  "primaryTrait": "One sentence describing the most revealing behavior you observed",
  "traits": ["3 specific behaviors you noticed from their actual words"],
  "sellTo": ["3 specific adjustments to make RIGHT NOW for this personality type — concrete, actionable, call-specific"]
}

If there are too few signals to classify with any confidence (< 40), return: { "skip": true }
ONLY return valid JSON, nothing else.`

  try {
    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 350,
      system,
      messages: [{ role: 'user', content: user }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(jsonText)

    if (parsed.skip) return NextResponse.json({ skip: true })

    const type = DISC_TYPES.includes(parsed.type) ? parsed.type as DiscType : null
    if (!type) return NextResponse.json({ skip: true })

    return NextResponse.json({
      skip:         false,
      type,
      name:         DISC_NAMES[type],
      confidence:   Math.max(0, Math.min(100, Math.round(parsed.confidence ?? 50))),
      primaryTrait: parsed.primaryTrait ?? '',
      traits:       Array.isArray(parsed.traits)  ? parsed.traits.slice(0, 3)  : [],
      sellTo:       Array.isArray(parsed.sellTo)  ? parsed.sellTo.slice(0, 3)  : [],
    })
  } catch (err) {
    console.error('[disc-live] error:', err)
    return NextResponse.json({ skip: true })
  }
}
