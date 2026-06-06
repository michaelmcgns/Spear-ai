'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mic, MicOff, PhoneOff, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Status    = 'ready' | 'listening' | 'ended' | 'error'
type Speaker   = 'agent' | 'prospect'
type CardType  = 'objection' | 'buying_signal' | 'closing'
type CallFocus =
  | 'mortgage_protection'
  | 'term_life'
  | 'final_expense'
  | 'iul'
  | 'medicare_supplement'
  | 'medicare_advantage'
  | 'annuities'

interface CoachEntry {
  id:        string
  cardType:  CardType
  triggers:  string[]
  label:     string
  cardTitle: string
  response:  string
  nextMove:  string
}
interface TranscriptLine {
  id: string; text: string; time: string; speaker: Speaker; isKeyMoment: boolean
}
interface DetectedCard {
  id:        string
  entryId:   string
  cardType:  CardType
  label:     string
  cardTitle: string
  trigger:   string
  response:  string
  nextMove:  string
  quote:     string
  time:      string
}

// ─── Focus metadata (UI only — detection is universal NEPQ library) ───────────

const FOCUS_OPTIONS: { value: CallFocus; label: string }[] = [
  { value: 'mortgage_protection',  label: 'Mortgage Protection' },
  { value: 'term_life',            label: 'Term Life' },
  { value: 'final_expense',        label: 'Final Expense / Burial' },
  { value: 'iul',                  label: 'IUL (Indexed Universal Life)' },
  { value: 'medicare_supplement',  label: 'Medicare Supplement' },
  { value: 'medicare_advantage',   label: 'Medicare Advantage' },
  { value: 'annuities',            label: 'Annuities' },
]

const FOCUS_BADGE: Record<CallFocus, string> = {
  mortgage_protection: 'MORT PROTECT',
  term_life:           'TERM LIFE',
  final_expense:       'FINAL EXPENSE',
  iul:                 'IUL',
  medicare_supplement: 'MED SUPP',
  medicare_advantage:  'MED ADVANTAGE',
  annuities:           'ANNUITIES',
}

// ─── Fuzzy matching engine ────────────────────────────────────────────────────
//
// Matching rules (in priority order):
//  1. If the normalized trigger appears as a substring → direct match (score = phrase length)
//  2. Otherwise extract content words (len > 2, not in STOP) and check coverage:
//     if ≥ 65% of content words appear in the text → keyword match (score = count matched)
// Highest score across all triggers & entries wins. No match if score = 0.

const STOP = new Set(['a','an','the','and','but','for','nor','yet','some','any','from','with','this','that','than','when','then','what','who'])

function norm(s: string): string {
  return s.toLowerCase()
    .replace(/[''`]/g, '')        // flatten apostrophes so "don't" → "dont"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function triggerScore(normText: string, trigger: string): number {
  const nTrig = norm(trigger)
  if (normText.includes(nTrig)) return nTrig.length   // direct — length rewards specificity

  const words = nTrig.split(' ').filter(w => w.length > 2 && !STOP.has(w))
  if (words.length < 2) return 0
  const hit = words.filter(w => normText.includes(w)).length
  return hit / words.length >= 0.65 ? hit : 0
}

// ─── NEPQ-based universal coaching library ────────────────────────────────────

const OBJECTION_DB: CoachEntry[] = [
  {
    id: 'confusion',
    cardType: 'objection',
    triggers: [
      'no idea', 'what is this', 'what are you calling about',
      'dont understand', 'what does that mean', 'never heard of',
      'what is mortgage protection', 'what is final expense',
      'dont know what you', 'what are you talking about',
      'not sure what you mean', 'what kind of insurance',
    ],
    label: 'Confusion',
    cardTitle: 'OBJECTION — CONFUSION',
    response: "That's completely fair — let me be clearer. I'm calling about a protection benefit specifically tied to your [home/policy]. Most people in your area have never been contacted about it. It takes 90 seconds to explain — can I do that?",
    nextMove: "Reset the opener in ONE sentence. Then ask one yes/no question to re-engage.",
  },
  {
    id: 'not_interested',
    cardType: 'objection',
    triggers: [
      'not interested', 'dont want it', 'dont need it', 'no thank you',
      'im good', 'were fine', 'dont want any insurance',
      'dont believe in life insurance', 'no thanks', 'dont need insurance',
      'not looking for insurance', 'im all set', 'not for me',
    ],
    label: 'Not Interested',
    cardTitle: 'OBJECTION — NOT INTERESTED',
    response: "I hear you — and I'm not here to sell you anything today. Can I ask you something though? If something happened to you tomorrow, who in your life would be most financially impacted? That's really all this comes down to.",
    nextMove: "NEPQ problem-awareness question. Make it about a specific person, not a concept.",
  },
  {
    id: 'already_covered',
    cardType: 'objection',
    triggers: [
      'already have insurance', 'already have coverage', 'already have a policy',
      'have life insurance', 'covered through work', 'have it through my job',
      'union covers', 'have aarp', 'through the va', 'work covers me',
      'company provides insurance', 'have coverage at work', 'already covered',
      'employer covers', 'have group life', 'benefit through my employer',
    ],
    label: 'Already Has Coverage',
    cardTitle: 'OBJECTION — ALREADY COVERED',
    response: "That's great — most people I talk to do. Quick question: how much coverage do you currently have? [pause] The reason I ask is most employer plans only cover 1–2x your salary. Financial advisors recommend 7–10x. If you passed away tonight, how long would what you have last your family?",
    nextMove: "Gap sell. Find the exact number they have vs what they need. Never attack their current policy.",
  },
  {
    id: 'too_expensive',
    cardType: 'objection',
    triggers: [
      'too expensive', 'cant afford', 'costs too much', 'dont have the money',
      'on a fixed income', 'tight on money', 'budget is tight',
      'cant do it right now', 'money is tight', 'not in my budget',
      'too much money', 'cant swing it', 'financially not possible',
      'strapped right now', 'fixed income',
    ],
    label: 'Too Expensive / Can\'t Afford',
    cardTitle: 'OBJECTION — PRICE / AFFORDABILITY',
    response: "I completely understand — and I'd never suggest anything outside your budget. Can I ask — what would feel comfortable? Most of the people I help spend less than a dollar a day. But more importantly, if you couldn't afford it, who in your life would be stuck with the financial burden if something happened?",
    nextMove: "Anchor to daily cost, not monthly. Then redirect to the consequence question.",
  },
  {
    id: 'need_to_think',
    cardType: 'objection',
    triggers: [
      'need to think about it', 'let me think', 'ill think about it',
      'think it over', 'not sure yet', 'need more time',
      'give me some time', 'want to think', 'have to think',
      'think about it', 'need to consider', 'let me sleep on it',
    ],
    label: 'Need to Think About It',
    cardTitle: 'OBJECTION — STALL / THINK ABOUT IT',
    response: "That makes total sense — what part specifically did you want to think through? Is it the cost, whether you actually need it, or something else? I ask because most people I talk to who say that have a specific concern I might be able to address right now.",
    nextMove: "NEPQ: isolate the REAL objection. \"Think about it\" is never the real objection — find what's underneath it.",
  },
  {
    id: 'need_spouse',
    cardType: 'objection',
    triggers: [
      'need to talk to my wife', 'need to talk to my husband',
      'have to ask my spouse', 'run it by my partner',
      'cant decide without', 'my wife handles finances',
      'my husband handles that', 'check with my wife',
      'check with my husband', 'spouse needs to know',
      'wife would have to agree', 'husband would have to agree',
      'ask my partner', 'talk to my spouse first',
    ],
    label: 'Need to Talk to Spouse',
    cardTitle: 'OBJECTION — NEEDS SPOUSE',
    response: "Absolutely — this should be a joint decision. Is your [spouse] available right now? I'd love to talk to both of you together so no one has to play telephone with the details. It only takes a few minutes.",
    nextMove: "Get the spouse on the call NOW. If not available, set a specific callback time with both on the line.",
  },
  {
    id: 'send_info',
    cardType: 'objection',
    triggers: [
      'send me something', 'send me information', 'email me',
      'mail me something', 'put something in the mail',
      'send a brochure', 'send me a link', 'send me details',
      'can you send', 'ill look it over', 'send it to me',
      'drop something in the mail', 'email me the info',
    ],
    label: 'Send Me Information',
    cardTitle: 'OBJECTION — SEND INFO',
    response: "I can absolutely do that. I want to make sure I send you the right thing — can I ask two quick questions first so I don't waste your time with irrelevant info? [pause] How much coverage do you currently have, and who are you trying to protect?",
    nextMove: "Never just say yes and hang up. Use it as an opener for 2 qualifying questions.",
  },
  {
    id: 'bad_timing',
    cardType: 'objection',
    triggers: [
      'bad time', 'im busy', 'call me back', 'call back later',
      'call me later', 'at work right now', 'driving right now',
      'in the middle of something', 'not a good time',
      'busy right now', 'not a great time', 'caught me',
      'cant talk right now', 'running out the door', 'on my way',
    ],
    label: 'Bad Timing',
    cardTitle: 'OBJECTION — BAD TIMING',
    response: "I completely understand — I only need 90 seconds. The reason I'm calling is there's a benefit specifically available to you that has a limited enrollment window. Can I get just 90 seconds?",
    nextMove: "Ask for 90 seconds specifically. If they still say no: \"Is 6pm tonight better or tomorrow morning?\"",
  },
  {
    id: 'strong_rejection',
    cardType: 'objection',
    triggers: [
      'leave me alone', 'lose my number', 'stop calling',
      'dont call again', 'take me off your list', 'i said no',
      'im hanging up', 'remove me from', 'never call again',
      'do not call', 'put me on your do not call',
      'get off my phone', 'stop bothering me',
    ],
    label: 'Strong Rejection',
    cardTitle: 'OBJECTION — STRONG REJECTION',
    response: "I will absolutely respect that and won't call again. Before I go — I just want to make sure you know the benefit exists. Your home at [address] qualifies for a protection benefit your family can claim. I'm not asking you to do anything — I just want you to know it's there. Take care.",
    nextMove: "Plant the seed and exit gracefully. Do not push. This call is a long-term play.",
  },
  {
    id: 'bank_covers',
    cardType: 'objection',
    triggers: [
      'the bank covers', 'my mortgage has insurance', 'pmi covers',
      'the lender has', 'bank already does that', 'my mortgage covers',
      'lender covers', 'mortgage insurance', 'pmi', 'bank handles that',
      'my lender', 'already have mortgage insurance',
    ],
    label: 'The Bank / PMI Covers It',
    cardTitle: 'OBJECTION — PMI CONFUSION',
    response: "That's a really common misconception — and I'm glad you brought it up. PMI protects the bank if you default, not your family if you die. If something happened to you tomorrow, PMI pays the bank — not your family. This benefit pays your family directly so they keep the home. That's the difference.",
    nextMove: "Clarify PMI vs mortgage protection clearly. Ask: \"Did you know there was a difference?\"",
  },
  {
    id: 'no_dependents',
    cardType: 'objection',
    triggers: [
      'live alone', 'no kids', 'just me', 'nobody depends on me',
      'im single', 'kids are grown', 'kids are out of the house',
      'divorced', 'no family', 'no one depends on me',
      'nobody to leave it to', 'dont have anyone', 'kids are adults',
    ],
    label: 'No Dependents',
    cardTitle: 'OBJECTION — NO DEPENDENTS',
    response: "I understand — and this still matters for one reason: if something happened to you, who would be responsible for your final expenses and any remaining debt on your home? Even if no one depends on your income, someone has to handle what you leave behind.",
    nextMove: "Shift from income protection to estate/debt protection angle.",
  },
  {
    id: 'health_concerns',
    cardType: 'objection',
    triggers: [
      'not in good health', 'have health issues', 'im diabetic',
      'heart problems', 'been sick', 'had cancer', 'might not qualify',
      'not sure i can get coverage', 'health problems',
      'pre existing condition', 'previous condition',
      'been denied before', 'denied for insurance', 'have a condition',
      'taking medications', 'medical history',
    ],
    label: 'Health Concerns',
    cardTitle: 'OBJECTION — HEALTH CONCERNS',
    response: "I appreciate you sharing that — and that's actually the most important reason to look at this now, not later. Several of the plans I work with have guaranteed acceptance with no medical exam. Your health doesn't disqualify you. Can I ask how old you are?",
    nextMove: "Move to guaranteed issue / simplified issue products. Age and tobacco use matter more than health.",
  },
  {
    id: 'too_old',
    cardType: 'objection',
    triggers: [
      'too old', 'im 80', 'probably too old', 'at my age',
      'dont have long', 'im 75', 'im 85', 'im 78', 'im 82',
      'getting up there in age', 'pretty old', 'older now',
      'my age probably', 'given my age',
    ],
    label: 'Too Old',
    cardTitle: 'OBJECTION — TOO OLD',
    response: "Actually, many of the plans I work with go up to age 85 with no medical exam. And at your age, final expense coverage is often the most important thing — it means your family doesn't have to come out of pocket for funeral costs which average $12,000–$15,000. Can I ask — does your family have that set aside?",
    nextMove: "Anchor on the $12,000–$15,000 funeral cost as a concrete, specific number.",
  },
  {
    id: 'scam_concern',
    cardType: 'objection',
    triggers: [
      'sounds like a scam', 'how do i know this is real', 'is this legit',
      'how did you get my number', 'dont give out my information',
      'what company are you with', 'who do you work for',
      'is this a scam', 'are you legitimate', 'how do i verify',
      'sounds sketchy', 'not sure this is real', 'prove it',
      'what is your license', 'are you licensed',
    ],
    label: 'Scam / Legitimacy Concern',
    cardTitle: 'OBJECTION — CREDIBILITY / SCAM CONCERN',
    response: "That's a completely fair question — and honestly I'd be suspicious too. My name is [name], I'm a licensed insurance agent in [state] with [company]. You can look me up on your state's department of insurance website right now while we talk. What else can I answer?",
    nextMove: "Lead with your license number. Offer to verify on the spot. Transparency closes skeptics.",
  },
  {
    id: 'religious',
    cardType: 'objection',
    triggers: [
      'need to pray about it', 'have to pray on it', 'god will provide',
      'i trust god', 'faith will take care', 'leave it in gods hands',
      'lord will provide', 'trust the lord', 'pray about this',
      'put it in gods hands', 'let god handle it',
    ],
    label: 'Religious / Need to Pray',
    cardTitle: 'OBJECTION — FAITH / PRAYER',
    response: "I respect that completely — and I believe the same. Can I share a perspective? Most faith traditions also teach that we're stewards of what we're given — including protecting our families. This is one way to honor that. What would it look like if your family had financial peace no matter what happened?",
    nextMove: "Use their values as the bridge, not a counter-argument. Frame protection as stewardship.",
  },
  {
    id: 'has_agent',
    cardType: 'objection',
    triggers: [
      'already have an agent', 'already working with someone',
      'my agent handles', 'have a guy for that', 'my financial advisor',
      'use my own agent', 'work with an advisor', 'have a broker',
      'have a financial planner', 'dont need another agent',
      'my current agent', 'someone i already work with',
    ],
    label: 'Already Has an Agent',
    cardTitle: 'OBJECTION — ALREADY HAS AGENT',
    response: "That's great — you should absolutely keep working with them. Can I ask when you last reviewed your coverage with them? The reason I ask is most agents set it and forget it, and your needs change. When's the last time they called YOU to check in?",
    nextMove: "Expose the service gap. Position yourself as the agent who actually follows up.",
  },
]

const BUYING_SIGNALS: CoachEntry[] = [
  {
    id: 'price_question',
    cardType: 'buying_signal',
    triggers: [
      'how much does it cost', 'how much would that be', 'whats the price',
      'how much is it', 'what would my payment be', 'how much a month',
      'what does it cost', 'how much per month', 'what are the rates',
      'what would that run me', 'how much would i pay',
    ],
    label: 'Price Question',
    cardTitle: 'KEY OPPORTUNITY — PRICE QUESTION',
    response: "Great question — before I give you a number, let me ask: how much coverage are you looking at? [pause] And are you looking to protect just yourself or include your spouse?",
    nextMove: "Never lead with price. Qualify coverage amount and family situation FIRST.",
  },
  {
    id: 'engaged',
    cardType: 'buying_signal',
    triggers: [
      'sounds good', 'im interested', 'tell me more', 'i like that',
      'that makes sense', 'okay im listening', 'thats interesting',
      'i like what you said', 'tell me about it', 'keep going',
      'explain that', 'go on', 'interesting', 'i hear you',
    ],
    label: 'Prospect Engaged',
    cardTitle: 'KEY OPPORTUNITY — PROSPECT ENGAGED',
    response: "Great — so let me ask you this: what would it mean to your family if your home was completely paid off if something happened to you?",
    nextMove: "Deepen emotional commitment before moving to application. Ask the consequence question.",
  },
  {
    id: 'closing',
    cardType: 'closing',
    triggers: [
      'where do i start', 'how do i sign up', 'what do i do next',
      'when would it start', 'let me get my card', 'ready to sign',
      'how do we proceed', 'id like to do this', 'ill take it',
      'lets do it', 'how do i apply', 'sign me up',
      'what do you need from me', 'how long does it take to apply',
    ],
    label: 'Closing Signal',
    cardTitle: 'CLOSING SIGNAL — MOVE TO APPLICATION',
    response: "Perfect — it takes about 10 minutes. I just need to ask you a few health questions and get some basic information. What's your date of birth?",
    nextMove: "Start the application NOW. Do not schedule a callback. Close on this call.",
  },
]

// Combined for iteration — buying signals checked first so they beat objections on overlap
const COACH_DB: CoachEntry[] = [...BUYING_SIGNALS, ...OBJECTION_DB]

// ─── Sentiment / phase / key-moment data ─────────────────────────────────────

const KEY_MOMENT_TRIGGERS = [
  'how much', 'what does it cost', 'tell me more', 'interested', 'sounds good',
  'how does it work', 'what are the benefits', 'what would i get',
  'how long does it take', 'when would it start', 'how do i sign up',
]

const NEGATIVE_WORDS = [
  'annoying', 'not interested', 'over it', "don't want", 'no thanks', 'stop calling',
  'waste of time', 'ridiculous', 'never', 'forget it', 'leave me alone', 'hate',
]
const POSITIVE_WORDS = [
  'sounds good', 'tell me more', 'interested', 'absolutely', 'definitely', 'love that',
  'that makes sense', 'good point', 'helpful', 'appreciate', 'excited', 'yes', 'great',
]

const PHASES = ['Opener', 'Discovery', 'Presentation', 'Objection Handling', 'Close']
const PHASE_CLOSE_KWORDS    = ['get started', 'sign up', "let's do it", 'move forward', 'enroll', 'how do i start']
const PHASE_PRESENT_KWORDS  = ['coverage', 'plan', 'policy', 'benefit', 'premium', 'protect', 'payout', 'term']
const PHASE_DISCOVER_KWORDS = ['family', 'kids', 'income', 'job', 'health', 'currently', 'situation', 'how many']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

function computePhase(elapsed: number, lines: TranscriptLine[], objCount: number): number {
  const text = lines.map(l => l.text.toLowerCase()).join(' ')
  if (PHASE_CLOSE_KWORDS.some(k => text.includes(k))) return 4
  if (objCount > 0) return 3
  if (elapsed > 180 || PHASE_PRESENT_KWORDS.some(k => text.includes(k))) return 2
  if (elapsed > 60  || PHASE_DISCOVER_KWORDS.some(k => text.includes(k))) return 1
  return 0
}

function computeSentiment(score: number): { label: string; color: string; pct: number } {
  if (score > 1)  return { label: 'Positive', color: '#4A7C59', pct: Math.min(100, 60 + score * 12) }
  if (score < -1) return { label: 'Negative', color: '#C0392B', pct: Math.max(0,  40 + score * 12) }
  return { label: 'Neutral', color: '#8C6D2F', pct: 50 }
}

// Card type → style tokens
function cardStyle(ct: CardType) {
  if (ct === 'closing') return {
    bg: '#F0FFF8', border: 'rgba(42,122,90,0.3)', accent: '#2A7A5A',
    badgeBg: 'rgba(42,122,90,0.12)', badgeColor: '#2A7A5A', labelColor: '#2A7A5A',
    innerBg: '#E8F7F0', responseLabelColor: '#2A7A5A',
  }
  if (ct === 'buying_signal') return {
    bg: '#F2FBF4', border: 'rgba(74,124,89,0.28)', accent: '#4A7C59',
    badgeBg: 'rgba(74,124,89,0.12)', badgeColor: '#4A7C59', labelColor: '#4A7C59',
    innerBg: '#E8F5EC', responseLabelColor: '#4A7C59',
  }
  // objection
  return {
    bg: '#FFF5F4', border: 'rgba(192,57,43,0.25)', accent: '#C0392B',
    badgeBg: 'rgba(192,57,43,0.1)', badgeColor: '#C0392B', labelColor: '#C0392B',
    innerBg: '#FDFAF5', responseLabelColor: '#8C6D2F',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveCallPage() {
  const [status,         setStatus]         = useState<Status>('ready')
  const [callFocus,      setCallFocus]      = useState<CallFocus>('mortgage_protection')
  const [lines,          setLines]          = useState<TranscriptLine[]>([])
  const [interim,        setInterim]        = useState('')
  const [speaker,        setSpeaker]        = useState<Speaker>('agent')
  const [cards,          setCards]          = useState<DetectedCard[]>([])
  const [latestCard,     setLatestCard]     = useState<DetectedCard | null>(null)
  const [elapsed,        setElapsed]        = useState(0)
  const [muted,          setMuted]          = useState(false)
  const [err,            setErr]            = useState('')
  const [showSummary,    setShowSummary]    = useState(false)
  const [score,          setScore]          = useState(7.0)
  const [sentimentScore, setSentimentScore] = useState(0)

  const recognitionRef   = useRef<any>(null)
  const statusRef        = useRef<Status>('ready')
  const speakerRef       = useRef<Speaker>('agent')
  const focusRef         = useRef<CallFocus>('mortgage_protection')
  const elapsedRef       = useRef(0)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flashRef         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFiredRef     = useRef<string | null>(null)   // id of last entry fired; prevents consecutive repeats
  const scrollRef        = useRef<HTMLDivElement>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const liveRef          = useRef({ lines: [] as TranscriptLine[], cardCount: 0, sentimentScore: 0 })

  useEffect(() => {
    liveRef.current = { lines, cardCount: cards.length, sentimentScore }
  }, [lines, cards, sentimentScore])

  useEffect(() => {
    const prospectLines = lines.filter(l => l.speaker === 'prospect').slice(-5)
    if (prospectLines.length === 0) return
    const text = prospectLines.map(l => l.text).join(' ').toLowerCase()
    let s = 0
    NEGATIVE_WORDS.forEach(w => { if (text.includes(w)) s -= 1 })
    POSITIVE_WORDS.forEach(w => { if (text.includes(w)) s += 1 })
    setSentimentScore(Math.max(-3, Math.min(3, s)))
  }, [lines])

  const setStatusSynced = useCallback((s: Status) => {
    statusRef.current = s; setStatus(s)
  }, [])

  const setSpeakerSynced = useCallback((s: Speaker) => {
    speakerRef.current = s; setSpeaker(s)
  }, [])

  const setCallFocusSynced = useCallback((f: CallFocus) => {
    focusRef.current = f
    setCallFocus(f)
    lastFiredRef.current = null   // reset consecutive block so focus-switch allows re-fire
  }, [])

  // ── Core detection — runs within 1s of every finalized prospect line ────────
  const checkLine = useCallback((text: string, time: string) => {
    const normText = norm(text)
    let bestEntry: CoachEntry | null = null
    let bestScore = 0
    let bestTrigger = ''

    for (const entry of COACH_DB) {
      for (const trigger of entry.triggers) {
        const s = triggerScore(normText, trigger)
        if (s > bestScore) {
          bestScore = s
          bestEntry = entry
          bestTrigger = trigger
        }
      }
    }

    if (!bestEntry || bestScore === 0) return
    if (lastFiredRef.current === bestEntry.id) return  // never same card twice in a row

    lastFiredRef.current = bestEntry.id
    const card: DetectedCard = {
      id:        crypto.randomUUID(),
      entryId:   bestEntry.id,
      cardType:  bestEntry.cardType,
      label:     bestEntry.label,
      cardTitle: bestEntry.cardTitle,
      trigger:   bestTrigger,
      response:  bestEntry.response,
      nextMove:  bestEntry.nextMove,
      quote:     text,
      time,
    }
    setCards(prev => [card, ...prev])
    setLatestCard(card)
    if (flashRef.current) clearTimeout(flashRef.current)
    flashRef.current = setTimeout(() => setLatestCard(null), 9000)
  }, [])

  const stopCall = useCallback((withSummary = true) => {
    if (timerRef.current)         { clearInterval(timerRef.current);         timerRef.current = null }
    if (scoreIntervalRef.current) { clearInterval(scoreIntervalRef.current); scoreIntervalRef.current = null }
    if (flashRef.current)         { clearTimeout(flashRef.current);          flashRef.current = null }
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setMuted(false); setInterim(''); setLatestCard(null)
    setStatusSynced('ended')
    if (withSummary) setShowSummary(true)
  }, [setStatusSynced])

  const startCall = useCallback(async () => {
    if (typeof window === 'undefined') return
    setErr('')
    setStatusSynced('listening')
    setSpeakerSynced('agent')
    lastFiredRef.current = null
    elapsedRef.current = 0
    setLines([]); setCards([]); setInterim(''); setLatestCard(null)
    setShowSummary(false); setElapsed(0); setMuted(false)
    setScore(7.0); setSentimentScore(0)

    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SR) throw new Error('no-support')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
      }, 1000)

      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
      scoreIntervalRef.current = setInterval(() => {
        const { lines: ls, cardCount, sentimentScore: sent } = liveRef.current
        const agentC    = ls.filter(l => l.speaker === 'agent').reduce((a, l) => a + l.text.length, 0)
        const prospectC = ls.filter(l => l.speaker === 'prospect').reduce((a, l) => a + l.text.length, 0)
        const total     = agentC + prospectC || 1
        const prospPct  = prospectC / total
        const kmCount   = ls.filter(l => l.isKeyMoment).length
        let s = 7.0
        s += Math.min(cardCount * 0.2, 1.0)
        if (elapsedRef.current > 180) s += 0.3
        if (elapsedRef.current > 300) s += 0.2
        if (total > 80) {
          if (prospPct >= 0.38 && prospPct <= 0.72) s += 0.3
          else if (prospPct < 0.25) s -= 0.5
        }
        if (sent < -1) s -= 0.5
        else if (sent > 1) s += 0.2
        s += Math.min(kmCount * 0.15, 0.45)
        setScore(Math.max(0, Math.min(10, Math.round(s * 10) / 10)))
      }, 15000)

      const recognition = new SR()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: any) => {
        const time = fmt(elapsedRef.current)
        const currentSpeaker = speakerRef.current
        let newInterim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            const text = transcript.trim()
            if (!text) continue
            const lower = text.toLowerCase()
            const isKeyMoment = currentSpeaker === 'prospect' &&
              KEY_MOMENT_TRIGGERS.some(k => lower.includes(k))
            setLines(prev => [...prev, { id: crypto.randomUUID(), text, time, speaker: currentSpeaker, isKeyMoment }])
            if (currentSpeaker === 'prospect') checkLine(text, time)
            setTimeout(() => {
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }, 50)
          } else {
            newInterim += transcript
          }
        }
        setInterim(newInterim)
      }

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return
        if (event.error === 'not-allowed') {
          setErr('Microphone access denied. Allow microphone access in your browser settings.')
          stopCall(false); setStatusSynced('error')
        } else {
          console.warn('[SpeechRecognition] error:', event.error)
        }
      }

      recognition.onend = () => {
        if (statusRef.current === 'listening') {
          try { recognition.start() } catch {}
        }
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch (e: any) {
      if (e.message === 'no-support') {
        setErr('Speech recognition is not supported in this browser. Please use Google Chrome.')
      } else if (e.name === 'NotAllowedError' || (e.message ?? '').toLowerCase().includes('denied')) {
        setErr('Microphone access denied. Allow microphone access and try again.')
      } else {
        setErr(e.message || 'Failed to start. Check microphone permissions and try again.')
      }
      setStatusSynced('error')
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (timerRef.current)         { clearInterval(timerRef.current);         timerRef.current = null }
      if (scoreIntervalRef.current) { clearInterval(scoreIntervalRef.current); scoreIntervalRef.current = null }
    }
  }, [checkLine, stopCall, setStatusSynced, setSpeakerSynced])

  const endCall    = useCallback(() => stopCall(true), [stopCall])
  const toggleMute = useCallback(() => {
    if (!streamRef.current) return
    const next = !muted
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next })
    setMuted(next)
  }, [muted])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
      try { recognitionRef.current?.stop() } catch {}
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // ─── Derived values ──────────────────────────────────────────────────────────

  const isLive = status === 'listening'

  const agentChars    = lines.filter(l => l.speaker === 'agent').reduce((a, l) => a + l.text.length, 0)
  const prospectChars = lines.filter(l => l.speaker === 'prospect').reduce((a, l) => a + l.text.length, 0)
  const talkTotal     = agentChars + prospectChars || 1
  const agentPct      = Math.round(agentChars / talkTotal * 100)
  const prospectPct   = 100 - agentPct

  const phase      = computePhase(elapsed, lines, cards.filter(c => c.cardType === 'objection').length)
  const sentiment  = computeSentiment(sentimentScore)
  const keyMoments = lines.filter(l => l.isKeyMoment)
  const scoreColor = score >= 7.5 ? '#4A7C59' : score >= 5.5 ? '#C9A84C' : '#C0392B'

  // ─── Flash card renderer (inline) ────────────────────────────────────────────

  const renderFlashCard = (card: DetectedCard) => {
    const cs = cardStyle(card.cardType)
    return (
      <div style={{ margin: '0 12px 12px', padding: '12px 14px', borderRadius: 9, border: `1px solid ${cs.border}`, borderLeft: `3px solid ${cs.accent}`, backgroundColor: cs.bg, flexShrink: 0, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: cs.badgeColor, backgroundColor: cs.badgeBg, padding: '2px 8px', borderRadius: 4 }}>{card.cardTitle}</span>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{card.quote}&rdquo;</p>
        <div style={{ backgroundColor: cs.innerBg, border: '1px solid #DDD5BB', borderRadius: 7, padding: '9px 11px', marginBottom: 7 }}>
          <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: cs.responseLabelColor }}>SUGGESTED RESPONSE</p>
          <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E', lineHeight: 1.6 }}>{card.response}</p>
        </div>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: cs.accent }}>
          NEXT MOVE &nbsp;<span style={{ fontWeight: 400, color: '#5A6A50', letterSpacing: 0 }}>{card.nextMove}</span>
        </p>
        <button onClick={() => setLatestCard(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9A9080', display: 'flex', padding: 2 }}>
          <X size={12} />
        </button>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F5F0E8', fontFamily: 'var(--font-space, system-ui, sans-serif)', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{ backgroundColor: '#1A2C1E', height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/dashboard" style={{ color: '#C8D9CB', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 12 }}>
            <ArrowLeft size={13} /> Dashboard
          </Link>
          <span style={{ color: '#4A7C59', opacity: 0.5 }}>|</span>
          <span style={{ color: '#C8D9CB', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em' }}>SPEAR LIVE</span>
          <span style={{ padding: '3px 9px', borderRadius: 20, backgroundColor: 'rgba(74,124,89,0.2)', border: '1px solid rgba(74,124,89,0.4)', fontSize: 9, fontWeight: 800, color: '#4A7C59', letterSpacing: '0.09em' }}>
            {FOCUS_BADGE[callFocus]}
          </span>
          {isLive && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, backgroundColor: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.35)', fontSize: 10, fontWeight: 700, color: '#E07060', letterSpacing: '0.08em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#E07060', animation: 'livePulse 1.4s ease-in-out infinite', display: 'inline-block' }} />
              LIVE
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isLive && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(200,217,203,0.55)' }}>SCORE</span>
              <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: scoreColor }}>{score.toFixed(1)}</span>
              <span style={{ fontSize: 9, color: 'rgba(200,217,203,0.4)' }}>/10</span>
            </div>
          )}
          {isLive && <span style={{ color: '#4A7C59', opacity: 0.4 }}>|</span>}
          {isLive && <span style={{ color: '#C8D9CB', fontFamily: 'monospace', fontSize: 13 }}>{fmt(elapsed)}</span>}
          {isLive && (
            <button onClick={toggleMute} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, backgroundColor: muted ? 'rgba(139,58,58,0.2)' : 'rgba(255,255,255,0.07)', border: `1px solid ${muted ? 'rgba(139,58,58,0.4)' : 'rgba(255,255,255,0.1)'}`, color: muted ? '#D08080' : '#C8D9CB', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              {muted ? <MicOff size={12} /> : <Mic size={12} />}
              {muted ? 'Unmute' : 'Mute'}
            </button>
          )}
          {isLive && (
            <button onClick={endCall} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 7, backgroundColor: 'rgba(139,58,58,0.2)', border: '1px solid rgba(139,58,58,0.45)', color: '#D08080', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <PhoneOff size={12} /> End Call
            </button>
          )}
        </div>
      </header>

      {/* ── Ready / Error screen ── */}
      {!isLive && status !== 'ended' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#FDFAF5', border: '1px solid #DDD5BB', borderRadius: 16, padding: '36px 32px', maxWidth: 480, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(74,124,89,0.12)', border: '1px solid rgba(74,124,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Mic size={20} style={{ color: '#4A7C59' }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1A', margin: '0 0 6px', textAlign: 'center' }}>Live Call Coaching</h2>
            <p style={{ fontSize: 13, color: '#7A7060', margin: '0 0 20px', lineHeight: 1.6, textAlign: 'center' }}>
              Select your product focus, then start the call. Spear listens for 16 objection types and 3 buying signals in real time.
            </p>

            <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>CALL FOCUS</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 20 }}>
              {FOCUS_OPTIONS.map(opt => {
                const active = callFocus === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setCallFocusSynced(opt.value)}
                    style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${active ? '#4A7C59' : '#DDD5BB'}`, backgroundColor: active ? '#1A2C1E' : '#F5F0E8', color: active ? '#C8D9CB' : '#5A5448', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.12s' }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {status === 'error' && err && (
              <div style={{ backgroundColor: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, padding: '10px 14px', color: '#922B21', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
                {err}
              </div>
            )}
            <p style={{ fontSize: 11, color: '#9A9080', margin: '0 0 14px', textAlign: 'center' }}>
              Requires Google Chrome &nbsp;·&nbsp; Microphone access needed
            </p>
            <button
              onClick={startCall}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px 0', borderRadius: 10, backgroundColor: '#1A2C1E', color: '#C8D9CB', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
            >
              <Mic size={15} /> Start Call
            </button>
          </div>
        </div>
      )}

      {/* ── Live panel ── */}
      {isLive && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: transcript */}
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', borderRight: '1px solid #DDD5BB', overflow: 'hidden' }}>

            {/* Phase bar */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: 34, backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0, gap: 2 }}>
              {PHASES.map((p, i) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: 4, backgroundColor: phase === i ? '#1A2C1E' : phase > i ? 'rgba(74,124,89,0.12)' : 'transparent', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', color: phase === i ? '#C8D9CB' : phase > i ? '#4A7C59' : '#B8AFA0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p}
                  </div>
                  {i < 4 && <span style={{ fontSize: 9, color: '#CCC5B0', flexShrink: 0, margin: '0 1px' }}>›</span>}
                </div>
              ))}
            </div>

            {/* Focus selector (mid-call) */}
            <div style={{ padding: '6px 12px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', color: '#9A9080', flexShrink: 0 }}>FOCUS</span>
              <select
                value={callFocus}
                onChange={e => setCallFocusSynced(e.target.value as CallFocus)}
                style={{ flex: 1, backgroundColor: '#EDE8DC', border: '1px solid #D4C9A8', borderRadius: 6, padding: '4px 8px', color: '#1C1C1A', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}
              >
                {FOCUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Speaker toggle */}
            <div style={{ padding: '7px 12px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>TRANSCRIPT</span>
              <div style={{ display: 'flex', gap: 3, backgroundColor: '#EDE8DC', borderRadius: 8, padding: 3 }}>
                <button onClick={() => setSpeakerSynced('agent')} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', backgroundColor: speaker === 'agent' ? '#1A2C1E' : 'transparent', color: speaker === 'agent' ? '#C8D9CB' : '#7A7060' }}>
                  Agent
                </button>
                <button onClick={() => setSpeakerSynced('prospect')} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', backgroundColor: speaker === 'prospect' ? '#1A2C1E' : 'transparent', color: speaker === 'prospect' ? '#C8D9CB' : '#7A7060' }}>
                  Prospect
                </button>
              </div>
            </div>

            {/* Talk ratio */}
            {lines.length > 0 && (
              <div style={{ padding: '5px 12px 7px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4A7C59' }}>YOU {agentPct}%</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#8C6D2F' }}>PROSPECT {prospectPct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${agentPct}%`, backgroundColor: '#4A7C59', transition: 'width 0.5s ease' }} />
                  <div style={{ flex: 1, backgroundColor: '#8C6D2F' }} />
                </div>
              </div>
            )}

            {/* Lines */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', backgroundColor: '#F5F0E8', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {lines.length === 0 && !interim ? (
                <p style={{ margin: 0, color: '#9A9080', fontSize: 13, fontStyle: 'italic' }}>
                  Listening… speak clearly and Spear will transcribe in real time.
                </p>
              ) : (
                <>
                  {lines.map(line => (
                    <div key={line.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 9, color: '#B0A898', fontFamily: 'monospace', flexShrink: 0, marginTop: 4 }}>{line.time}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', flexShrink: 0, marginTop: 4, minWidth: 52, color: line.speaker === 'agent' ? '#4A7C59' : '#8C6D2F' }}>
                        {line.speaker === 'agent' ? 'YOU' : 'PROSPECT'}
                      </span>
                      {line.isKeyMoment && (
                        <span style={{ color: '#8C6D2F', fontSize: 11, flexShrink: 0, marginTop: 3 }} title="Key moment">✦</span>
                      )}
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#2C2A1E', flex: 1 }}>{line.text}</p>
                    </div>
                  ))}
                  {interim && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 9, color: '#B0A898', fontFamily: 'monospace', flexShrink: 0, marginTop: 4 }}>{fmt(elapsed)}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', flexShrink: 0, marginTop: 4, minWidth: 52, color: speaker === 'agent' ? '#4A7C59' : '#8C6D2F' }}>
                        {speaker === 'agent' ? 'YOU' : 'PROSPECT'}
                      </span>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#9A9080', fontStyle: 'italic', flex: 1 }}>
                        {interim}<span style={{ opacity: 0.4 }}>_</span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Flash card */}
            {latestCard && renderFlashCard(latestCard)}
          </div>

          {/* Right: coaching panel */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#F5F0E8' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 12px' }}>

              {/* Cards header */}
              <div style={{ padding: '9px 12px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>COACHING CARDS</span>
                {cards.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {cards.filter(c => c.cardType !== 'objection').length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#4A7C59', backgroundColor: 'rgba(74,124,89,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                        {cards.filter(c => c.cardType !== 'objection').length} signals
                      </span>
                    )}
                    {cards.filter(c => c.cardType === 'objection').length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#C0392B', backgroundColor: 'rgba(192,57,43,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                        {cards.filter(c => c.cardType === 'objection').length} obj
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cards.length === 0 ? (
                  <p style={{ margin: 0, padding: '4px 2px', color: '#9A9080', fontSize: 13, fontStyle: 'italic' }}>Listening for objections and buying signals…</p>
                ) : cards.map(card => {
                  const cs = cardStyle(card.cardType)
                  return (
                    <div key={card.id} style={{ borderRadius: 10, border: `1px solid ${cs.border}`, overflow: 'hidden', backgroundColor: cs.bg }}>
                      <div style={{ padding: '7px 12px', backgroundColor: cs.badgeBg, borderBottom: `1px solid ${cs.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cs.labelColor }}>{card.label}</span>
                        <span style={{ fontSize: 10, color: '#9A9080' }}>{card.time}</span>
                      </div>
                      <div style={{ padding: '9px 12px' }}>
                        <p style={{ margin: '0 0 7px', fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{card.quote}&rdquo;</p>
                        <div style={{ backgroundColor: cs.innerBg, border: '1px solid #DDD5BB', borderRadius: 7, padding: '7px 10px', marginBottom: 7 }}>
                          <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: cs.responseLabelColor }}>SUGGESTED RESPONSE</p>
                          <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E', lineHeight: 1.6 }}>{card.response}</p>
                        </div>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: cs.accent }}>
                          NEXT MOVE &nbsp;<span style={{ fontWeight: 400, color: '#5A6A50', letterSpacing: 0 }}>{card.nextMove}</span>
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Sentiment */}
              <div style={{ margin: '4px 10px 0', borderRadius: 10, border: '1px solid #DDD5BB', overflow: 'hidden', backgroundColor: '#FDFAF5' }}>
                <div style={{ padding: '7px 12px', borderBottom: '1px solid #DDD5BB' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>PROSPECT SENTIMENT</span>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {lines.filter(l => l.speaker === 'prospect').length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12, color: '#9A9080', fontStyle: 'italic' }}>Waiting for prospect speech…</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 9 }}>
                        {(['Negative', 'Neutral', 'Positive'] as const).map(label => {
                          const active = sentiment.label === label
                          const col = label === 'Positive' ? '#4A7C59' : label === 'Negative' ? '#C0392B' : '#8C6D2F'
                          return (
                            <div key={label} style={{ flex: 1, textAlign: 'center', padding: '5px 4px', borderRadius: 5, backgroundColor: active ? `${col}18` : 'transparent', border: `1px solid ${active ? `${col}44` : 'transparent'}`, fontSize: 11, fontWeight: active ? 700 : 500, color: active ? col : '#B0A898' }}>
                              {label}
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'linear-gradient(to right, #C0392B 0%, #DDD5BB 50%, #4A7C59 100%)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '50%', left: `${sentiment.pct}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', backgroundColor: sentiment.color, border: '2px solid #FDFAF5', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.4s ease' }} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Key moments */}
              {keyMoments.length > 0 && (
                <div style={{ margin: '8px 10px 0', borderRadius: 10, border: '1px solid #DDD5BB', overflow: 'hidden', backgroundColor: '#FDFAF5' }}>
                  <div style={{ padding: '7px 12px', borderBottom: '1px solid #DDD5BB', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>KEY MOMENTS</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#8C6D2F', backgroundColor: 'rgba(140,109,47,0.1)', padding: '1px 7px', borderRadius: 8 }}>{keyMoments.length}</span>
                  </div>
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {keyMoments.map(km => (
                      <div key={km.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: '#8C6D2F', fontSize: 11, flexShrink: 0, marginTop: 1 }}>✦</span>
                        <div>
                          <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E', lineHeight: 1.5 }}>{km.text}</p>
                          <span style={{ fontSize: 10, color: '#B0A898' }}>{km.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Summary modal ── */}
      {showSummary && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(245,240,232,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 }}>
          <div style={{ backgroundColor: '#FDFAF5', border: '1px solid #DDD5BB', borderRadius: 16, padding: '36px 32px', maxWidth: 520, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1A', margin: '0 0 3px' }}>Call Complete</h2>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: '#4A7C59', backgroundColor: 'rgba(74,124,89,0.1)', padding: '2px 8px', borderRadius: 4 }}>{FOCUS_BADGE[callFocus]}</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: scoreColor }}>{score.toFixed(1)}<span style={{ fontSize: 11, color: '#B0A898', fontWeight: 400 }}>/10</span></span>
            </div>
            <p style={{ fontSize: 13, color: '#7A7060', margin: '10px 0 16px' }}>
              Duration: {fmt(elapsed)} &nbsp;·&nbsp; {lines.length} lines &nbsp;·&nbsp; {cards.filter(c => c.cardType === 'objection').length} objections &nbsp;·&nbsp; {cards.filter(c => c.cardType !== 'objection').length} buying signals &nbsp;·&nbsp; {keyMoments.length} key moments
            </p>

            {lines.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#4A7C59' }}>YOU {agentPct}%</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8C6D2F' }}>PROSPECT {prospectPct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${agentPct}%`, backgroundColor: '#4A7C59' }} />
                  <div style={{ flex: 1, backgroundColor: '#8C6D2F' }} />
                </div>
              </div>
            )}

            {cards.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>COACHING CARDS FIRED</p>
                {cards.map((card, i) => {
                  const cs = cardStyle(card.cardType)
                  return (
                    <div key={card.id} style={{ borderRadius: 9, border: `1px solid ${cs.border}`, overflow: 'hidden' }}>
                      <div style={{ padding: '7px 13px', backgroundColor: cs.badgeBg, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: cs.labelColor }}>{i + 1}. {card.label}</span>
                        <span style={{ fontSize: 11, color: '#9A9080' }}>@ {card.time}</span>
                      </div>
                      <p style={{ margin: 0, padding: '7px 13px', fontSize: 12, color: '#7A7060', fontStyle: 'italic' }}>&ldquo;{card.quote}&rdquo;</p>
                    </div>
                  )
                })}
              </div>
            )}

            {keyMoments.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>KEY MOMENTS</p>
                {keyMoments.map(km => (
                  <div key={km.id} style={{ display: 'flex', gap: 7, marginBottom: 4, alignItems: 'flex-start' }}>
                    <span style={{ color: '#8C6D2F', fontSize: 11, flexShrink: 0, marginTop: 1 }}>✦</span>
                    <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E' }}>{km.text} <span style={{ color: '#B0A898' }}>@ {km.time}</span></p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => {
                  setShowSummary(false); setStatusSynced('ready')
                  setLines([]); setCards([]); setElapsed(0); setErr('')
                  setScore(7.0); setSentimentScore(0)
                }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, backgroundColor: '#1A2C1E', color: '#C8D9CB', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                New Call
              </button>
              <Link href="/dashboard" style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #DDD5BB', color: '#7A7060', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
    </div>
  )
}
