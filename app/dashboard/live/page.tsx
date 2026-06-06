'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mic, MicOff, PhoneOff, X } from 'lucide-react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const OBJECTION_DB = [
  {
    triggers: ['no idea what you', "don't know what you're talking about", 'what is this', 'what are you talking about'],
    label: 'Confusion',
    response: "That's completely fair — I should have been clearer. I'm calling about the mortgage protection benefit tied to your home at [address]. It's a government-backed program. Did you know this was available to you?",
    nextMove: "Re-establish what you're calling about in one sentence. Get a yes/no.",
  },
  {
    triggers: ['i got to go', 'i have to go', "i'm busy", 'bad time', 'call me back', 'not a good time', 'call back later', 'not right now', 'busy right now'],
    label: 'Time Objection',
    response: "I completely understand — I only need 90 seconds. The reason I'm calling is there's a benefit tied specifically to your home that most homeowners never claim. Can I get just 90 seconds?",
    nextMove: "Ask for 90 seconds specifically. Never ask for \"a few minutes.\"",
  },
  {
    triggers: ['leave me alone', 'lose my number', 'stop calling', "don't call again", 'remove me'],
    label: 'Strong Rejection',
    response: "I hear you and I will absolutely respect that. Before I go — the only reason I called is there's a death benefit tied to your mortgage that pays off your home if something happens to you. I just want to make sure your family knows it exists. That's it.",
    nextMove: "Plant the seed and exit gracefully. Do not push further.",
  },
  {
    triggers: ['not interested', "don't want it", "don't need it", "i'm good", "we're fine", 'no thanks', 'not for me'],
    label: 'Not Interested',
    response: "I hear you. Most people I talk to say the same thing before they understand what this actually is. Can I ask — who in your life would be most financially impacted if you weren't around? That's really what this comes down to.",
    nextMove: "Find the emotional why. Make it about people, not product.",
  },
  {
    triggers: ['already have life insurance', 'already have a policy', 'have coverage through work', 'already have coverage', 'already covered'],
    label: 'Already Covered',
    response: "That's great — most employer plans only cover 1–2x your salary. If you passed away tonight, how long would that last your family? This is specifically designed to cover what your current policy doesn't.",
    nextMove: "Gap sell. Find out their current coverage amount vs what they actually need.",
  },
  {
    triggers: ['too expensive', "can't afford it", 'cannot afford', 'how much does it cost', "what's the price", 'how much is it', 'costs too much'],
    label: 'Price Objection',
    response: "Most people I talk to spend less than $1 a day on this. But before we even get to price — can I ask what it would mean to your family if your home was paid off if something happened to you?",
    nextMove: "Anchor to value before revealing price. Always.",
  },
  {
    triggers: ['need to think about it', 'let me think', "i'll think about it", 'need to talk to my spouse', 'talk to my wife', 'talk to my husband', 'check with my partner'],
    label: 'Stall Objection',
    response: "That makes complete sense — this is an important decision. What specifically would you need to think through? Is it the cost, the coverage, or something else?",
    nextMove: "Isolate the real objection. \"Think about it\" always means something else.",
  },
  {
    triggers: ['why do you sound like ai', 'are you a robot', 'is this automated', 'is this a recording'],
    label: 'Trust / Authenticity',
    response: "Ha — I get that a lot, I appreciate you saying that. I'm a real person, my name is [name]. The reason I sound scripted is I talk to a lot of homeowners every day. What's your first name?",
    nextMove: "Get their name immediately. Personalize everything from here.",
  },
  {
    triggers: ["nobody it's just me", 'i live alone', 'no family', 'no kids', 'divorced', 'just me'],
    label: 'No Dependents',
    response: "I completely understand. Even if there's no family to protect right now, this also covers your estate — so your home doesn't go into probate or leave debt behind. Does that matter to you?",
    nextMove: "Shift from family protection to estate/debt protection angle.",
  },
]

const KEY_MOMENT_TRIGGERS = [
  'how much', 'what does it cost', 'tell me more', 'interested', 'sounds good',
  'how does it work', 'what are the benefits', 'what would i get', 'how long does it take',
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Status   = 'ready' | 'listening' | 'ended' | 'error'
type Speaker  = 'agent' | 'prospect'

interface TranscriptLine {
  id: string; text: string; time: string; speaker: Speaker; isKeyMoment: boolean
}
interface DetectedObjection {
  id: string; label: string; trigger: string; response: string; nextMove: string; quote: string; time: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveCallPage() {
  const [status,          setStatus]          = useState<Status>('ready')
  const [lines,           setLines]           = useState<TranscriptLine[]>([])
  const [interim,         setInterim]         = useState('')
  const [speaker,         setSpeaker]         = useState<Speaker>('agent')
  const [objections,      setObjections]      = useState<DetectedObjection[]>([])
  const [latestObjection, setLatestObjection] = useState<DetectedObjection | null>(null)
  const [elapsed,         setElapsed]         = useState(0)
  const [muted,           setMuted]           = useState(false)
  const [err,             setErr]             = useState('')
  const [showSummary,     setShowSummary]     = useState(false)
  const [score,           setScore]           = useState(7.0)
  const [sentimentScore,  setSentimentScore]  = useState(0)

  const recognitionRef  = useRef<any>(null)
  const statusRef       = useRef<Status>('ready')
  const speakerRef      = useRef<Speaker>('agent')
  const elapsedRef      = useRef(0)
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flashRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenRef         = useRef(new Set<string>())
  const scrollRef       = useRef<HTMLDivElement>(null)
  const streamRef       = useRef<MediaStream | null>(null)
  // Live snapshot read by the score interval — avoids stale closures
  const liveRef         = useRef({ lines: [] as TranscriptLine[], objCount: 0, sentimentScore: 0 })

  useEffect(() => {
    liveRef.current = { lines, objCount: objections.length, sentimentScore }
  }, [lines, objections, sentimentScore])

  // Recompute sentiment after each prospect line finalises
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

  const checkObjection = useCallback((text: string, time: string) => {
    const lower = text.toLowerCase()
    for (const entry of OBJECTION_DB) {
      const matched = entry.triggers.find(t => lower.includes(t))
      if (!matched || seenRef.current.has(entry.label)) continue
      seenRef.current.add(entry.label)
      const obj: DetectedObjection = {
        id: crypto.randomUUID(), label: entry.label, trigger: matched,
        response: entry.response, nextMove: entry.nextMove, quote: text, time,
      }
      setObjections(prev => [obj, ...prev])   // most recent on top
      setLatestObjection(obj)
      if (flashRef.current) clearTimeout(flashRef.current)
      flashRef.current = setTimeout(() => setLatestObjection(null), 9000)
      break
    }
  }, [])

  const stopCall = useCallback((withSummary = true) => {
    if (timerRef.current)      { clearInterval(timerRef.current);       timerRef.current = null }
    if (scoreIntervalRef.current) { clearInterval(scoreIntervalRef.current); scoreIntervalRef.current = null }
    if (flashRef.current)      { clearTimeout(flashRef.current);        flashRef.current = null }
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setMuted(false); setInterim(''); setLatestObjection(null)
    setStatusSynced('ended')
    if (withSummary) setShowSummary(true)
  }, [setStatusSynced])

  const startCall = useCallback(async () => {
    if (typeof window === 'undefined') return
    setErr('')
    setStatusSynced('listening')
    setSpeakerSynced('agent')
    seenRef.current.clear()
    elapsedRef.current = 0
    setLines([]); setObjections([]); setInterim(''); setLatestObjection(null)
    setShowSummary(false); setElapsed(0); setMuted(false)
    setScore(7.0); setSentimentScore(0)

    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SR) throw new Error('no-support')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Main timer
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
      }, 1000)

      // Score recalculation every 15 s
      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
      scoreIntervalRef.current = setInterval(() => {
        const { lines: ls, objCount, sentimentScore: sent } = liveRef.current
        const agentC   = ls.filter(l => l.speaker === 'agent').reduce((a, l) => a + l.text.length, 0)
        const prospectC = ls.filter(l => l.speaker === 'prospect').reduce((a, l) => a + l.text.length, 0)
        const total    = agentC + prospectC || 1
        const prospPct = prospectC / total
        const kmCount  = ls.filter(l => l.isKeyMoment).length
        let s = 7.0
        s += Math.min(objCount * 0.25, 1.0)                          // objections handled
        if (elapsedRef.current > 180) s += 0.3                       // engaged call (3 min+)
        if (elapsedRef.current > 300) s += 0.2                       // 5 min+
        if (total > 80) {
          if (prospPct >= 0.38 && prospPct <= 0.72) s += 0.3         // healthy talk ratio
          else if (prospPct < 0.25) s -= 0.5                         // agent dominating
        }
        if (sent < -1) s -= 0.5                                      // negative sentiment
        else if (sent > 1) s += 0.2
        s += Math.min(kmCount * 0.15, 0.45)                          // key moments = buying signals
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
            if (currentSpeaker === 'prospect') checkObjection(text, time)
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
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      if (scoreIntervalRef.current) { clearInterval(scoreIntervalRef.current); scoreIntervalRef.current = null }
    }
  }, [checkObjection, stopCall, setStatusSynced, setSpeakerSynced])

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

  // ─── Derived values ────────────────────────────────────────────────────────

  const isLive = status === 'listening'

  const agentChars   = lines.filter(l => l.speaker === 'agent').reduce((a, l) => a + l.text.length, 0)
  const prospectChars = lines.filter(l => l.speaker === 'prospect').reduce((a, l) => a + l.text.length, 0)
  const talkTotal    = agentChars + prospectChars || 1
  const agentPct     = Math.round(agentChars / talkTotal * 100)
  const prospectPct  = 100 - agentPct

  const phase        = computePhase(elapsed, lines, objections.length)
  const sentiment    = computeSentiment(sentimentScore)
  const keyMoments   = lines.filter(l => l.isKeyMoment)

  const scoreColor   = score >= 7.5 ? '#4A7C59' : score >= 5.5 ? '#C9A84C' : '#C0392B'

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F5F0E8', fontFamily: 'var(--font-space, system-ui, sans-serif)', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{ backgroundColor: '#1A2C1E', height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/dashboard" style={{ color: '#C8D9CB', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 12 }}>
            <ArrowLeft size={13} /> Dashboard
          </Link>
          <span style={{ color: '#4A7C59' }}>|</span>
          <span style={{ color: '#C8D9CB', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em' }}>SPEAR LIVE</span>
          {isLive && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, backgroundColor: 'rgba(74,124,89,0.2)', border: '1px solid rgba(74,124,89,0.4)', fontSize: 10, fontWeight: 700, color: '#4A7C59', letterSpacing: '0.08em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4A7C59', animation: 'livePulse 1.4s ease-in-out infinite', display: 'inline-block' }} />
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
          {isLive && (
            <span style={{ color: '#C8D9CB', fontFamily: 'monospace', fontSize: 13 }}>{fmt(elapsed)}</span>
          )}
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

      {/* ── Ready / Error state ── */}
      {!isLive && status !== 'ended' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#FDFAF5', border: '1px solid #DDD5BB', borderRadius: 16, padding: '40px 36px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: 'rgba(74,124,89,0.12)', border: '1px solid rgba(74,124,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Mic size={20} style={{ color: '#4A7C59' }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1A', margin: '0 0 8px' }}>Live Call Coaching</h2>
            <p style={{ fontSize: 13, color: '#7A7060', margin: '0 0 6px', lineHeight: 1.6 }}>
              Spear listens to your call in real time and surfaces objection coaching the moment it&apos;s detected.
            </p>
            <p style={{ fontSize: 11, color: '#9A9080', margin: '0 0 24px' }}>
              Requires Google Chrome &nbsp;·&nbsp; Microphone access needed
            </p>
            {status === 'error' && err && (
              <div style={{ backgroundColor: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, padding: '10px 14px', color: '#922B21', fontSize: 13, marginBottom: 16, lineHeight: 1.5, textAlign: 'left' }}>
                {err}
              </div>
            )}
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
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: 36, backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0, gap: 2 }}>
              {PHASES.map((p, i) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: 4, backgroundColor: phase === i ? '#1A2C1E' : phase > i ? 'rgba(74,124,89,0.12)' : 'transparent', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', color: phase === i ? '#C8D9CB' : phase > i ? '#4A7C59' : '#B8AFA0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p}
                  </div>
                  {i < 4 && <span style={{ fontSize: 9, color: '#CCC5B0', flexShrink: 0, margin: '0 1px' }}>›</span>}
                </div>
              ))}
            </div>

            {/* Toggle row */}
            <div style={{ padding: '8px 12px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

            {/* Talk ratio bar */}
            {lines.length > 0 && (
              <div style={{ padding: '6px 12px 8px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
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

            {/* Objection flash */}
            {latestObjection && (
              <div style={{ margin: '0 12px 12px', padding: '12px 14px', borderRadius: 9, border: '1px solid rgba(192,57,43,0.25)', borderLeft: '3px solid #C0392B', backgroundColor: '#FFF5F4', flexShrink: 0, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#C0392B', backgroundColor: 'rgba(192,57,43,0.1)', padding: '2px 8px', borderRadius: 4 }}>OBJECTION DETECTED</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1A' }}>{latestObjection.label}</span>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{latestObjection.quote}&rdquo;</p>
                <div style={{ backgroundColor: '#FDFAF5', border: '1px solid #DDD5BB', borderRadius: 7, padding: '9px 11px', marginBottom: 7 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#8C6D2F' }}>SUGGESTED RESPONSE</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E', lineHeight: 1.6 }}>{latestObjection.response}</p>
                </div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#4A7C59' }}>
                  NEXT MOVE &nbsp;<span style={{ fontWeight: 400, color: '#5A6A50', letterSpacing: 0 }}>{latestObjection.nextMove}</span>
                </p>
                <button onClick={() => setLatestObjection(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9A9080', display: 'flex', padding: 2 }}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Right: coaching panel */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#F5F0E8' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 12px' }}>

              {/* Objections section */}
              <div style={{ padding: '9px 12px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>OBJECTIONS CAUGHT</span>
                {objections.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#C0392B', backgroundColor: 'rgba(192,57,43,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                    {objections.length}
                  </span>
                )}
              </div>

              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {objections.length === 0 ? (
                  <p style={{ margin: 0, padding: '4px 2px', color: '#9A9080', fontSize: 13, fontStyle: 'italic' }}>
                    No objections detected yet.
                  </p>
                ) : objections.map(obj => (
                  <div key={obj.id} style={{ borderRadius: 10, border: '1px solid #DDD5BB', overflow: 'hidden', backgroundColor: '#FDFAF5' }}>
                    <div style={{ padding: '7px 12px', backgroundColor: 'rgba(192,57,43,0.05)', borderBottom: '1px solid rgba(192,57,43,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#C0392B' }}>{obj.label}</span>
                      <span style={{ fontSize: 10, color: '#9A9080' }}>{obj.time}</span>
                    </div>
                    <div style={{ padding: '9px 12px' }}>
                      <p style={{ margin: '0 0 7px', fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{obj.quote}&rdquo;</p>
                      <div style={{ backgroundColor: '#F5F0E8', border: '1px solid #DDD5BB', borderRadius: 7, padding: '7px 10px', marginBottom: 7 }}>
                        <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#8C6D2F' }}>SUGGESTED RESPONSE</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E', lineHeight: 1.6 }}>{obj.response}</p>
                      </div>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#4A7C59' }}>
                        NEXT MOVE &nbsp;<span style={{ fontWeight: 400, color: '#5A6A50', letterSpacing: 0 }}>{obj.nextMove}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sentiment section */}
              <div style={{ margin: '4px 10px 0', borderRadius: 10, border: '1px solid #DDD5BB', overflow: 'hidden', backgroundColor: '#FDFAF5' }}>
                <div style={{ padding: '7px 12px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB' }}>
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
                      {/* Gradient slider bar */}
                      <div style={{ height: 4, borderRadius: 2, background: 'linear-gradient(to right, #C0392B 0%, #DDD5BB 50%, #4A7C59 100%)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '50%', left: `${sentiment.pct}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', backgroundColor: sentiment.color, border: '2px solid #FDFAF5', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.4s ease' }} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Key moments section */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1A', margin: 0 }}>Call Complete</h2>
              <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: scoreColor }}>{score.toFixed(1)}<span style={{ fontSize: 11, color: '#B0A898', fontWeight: 400 }}>/10</span></span>
            </div>
            <p style={{ fontSize: 13, color: '#7A7060', margin: '0 0 16px' }}>
              Duration: {fmt(elapsed)} &nbsp;·&nbsp; {lines.length} lines &nbsp;·&nbsp; {objections.length} objection{objections.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {keyMoments.length} key moment{keyMoments.length !== 1 ? 's' : ''}
            </p>

            {/* Talk ratio summary */}
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

            {objections.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>OBJECTIONS</p>
                {objections.map((obj, i) => (
                  <div key={obj.id} style={{ borderRadius: 9, border: '1px solid #DDD5BB', overflow: 'hidden' }}>
                    <div style={{ padding: '7px 13px', backgroundColor: 'rgba(192,57,43,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#C0392B' }}>{i + 1}. {obj.label}</span>
                      <span style={{ fontSize: 11, color: '#9A9080' }}>@ {obj.time}</span>
                    </div>
                    <p style={{ margin: 0, padding: '7px 13px', fontSize: 12, color: '#7A7060', fontStyle: 'italic' }}>&ldquo;{obj.quote}&rdquo;</p>
                  </div>
                ))}
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
                  setLines([]); setObjections([]); setElapsed(0); setErr('')
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
