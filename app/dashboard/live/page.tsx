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

interface TranscriptLine {
  id: string; text: string; time: string; speaker: Speaker; isKeyMoment: boolean
}
interface DetectedCard {
  id:        string
  cardType:  CardType
  cardTitle: string
  psychRead: string  // AI psychology analysis of buyer's mindset
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

// ─── Coaching is now fully AI-driven — see /api/live-coach ──────────────────
// Each prospect utterance is sent to Claude which returns a psychological read
// of the buyer's mindset and contextual coaching. No static scripts.

// ─── (legacy static DB removed) ─────────────────────────────────────────────

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
  const [elapsed,        setElapsed]        = useState(0)
  const [muted,          setMuted]          = useState(false)
  const [err,            setErr]            = useState('')
  const [showSummary,    setShowSummary]    = useState(false)
  const [score,          setScore]          = useState(7.0)
  const [sentimentScore, setSentimentScore] = useState(0)
  const [switchRec,      setSwitchRec]      = useState<{ toProduct: CallFocus; message: string } | null>(null)
  const [limitedMode,    setLimitedMode]    = useState(false)
  const [manualMode,     setManualMode]     = useState(false)
  const [manualInput,    setManualInput]    = useState('')
  const [discProfile,    setDiscProfile]    = useState<{
    type: 'D' | 'I' | 'S' | 'C'; name: string; confidence: number;
    primaryTrait: string; traits: string[]; sellTo: string[];
  } | null>(null)

  const wsRef            = useRef<WebSocket | null>(null)      // Deepgram WebSocket connection
  const recorderRef      = useRef<MediaRecorder | null>(null)  // MediaRecorder streaming audio to Deepgram
  const recognitionRef   = useRef<any>(null)                   // Web Speech API fallback
  const statusRef        = useRef<Status>('ready')
  const speakerRef       = useRef<Speaker>('agent')
  const focusRef         = useRef<CallFocus>('mortgage_protection')
  const elapsedRef       = useRef(0)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const switchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const discIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  // lastFiredRef removed — Claude decides per-utterance whether coaching is warranted
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
    setSwitchRec(null)
    setSwitchRec(null)            // dismiss pivot card when agent acts on the recommendation
  }, [])

  // ── AI coaching — called on every finalized prospect utterance ───────────────
  // Calls /api/live-coach which uses Claude to read buyer psychology and return
  // contextual coaching. Fires a card only when coaching is warranted.
  const coachLine = useCallback(async (text: string, time: string) => {
    if (text.trim().length < 6) return  // ignore very short utterances

    // Build context from the last 8 lines so Claude understands conversation flow
    const contextLines = liveRef.current.lines
      .slice(-8)
      .map(l => `${l.speaker === 'agent' ? 'AGENT' : 'PROSPECT'}: ${l.text}`)
      .join('\n')

    try {
      const res = await fetch('/api/live-coach', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          utterance:  text,
          context:    contextLines,
          callFocus:  focusRef.current,
        }),
      })
      if (!res.ok) return

      const data = await res.json()
      if (data.skip || !data.cardType || !data.response) return

      // Handle product switch recommendation from Claude
      if (data.switchProduct && data.switchProduct !== focusRef.current) {
        setSwitchRec({ toProduct: data.switchProduct, message: data.switchReason || 'Product switch recommended based on prospect signals.' })
      }

      const card: DetectedCard = {
        id:        crypto.randomUUID(),
        cardType:  data.cardType  as CardType,
        cardTitle: data.cardTitle || data.cardType,
        psychRead: data.psychRead || '',
        response:  data.response,
        nextMove:  data.nextMove  || '',
        quote:     text,
        time,
      }
      setCards(prev => [card, ...prev])
    } catch {
      // Silently fail — coaching is enhancement, not core
    }
  }, [])

  const runDiscAnalysis = useCallback(async () => {
    const prospectLines = liveRef.current.lines
      .filter(l => l.speaker === 'prospect')
      .map(l => l.text)
    if (prospectLines.length < 5) return
    try {
      const res = await fetch('/api/calls/disc-live', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lines: prospectLines, callFocus: focusRef.current }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (!data.skip) setDiscProfile(data)
    } catch {}
  }, [])

  // Trigger first DISC analysis as soon as the prospect has spoken 5 lines
  useEffect(() => {
    if (statusRef.current !== 'listening') return
    const count = lines.filter(l => l.speaker === 'prospect').length
    if (count === 5) runDiscAnalysis()
  }, [lines, runDiscAnalysis])

  const stopCall = useCallback((withSummary = true) => {
    if (timerRef.current)          { clearInterval(timerRef.current);          timerRef.current = null }
    if (scoreIntervalRef.current)  { clearInterval(scoreIntervalRef.current);  scoreIntervalRef.current = null }
    if (switchIntervalRef.current) { clearInterval(switchIntervalRef.current); switchIntervalRef.current = null }
    if (discIntervalRef.current)   { clearInterval(discIntervalRef.current);   discIntervalRef.current = null }
    // Stop MediaRecorder
    try { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop() } catch {}
    recorderRef.current = null
    // Close Deepgram WebSocket gracefully
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'CloseStream' }))
      }
      wsRef.current?.close()
    } catch {}
    wsRef.current = null
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setMuted(false); setInterim(''); setSwitchRec(null)
    setManualMode(false); setManualInput('')
    setStatusSynced('ended')
    if (withSummary) setShowSummary(true)
  }, [setStatusSynced])

  const startManualCall = useCallback(() => {
    setErr('')
    setStatusSynced('listening')
    setSpeakerSynced('agent')
    setSwitchRec(null)
    elapsedRef.current = 0
    setLines([]); setCards([]); setInterim('')
    setShowSummary(false); setElapsed(0); setMuted(false)
    setScore(7.0); setSentimentScore(0); setLimitedMode(true); setDiscProfile(null)
    setManualMode(true); setManualInput('')

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => { elapsedRef.current += 1; setElapsed(elapsedRef.current) }, 1000)

    if (discIntervalRef.current) clearInterval(discIntervalRef.current)
    discIntervalRef.current = setInterval(runDiscAnalysis, 45000)

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
  }, [runDiscAnalysis, setStatusSynced, setSpeakerSynced])

  const startCall = useCallback(async () => {
    if (typeof window === 'undefined') return
    setErr('')
    setStatusSynced('listening')
    setSpeakerSynced('agent')
    setSwitchRec(null)
    elapsedRef.current = 0
    setLines([]); setCards([]); setInterim('')
    setShowSummary(false); setElapsed(0); setMuted(false)
    setScore(7.0); setSentimentScore(0); setLimitedMode(false); setDiscProfile(null)

    try {
      // ── Mic access ─────────────────────────────────────────────────────────
      // Try ideal constraints first; fall back to bare {audio:true} for devices
      // that reject specific constraints (Bluetooth, virtual mics, etc.)
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      streamRef.current = stream

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
      }, 1000)

      // Product switch recommendations now come inline from Claude per utterance (see coachLine)

      if (discIntervalRef.current) clearInterval(discIntervalRef.current)
      discIntervalRef.current = setInterval(runDiscAnalysis, 45000)

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

      // ── Shared transcript commit helper ──────────────────────────────────────
      const commitFinal = (text: string) => {
        const t = text.trim()
        if (!t) return
        const time           = fmt(elapsedRef.current)
        const currentSpeaker = speakerRef.current
        const lower          = t.toLowerCase()
        const isKeyMoment    = currentSpeaker === 'prospect' &&
          KEY_MOMENT_TRIGGERS.some(k => lower.includes(k))
        setLines(prev => [...prev, { id: crypto.randomUUID(), text: t, time, speaker: currentSpeaker, isKeyMoment }])
        if (currentSpeaker === 'prospect') coachLine(t, time)
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }, 50)
      }

      // ── Try Deepgram (server-issued temp key — API key never reaches browser) ─
      let dgOk = false
      try {
        const tokenRes = await fetch('/api/calls/deepgram-token')
        if (!tokenRes.ok) throw new Error('token-fetch-failed')
        const { key } = await tokenRes.json()
        if (!key) throw new Error('no-key')

        const params = new URLSearchParams({
          model:            'nova-2',
          language:         'en-US',
          smart_format:     'true',
          interim_results:  'true',
          utterance_end_ms: '1000',
          endpointing:      '300',
          filler_words:     'false',
          punctuate:        'true',
        })

        const ws = new WebSocket(
          `wss://api.deepgram.com/v1/listen?${params.toString()}`,
          ['token', key]
        )
        wsRef.current = ws

        // Wait up to 5s for the connection to open
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('ws-timeout')), 5000)
          ws.onopen  = () => { clearTimeout(t); resolve() }
          ws.onerror = () => { clearTimeout(t); reject(new Error('ws-error')) }
        })

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string)
            if (data.type === 'Results') {
              const transcript: string = data.channel?.alternatives?.[0]?.transcript ?? ''
              if (!data.is_final) { setInterim(transcript); return }
              setInterim('')
              commitFinal(transcript)
            }
            if (data.type === 'UtteranceEnd') setInterim('')
          } catch {}
        }

        ws.onerror  = (e) => console.warn('[Deepgram] ws error', e)
        ws.onclose  = (event) => {
          if (statusRef.current === 'listening' && event.code !== 1000) {
            console.warn('[Deepgram] WebSocket closed unexpectedly:', event.code)
          }
        }

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data)
        }
        recorder.start(250)
        recorderRef.current = recorder
        dgOk = true

      } catch (dgErr) {
        console.warn('[Deepgram] unavailable, falling back to Web Speech API:', dgErr)
        try { wsRef.current?.close() } catch {}
        wsRef.current = null
      }

      // ── Web Speech API fallback ───────────────────────────────────────────────
      if (!dgOk) {
        setLimitedMode(true)
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SR) {
          setErr('Deepgram unavailable and speech recognition not supported in this browser. Please use Chrome or configure a Deepgram API key.')
          stopCall(false); setStatusSynced('error'); return
        }
        const recognition = new SR()
        recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US'
        recognition.onresult = (event: any) => {
          let newInterim = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript
            if (event.results[i].isFinal) { commitFinal(t); setInterim('') }
            else newInterim += t
          }
          if (newInterim) setInterim(newInterim)
        }
        recognition.onerror = (event: any) => {
          if (event.error === 'aborted' || event.error === 'no-speech') return
          if (event.error === 'not-allowed') { setErr('Microphone access denied.'); stopCall(false); setStatusSynced('error') }
          else console.warn('[SpeechRecognition]', event.error)
        }
        recognition.onend = () => { if (statusRef.current === 'listening') try { recognition.start() } catch {} }
        recognition.start()
        recognitionRef.current = recognition
      }

    } catch (e: any) {
      if (e.name === 'NotAllowedError' || (e.message ?? '').toLowerCase().includes('denied')) {
        setErr('Microphone access denied. Click the microphone icon in your browser address bar and allow access, then try again.')
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError' || (e.message ?? '').toLowerCase().includes('not found')) {
        setErr('No microphone found. Make sure a microphone is connected and not in use by another app (Zoom, Teams, etc.), then try again.')
      } else if (e.name === 'NotReadableError' || (e.message ?? '').toLowerCase().includes('already in use')) {
        setErr('Microphone is in use by another app. Close Zoom, Teams, or any other app using your mic, then try again.')
      } else {
        setErr(e.message || 'Could not start microphone. Check your system microphone settings and try again.')
      }
      setStatusSynced('error')
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (timerRef.current)         { clearInterval(timerRef.current);         timerRef.current = null }
      if (scoreIntervalRef.current) { clearInterval(scoreIntervalRef.current); scoreIntervalRef.current = null }
    }
  }, [coachLine, runDiscAnalysis, stopCall, setStatusSynced, setSpeakerSynced])

  const endCall    = useCallback(() => stopCall(true), [stopCall])
  const toggleMute = useCallback(() => {
    if (!streamRef.current) return
    const next = !muted
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next })
    if (recorderRef.current) {
      try { next ? recorderRef.current.pause() : recorderRef.current.resume() } catch {}
    }
    setMuted(next)
  }, [muted])

  useEffect(() => {
    return () => {
      if (timerRef.current)          clearInterval(timerRef.current)
      if (scoreIntervalRef.current)  clearInterval(scoreIntervalRef.current)
      if (switchIntervalRef.current) clearInterval(switchIntervalRef.current)
      if (discIntervalRef.current)   clearInterval(discIntervalRef.current)
      try { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop() } catch {}
      try { wsRef.current?.close() } catch {}
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
          {isLive && limitedMode && (
            <span style={{ padding: '3px 9px', borderRadius: 20, backgroundColor: 'rgba(140,109,47,0.15)', border: '1px solid rgba(140,109,47,0.3)', fontSize: 9, fontWeight: 700, color: '#8C6D2F', letterSpacing: '0.07em' }}>
              LIMITED MODE
            </span>
          )}
          {isLive && discProfile && (() => {
            const discHdr: Record<string, { bg: string; border: string; color: string }> = {
              D: { bg: 'rgba(192,57,43,0.15)',  border: 'rgba(192,57,43,0.35)',  color: '#E07060' },
              I: { bg: 'rgba(201,168,76,0.15)', border: 'rgba(201,168,76,0.35)', color: '#C9A84C' },
              S: { bg: 'rgba(74,124,89,0.15)',  border: 'rgba(74,124,89,0.35)',  color: '#4A7C59' },
              C: { bg: 'rgba(59,122,191,0.15)', border: 'rgba(59,122,191,0.35)', color: '#3B7ABF' },
            }
            const hc = discHdr[discProfile.type]
            return (
              <span style={{ padding: '3px 9px', borderRadius: 20, backgroundColor: hc.bg, border: `1px solid ${hc.border}`, fontSize: 9, fontWeight: 800, color: hc.color, letterSpacing: '0.07em' }}>
                {discProfile.type} · {discProfile.name.toUpperCase()}
              </span>
            )
          })()}
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
              <div style={{ backgroundColor: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: '#922B21' }}>{err}</p>
                {(err.toLowerCase().includes('microphone') || err.toLowerCase().includes('device') || err.toLowerCase().includes('not found') || err.toLowerCase().includes('in use')) && (
                  <p style={{ margin: 0, fontSize: 11, color: '#7A4030' }}>
                    On Mac: <strong>System Settings → Privacy &amp; Security → Microphone</strong> → enable your browser
                  </p>
                )}
              </div>
            )}
            <p style={{ fontSize: 11, color: '#9A9080', margin: '0 0 12px', textAlign: 'center' }}>
              Deepgram AI transcription &nbsp;·&nbsp; Chrome fallback available
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
                  {manualMode ? 'Type lines below — toggle You / Prospect, press Enter to add.' : 'Listening… speak clearly and Spear will transcribe in real time.'}
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

            {/* Manual input bar */}
            {manualMode && (
              <div style={{ flexShrink: 0, borderTop: '1px solid #DDD5BB', backgroundColor: '#FDFAF5', padding: '8px 12px', display: 'flex', gap: 7, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 2, backgroundColor: '#EDE8DC', borderRadius: 6, padding: 2, flexShrink: 0 }}>
                  <button onClick={() => setSpeakerSynced('agent')} style={{ padding: '5px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', backgroundColor: speaker === 'agent' ? '#1A2C1E' : 'transparent', color: speaker === 'agent' ? '#C8D9CB' : '#7A7060' }}>
                    You
                  </button>
                  <button onClick={() => setSpeakerSynced('prospect')} style={{ padding: '5px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', backgroundColor: speaker === 'prospect' ? '#1A2C1E' : 'transparent', color: speaker === 'prospect' ? '#C8D9CB' : '#7A7060' }}>
                    Prospect
                  </button>
                </div>
                <input
                  autoFocus
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && manualInput.trim()) {
                      const t = manualInput.trim()
                      const time = fmt(elapsedRef.current)
                      const lower = t.toLowerCase()
                      const isKeyMoment = speakerRef.current === 'prospect' && KEY_MOMENT_TRIGGERS.some(k => lower.includes(k))
                      setLines(prev => [...prev, { id: crypto.randomUUID(), text: t, time, speaker: speakerRef.current, isKeyMoment }])
                      if (speakerRef.current === 'prospect') coachLine(t, time)
                      setManualInput('')
                      setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, 50)
                    }
                  }}
                  placeholder={speaker === 'prospect' ? 'Type what the prospect said…' : 'Type what you said…'}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #DDD5BB', backgroundColor: '#F5F0E8', color: '#1C1C1A', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>
            )}

          </div>

          {/* Right: coaching panel */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#F5F0E8' }}>

            {/* Pivot recommendation — non-scrolling, always visible at top */}
            {switchRec && focusRef.current !== switchRec.toProduct && (
              <div style={{ margin: '8px 10px 0', borderRadius: 10, border: '1px solid rgba(140,109,47,0.4)', borderLeft: '3px solid #8C6D2F', backgroundColor: '#F5ECD8', flexShrink: 0 }}>
                <div style={{ padding: '8px 10px 7px', borderBottom: '1px solid rgba(140,109,47,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#8C6D2F', backgroundColor: 'rgba(140,109,47,0.14)', padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>PIVOT OPPORTUNITY</span>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <button
                      onClick={() => setCallFocusSynced(switchRec.toProduct)}
                      style={{ fontSize: 10, fontWeight: 700, color: '#5A3E00', backgroundColor: 'rgba(140,109,47,0.18)', border: '1px solid rgba(140,109,47,0.35)', borderRadius: 5, padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                    >
                      Switch → {FOCUS_OPTIONS.find(o => o.value === switchRec.toProduct)?.label}
                    </button>
                    <button onClick={() => setSwitchRec(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9080', display: 'flex', padding: 2, flexShrink: 0 }}>
                      <X size={12} />
                    </button>
                  </div>
                </div>
                <p style={{ margin: 0, padding: '8px 12px', fontSize: 11, color: '#4A3A0E', lineHeight: 1.6 }}>{switchRec.message}</p>
              </div>
            )}

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
                        <span style={{ fontSize: 11, fontWeight: 700, color: cs.labelColor }}>{card.cardTitle}</span>
                        <span style={{ fontSize: 10, color: '#9A9080' }}>{card.time}</span>
                      </div>
                      <div style={{ padding: '9px 12px' }}>
                        <p style={{ margin: '0 0 7px', fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{card.quote}&rdquo;</p>
                        {card.psychRead && (
                          <div style={{ backgroundColor: 'rgba(140,109,47,0.07)', border: '1px solid rgba(140,109,47,0.2)', borderRadius: 6, padding: '6px 9px', marginBottom: 7 }}>
                            <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#8C6D2F' }}>🧠 BUYER PSYCHOLOGY</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#5A4A30', lineHeight: 1.6 }}>{card.psychRead}</p>
                          </div>
                        )}
                        <div style={{ backgroundColor: cs.innerBg, border: '1px solid #DDD5BB', borderRadius: 7, padding: '7px 10px', marginBottom: 7 }}>
                          <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: cs.responseLabelColor }}>COACHING</p>
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

              {/* DISC Buyer Profile */}
              {discProfile && (() => {
                const discColors: Record<string, { bg: string; border: string; badge: string; text: string; dim: string }> = {
                  D: { bg: '#FFF5F4', border: 'rgba(192,57,43,0.25)', badge: '#C0392B', text: '#922B21', dim: 'rgba(192,57,43,0.08)' },
                  I: { bg: '#FFFBF0', border: 'rgba(201,168,76,0.3)',  badge: '#8C6D2F', text: '#5A3E00', dim: 'rgba(201,168,76,0.09)' },
                  S: { bg: '#F2FBF4', border: 'rgba(74,124,89,0.28)',  badge: '#4A7C59', text: '#2A5A3A', dim: 'rgba(74,124,89,0.08)' },
                  C: { bg: '#F0F6FF', border: 'rgba(59,122,191,0.25)', badge: '#3B7ABF', text: '#1E4A80', dim: 'rgba(59,122,191,0.08)' },
                }
                const dc = discColors[discProfile.type]
                return (
                  <div style={{ margin: '8px 10px 0', borderRadius: 10, border: `1px solid ${dc.border}`, borderLeft: `3px solid ${dc.badge}`, overflow: 'hidden', backgroundColor: dc.bg }}>
                    <div style={{ padding: '7px 12px', borderBottom: `1px solid ${dc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: dc.text }}>DISC BUYER PROFILE</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: dc.badge, letterSpacing: '-0.02em' }}>{discProfile.type}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: dc.text }}>{discProfile.name}</span>
                        <span style={{ fontSize: 10, color: '#9A9080', backgroundColor: '#EDE8DC', borderRadius: 8, padding: '1px 7px' }}>{discProfile.confidence}%</span>
                      </div>
                    </div>
                    <div style={{ padding: '9px 12px' }}>
                      {/* Confidence bar */}
                      <div style={{ height: 3, borderRadius: 2, backgroundColor: '#E8E0D0', marginBottom: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${discProfile.confidence}%`, backgroundColor: dc.badge, borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                      {/* Primary trait */}
                      <p style={{ margin: '0 0 8px', fontSize: 12, color: dc.text, fontStyle: 'italic', lineHeight: 1.5, backgroundColor: dc.dim, borderRadius: 6, padding: '5px 8px' }}>{discProfile.primaryTrait}</p>
                      {/* Behavior traits */}
                      <p style={{ margin: '0 0 5px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#9A9080' }}>SIGNALS DETECTED</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                        {discProfile.traits.map((t, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <span style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: dc.dim, border: `1px solid ${dc.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                              <span style={{ fontSize: 8, fontWeight: 900, color: dc.badge }}>·</span>
                            </span>
                            <p style={{ margin: 0, fontSize: 11, color: '#3A3428', lineHeight: 1.5 }}>{t}</p>
                          </div>
                        ))}
                      </div>
                      {/* Selling adjustments */}
                      <p style={{ margin: '0 0 5px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: dc.text }}>SELL TO THIS TYPE</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {discProfile.sellTo.map((s, i) => (
                          <div key={i} style={{ backgroundColor: dc.dim, border: `1px solid ${dc.border}`, borderRadius: 6, padding: '5px 8px' }}>
                            <p style={{ margin: 0, fontSize: 11, color: dc.text, lineHeight: 1.5 }}>{s}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

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
                        <span style={{ fontSize: 12, fontWeight: 700, color: cs.labelColor }}>{i + 1}. {card.cardTitle}</span>
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

            {discProfile && (() => {
              const discColors: Record<string, { border: string; badge: string; text: string; dim: string }> = {
                D: { border: 'rgba(192,57,43,0.25)', badge: '#C0392B', text: '#922B21', dim: 'rgba(192,57,43,0.07)' },
                I: { border: 'rgba(201,168,76,0.3)',  badge: '#8C6D2F', text: '#5A3E00', dim: 'rgba(201,168,76,0.08)' },
                S: { border: 'rgba(74,124,89,0.28)',  badge: '#4A7C59', text: '#2A5A3A', dim: 'rgba(74,124,89,0.07)' },
                C: { border: 'rgba(59,122,191,0.25)', badge: '#3B7ABF', text: '#1E4A80', dim: 'rgba(59,122,191,0.07)' },
              }
              const dc = discColors[discProfile.type]
              return (
                <div style={{ marginBottom: 16, borderRadius: 10, border: `1px solid ${dc.border}`, borderLeft: `3px solid ${dc.badge}`, overflow: 'hidden' }}>
                  <div style={{ padding: '7px 13px', backgroundColor: dc.dim, borderBottom: `1px solid ${dc.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: dc.text }}>DISC BUYER PROFILE</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: dc.badge }}>{discProfile.type}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: dc.text }}>{discProfile.name}</span>
                      <span style={{ fontSize: 10, color: '#9A9080' }}>{discProfile.confidence}% confidence</span>
                    </div>
                  </div>
                  <div style={{ padding: '8px 13px' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, color: dc.text, fontStyle: 'italic', lineHeight: 1.5 }}>{discProfile.primaryTrait}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {discProfile.sellTo.map((s, i) => (
                        <p key={i} style={{ margin: 0, fontSize: 11, color: '#3A3428', lineHeight: 1.5 }}>→ {s}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => {
                  setShowSummary(false); setStatusSynced('ready')
                  setLines([]); setCards([]); setElapsed(0); setErr('')
                  setScore(7.0); setSentimentScore(0); setDiscProfile(null)
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
