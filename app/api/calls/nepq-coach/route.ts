/**
 * /api/calls/nepq-coach
 *
 * Real-time NEPQ (Neuro-Emotional Persuasion Questioning) coaching.
 * Fires on every finalized prospect utterance alongside the main live-coach.
 *
 * NEPQ methodology by Jeremy Miner — 7 question types, 4 tonality modes.
 * This endpoint identifies the current NEPQ stage, what question type to use,
 * the exact suggested question, and what tonality to deliver it in.
 *
 * Uses Claude Haiku for speed (~400ms round-trip).
 */

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

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

const NEPQ_SYSTEM = `You are a world-class NEPQ (Neuro-Emotional Persuasion Questioning) sales coach monitoring a live phone sales call in real time.

NEPQ was developed by Jeremy Miner based on behavioral science. The core idea: most salespeople cause resistance by pitching and pushing. NEPQ works by asking questions that help prospects SELL THEMSELVES through emotional self-discovery.

THE 7 NEPQ QUESTION TYPES:
1. CONNECTING — Build genuine curiosity about their world. Example: "How long have you been dealing with that situation?"
2. SITUATION — Understand their current state without interrogating. Example: "What kind of coverage do you currently have in place?"
3. PROBLEM AWARENESS — Surface problems they haven't fully acknowledged. Example: "What concerns you most about your current situation?"
4. SOLUTION AWARENESS — Reveal the gap between where they are and where they want to be. Example: "What would need to be in place for you to feel fully protected?"
5. CONSEQUENCE — Amplify the emotional pain of NOT solving the problem. Example: "What would happen to your family's mortgage if something happened to you tomorrow?"
6. QUALIFYING — Determine motivation and decision readiness. Example: "On a scale of 1–10, how important is solving this for your family right now?"
7. COMMITMENT — Gently move toward next steps. Example: "If we could put something together that checked all those boxes, is there any reason you wouldn't move forward today?"

THE 4 NEPQ TONALITY MODES:
- CURIOUS: Slightly rise in pitch at the end, like you genuinely want to know. Not interrogating.
- CONFUSED: Genuinely puzzled tone, like you're trying to understand. Lowers defenses.
- CONCERNED: Warm, caring tone — you're thinking about their family, not making a sale.
- MATTER-OF-FACT: Flat, detached tone. No excitement. Especially for consequence questions — don't dramatize.

NEPQ ANTI-PATTERNS (flag these if agent is doing them):
- Feature dumping / product pitching too early
- Using "I/we" language instead of "you/your family" language
- Answering objections with facts instead of questions
- Showing excitement or eagerness
- Closing before enough pain has been uncovered

NEPQ CALL STAGES:
- HOOK: First 60s — use connecting questions, establish authority frame
- DISCOVER: Minutes 1-5 — use situation + problem awareness questions
- DEEPEN: Minutes 5-10 — use consequence + solution awareness questions
- TRANSITION: When prospect shows readiness — qualifying questions
- CLOSE: When pain is maximized and solution is clear — commitment questions

Your job: look at the prospect's last utterance and the recent call context, then identify exactly which NEPQ question type to fire next and provide the actual question tailored to this specific call.`

export async function POST(req: NextRequest) {
  const { utterance, context, callFocus, discType, callStage } = await req.json()

  if (!utterance || typeof utterance !== 'string' || utterance.trim().length < 6) {
    return NextResponse.json({ skip: true })
  }

  const focusName = FOCUS_NAMES[callFocus] || callFocus || 'life insurance'

  const discContext = discType ? `\nPROSPECT DISC TYPE: ${discType} — tailor question style accordingly (D=direct/brief, I=emotional/story, S=careful/process, C=data/logical)` : ''

  const user = `PRODUCT FOCUS: ${focusName}
CALL STAGE: ${callStage || 'discover'}${discContext}

RECENT CONVERSATION:
${context || '(beginning of call)'}

PROSPECT JUST SAID: "${utterance.trim()}"

Based on what the prospect just said and the call stage, determine the BEST NEPQ move right now.

Respond with ONLY valid JSON in this exact format:
{
  "skip": false,
  "stage": "hook" | "discover" | "deepen" | "transition" | "close",
  "questionType": one of: "Connecting" | "Situation" | "Problem Awareness" | "Solution Awareness" | "Consequence" | "Qualifying" | "Commitment",
  "suggestedQuestion": "The exact question to ask right now — tailored to THIS prospect, THIS call, THIS product. 1 sentence. Natural and human.",
  "tonality": "CURIOUS" | "CONFUSED" | "CONCERNED" | "MATTER-OF-FACT",
  "tonalityNote": "One sentence on how to deliver it — specific tip (e.g. 'Drop your voice at the end, don't rise')",
  "whyThisWorks": "1-2 sentences on the psychology — why this question moves the needle right now",
  "antiPattern": null or "What the agent should NOT do right now — specific to this moment"
}

If the prospect said something that requires no NEPQ response (one-word filler, agent is speaking, or context is too thin), return: {"skip": true}`

  try {
    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system:     NEPQ_SYSTEM,
      messages: [{ role: 'user', content: user }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(jsonText)

    if (parsed.skip) return NextResponse.json({ skip: true })

    return NextResponse.json({
      skip:             false,
      stage:            parsed.stage            ?? 'discover',
      questionType:     parsed.questionType     ?? 'Situation',
      suggestedQuestion:parsed.suggestedQuestion ?? '',
      tonality:         parsed.tonality         ?? 'CURIOUS',
      tonalityNote:     parsed.tonalityNote     ?? '',
      whyThisWorks:     parsed.whyThisWorks     ?? '',
      antiPattern:      parsed.antiPattern      ?? null,
    })
  } catch (err) {
    console.error('[nepq-coach] error:', err)
    return NextResponse.json({ skip: true })
  }
}
