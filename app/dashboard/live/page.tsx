'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mic, MicOff, PhoneOff, X } from 'lucide-react'

const OBJECTION_DB = [
  {
    triggers: ['already have coverage', 'already have a policy', 'already covered', 'have life insurance', 'have a policy'],
    label: 'Already Has Coverage',
    response: "That's great — protection matters. The real question is whether what you have is enough. Does your current policy fully replace your income if something happened tomorrow?",
  },
  {
    triggers: ["can't afford it", 'cannot afford', 'too broke', 'no money', 'tight budget'],
    label: "Can't Afford It",
    response: "Most families feel that way until we see the actual numbers. Life insurance is often less than a cup of coffee a day. What would your family lose if your income stopped today?",
  },
  {
    triggers: ['need to think about it', 'let me think about it', 'think about it', 'need to think', 'want to think'],
    label: 'Needs Time to Decide',
    response: "Usually when someone wants to think on it, there's one specific question still open. What's your biggest hesitation right now?",
  },
  {
    triggers: ['need to talk to my spouse', 'talk to my wife', 'talk to my husband', 'check with my partner', 'ask my spouse'],
    label: 'Needs Spouse Approval',
    response: "That makes complete sense — this is a family decision. Can we get them on a quick 10-minute call together so I can walk through everything once while you're both on the same page?",
  },
  {
    triggers: ['too expensive', 'costs too much', 'price is too high', "that's a lot", 'seems expensive'],
    label: 'Price Objection',
    response: "The cost of not being covered is exponentially higher for your family. Is the concern the monthly amount, or what it covers? Let's look at both.",
  },
  {
    triggers: ['not interested', "don't want it", "don't need it", 'not for me', 'no thanks'],
    label: 'Not Interested',
    response: "I hear you. Who in your life would be most financially impacted if you weren't around? That's usually what makes this relevant.",
  },
  {
    triggers: ['call me back', 'call back later', 'try me again', 'bad time to call', 'catch me later'],
    label: 'Call Back Request',
    response: "Of course — what's a better time? While I have you for 30 seconds: what's the one thing that would need to be true for this to make sense for your family?",
  },
  {
    triggers: ['not a good time', 'bad timing', 'wrong time', 'not right now', 'busy right now'],
    label: 'Bad Timing',
    response: "Totally understand. Rates are lower right now than they'll be in 6 months. When would be better — later this week, or next week?",
  },
]

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

type Status = 'ready' | 'listening' | 'ended' | 'error'

interface TranscriptLine {
  id: string
  text: string
  time: string
}

interface DetectedObjection {
  id: string
  label: string
  trigger: string
  response: string
  quote: string
  time: string
}

export default function LiveCallPage() {
  const [status, setStatus] = useState<Status>('ready')
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [interim, setInterim] = useState('')
  const [objections, setObjections] = useState<DetectedObjection[]>([])
  const [latestObjection, setLatestObjection] = useState<DetectedObjection | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [err, setErr] = useState('')
  const [showSummary, setShowSummary] = useState(false)

  const recognitionRef = useRef<any>(null)
  const statusRef = useRef<Status>('ready')
  const elapsedRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenRef = useRef(new Set<string>())
  const scrollRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const setStatusSynced = useCallback((s: Status) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const checkObjection = useCallback((text: string, time: string) => {
    const lower = text.toLowerCase()
    for (const entry of OBJECTION_DB) {
      const matched = entry.triggers.find(t => lower.includes(t))
      if (!matched || seenRef.current.has(entry.label)) continue
      seenRef.current.add(entry.label)
      const obj: DetectedObjection = {
        id: crypto.randomUUID(),
        label: entry.label,
        trigger: matched,
        response: entry.response,
        quote: text,
        time,
      }
      setObjections(prev => [...prev, obj])
      setLatestObjection(obj)
      if (flashRef.current) clearTimeout(flashRef.current)
      flashRef.current = setTimeout(() => setLatestObjection(null), 9000)
      break
    }
  }, [])

  const stopCall = useCallback((withSummary = true) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (flashRef.current) { clearTimeout(flashRef.current); flashRef.current = null }
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setMuted(false)
    setInterim('')
    setLatestObjection(null)
    setStatusSynced('ended')
    if (withSummary) setShowSummary(true)
  }, [setStatusSynced])

  const startCall = useCallback(async () => {
    if (typeof window === 'undefined') return
    setErr('')
    setStatusSynced('listening')
    seenRef.current.clear()
    elapsedRef.current = 0
    setLines([])
    setObjections([])
    setInterim('')
    setLatestObjection(null)
    setShowSummary(false)
    setElapsed(0)
    setMuted(false)

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        throw new Error('no-support')
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
      }, 1000)

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: any) => {
        const time = fmt(elapsedRef.current)
        let newInterim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            const text = transcript.trim()
            if (text) {
              setLines(prev => [...prev, { id: crypto.randomUUID(), text, time }])
              checkObjection(text, time)
              setTimeout(() => {
                if (scrollRef.current)
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight
              }, 50)
            }
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
          stopCall(false)
          setStatusSynced('error')
        } else {
          console.warn('[SpeechRecognition] error:', event.error)
        }
      }

      // Auto-restart on end — browser stops after a silence period in continuous mode
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
    }
  }, [checkObjection, stopCall, setStatusSynced])

  const endCall = useCallback(() => stopCall(true), [stopCall])

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return
    const next = !muted
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next })
    setMuted(next)
  }, [muted])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try { recognitionRef.current?.stop() } catch {}
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const isLive = status === 'listening'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F5F0E8', fontFamily: 'var(--font-space, system-ui, sans-serif)', overflow: 'hidden' }}>

      {/* Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {/* Ready / Error state */}
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

      {/* Live panel */}
      {isLive && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Transcript */}
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', borderRight: '1px solid #DDD5BB', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>TRANSCRIPT</span>
            </div>
            <div
              ref={scrollRef}
              style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', backgroundColor: '#F5F0E8', display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {lines.length === 0 && !interim ? (
                <p style={{ margin: 0, color: '#9A9080', fontSize: 13, fontStyle: 'italic' }}>
                  Listening… speak clearly and Spear will transcribe in real time.
                </p>
              ) : (
                <>
                  {lines.map(line => (
                    <div key={line.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 10, color: '#B0A898', fontFamily: 'monospace', flexShrink: 0, marginTop: 3 }}>{line.time}</span>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#2C2A1E' }}>{line.text}</p>
                    </div>
                  ))}
                  {interim && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 10, color: '#B0A898', fontFamily: 'monospace', flexShrink: 0, marginTop: 3 }}>{fmt(elapsed)}</span>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#9A9080', fontStyle: 'italic' }}>
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
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#C0392B', backgroundColor: 'rgba(192,57,43,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                    OBJECTION DETECTED
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1A' }}>{latestObjection.label}</span>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5 }}>
                  &ldquo;{latestObjection.quote}&rdquo;
                </p>
                <div style={{ backgroundColor: '#FDFAF5', border: '1px solid #DDD5BB', borderRadius: 7, padding: '9px 11px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#8C6D2F' }}>SUGGESTED RESPONSE</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E', lineHeight: 1.6 }}>{latestObjection.response}</p>
                </div>
                <button
                  onClick={() => setLatestObjection(null)}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9A9080', display: 'flex', padding: 2 }}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Coaching sidebar */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#F5F0E8' }}>
            <div style={{ padding: '10px 16px', backgroundColor: '#FDFAF5', borderBottom: '1px solid #DDD5BB', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>OBJECTIONS CAUGHT</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {objections.length === 0 ? (
                <p style={{ margin: 0, padding: '6px 4px', color: '#9A9080', fontSize: 13, fontStyle: 'italic' }}>
                  No objections detected yet.
                </p>
              ) : objections.map(obj => (
                <div key={obj.id} style={{ borderRadius: 10, border: '1px solid #DDD5BB', overflow: 'hidden', backgroundColor: '#FDFAF5' }}>
                  <div style={{ padding: '8px 12px', backgroundColor: 'rgba(192,57,43,0.05)', borderBottom: '1px solid rgba(192,57,43,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#C0392B' }}>{obj.label}</span>
                    <span style={{ fontSize: 10, color: '#9A9080' }}>{obj.time}</span>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5 }}>
                      &ldquo;{obj.quote}&rdquo;
                    </p>
                    <div style={{ backgroundColor: '#F5F0E8', border: '1px solid #DDD5BB', borderRadius: 7, padding: '8px 10px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#8C6D2F' }}>RESPONSE</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#2C2A1E', lineHeight: 1.6 }}>{obj.response}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary modal */}
      {showSummary && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(245,240,232,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 }}>
          <div style={{ backgroundColor: '#FDFAF5', border: '1px solid #DDD5BB', borderRadius: 16, padding: '36px 32px', maxWidth: 500, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1A', margin: '0 0 5px' }}>Call Complete</h2>
            <p style={{ fontSize: 13, color: '#7A7060', margin: '0 0 20px' }}>
              Duration: {fmt(elapsed)} &nbsp;·&nbsp; {lines.length} line{lines.length !== 1 ? 's' : ''} transcribed &nbsp;·&nbsp; {objections.length} objection{objections.length !== 1 ? 's' : ''} detected
            </p>
            {objections.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: '#7A7060' }}>No objections detected this call.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {objections.map((obj, i) => (
                  <div key={obj.id} style={{ borderRadius: 10, border: '1px solid #DDD5BB', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', backgroundColor: 'rgba(192,57,43,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#C0392B' }}>{i + 1}. {obj.label}</span>
                      <span style={{ fontSize: 11, color: '#9A9080' }}>@ {obj.time}</span>
                    </div>
                    <p style={{ margin: 0, padding: '8px 14px', fontSize: 12, color: '#7A7060', fontStyle: 'italic' }}>
                      &ldquo;{obj.quote}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => {
                  setShowSummary(false)
                  setStatusSynced('ready')
                  setLines([])
                  setObjections([])
                  setElapsed(0)
                  setErr('')
                }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, backgroundColor: '#1A2C1E', color: '#C8D9CB', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                New Call
              </button>
              <Link
                href="/dashboard"
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #DDD5BB', color: '#7A7060', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
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
