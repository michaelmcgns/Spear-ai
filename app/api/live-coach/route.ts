/**
 * /api/live-coach
 *
 * Real-time AI coaching endpoint for live sales calls.
 * Called on every finalized prospect utterance. Returns a psychological
 * analysis of the buyer's state + actionable coaching for the agent.
 *
 * Uses Claude Haiku for speed (~500ms round-trip).
 */

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic()

const FOCUS_NAMES: Record<string, string> = {
  mortgage_protection: 'Mortgage Protection Insurance',
  term_life:           'Term Life Insurance',
  final_expense:       'Final Expense / Burial Insurance',
  iul:                 'Indexed Universal Life (IUL)',
  medicare_supplement: 'Medicare Supplement',
  medicare_advantage:  'Medicare Advantage',
  annuities:           'Annuities',
}

const VALID_FOCUSES = Object.keys(FOCUS_NAMES)

export async function POST(req: NextRequest) {
  const { utterance, context, callFocus } = await req.json()

  if (!utterance || typeof utterance !== 'string' || utterance.trim().length < 6) {
    return Response.json({ skip: true })
  }

  const focusName = FOCUS_NAMES[callFocus] || callFocus || 'life insurance'

  const system = `You are a master sales psychology coach monitoring a live ${focusName} phone sales call in real time.

Your job: read the buyer's psychology from what they just said, then give the agent precise, contextual coaching.

You use NEPQ methodology (Neuro-Emotional Persuasion Questions) and understand that every prospect response — even a one-word answer — reveals emotional state, fear level, and buying readiness. You do NOT give scripts. You give a psychological read and a direction.

Rules:
- Responses must be grounded in this specific call's context, not generic
- Suggested responses must sound human and natural — never robotic or templated
- Keep psychRead analytical and specific to what the prospect said
- Suggested response under 60 words
- Skip coaching for filler words, one-word answers like "okay" / "uh-huh", or when the agent is speaking
- Return ONLY valid JSON, nothing else`

  const user = `RECENT CONVERSATION:
${context || '(beginning of call)'}

PROSPECT JUST SAID: "${utterance.trim()}"

Analyze this and respond with JSON in this exact format:
{
  "skip": false,
  "cardType": "objection" | "buying_signal" | "closing",
  "cardTitle": "2-3 word label",
  "psychRead": "What is REALLY happening in this buyer's mind right now — their fear, emotional state, or motivation. Be specific to what they said. 2-3 sentences.",
  "response": "What the agent should say next. Natural and conversational, specific to this call's context. NOT a template.",
  "nextMove": "One strategic sentence on where to take the conversation next.",
  "switchProduct": null or one of: "mortgage_protection","term_life","final_expense","iul","medicare_supplement","medicare_advantage","annuities" — only if what prospect said reveals a clearly better-fit product,
  "switchReason": null or brief reason
}

If no coaching is needed (filler, affirmation, agent is speaking, or utterance is too vague to coach on), return: {"skip": true}`

  try {
    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 450,
      system,
      messages: [{ role: 'user', content: user }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''

    // Strip markdown code fences if model wrapped the JSON
    const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(jsonText)

    // Validate switchProduct
    if (parsed.switchProduct && !VALID_FOCUSES.includes(parsed.switchProduct)) {
      parsed.switchProduct = null
      parsed.switchReason  = null
    }

    return Response.json(parsed)
  } catch (err) {
    console.error('[live-coach] error:', err)
    return Response.json({ skip: true })
  }
}
