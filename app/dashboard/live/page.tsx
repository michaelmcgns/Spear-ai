'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { ArrowLeft, Phone, PhoneOff, Mic, MicOff, X } from 'lucide-react'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
)

const OBJECTION_DB = [
  {
    triggers: ['already have coverage', 'already have life insurance', 'have a policy', 'covered already'],
    label: 'Already Has Coverage',
    response: "I completely understand — and that's great you're already thinking about protection. The question isn't whether you have coverage, it's whether what you have is enough. Does your current policy cover your family's full income replacement if something happened to you tomorrow?",
  },
  {
    triggers: ["can't afford", 'cannot afford', 'too broke', 'no money', 'tight budget'],
    label: "Can't Afford It",
    response: "Most families I work with feel that way — until we figure out what they'd actually lose without coverage. Life insurance is often less than a Netflix subscription. What would it mean for your family if your income stopped?",
  },
  {
    triggers: ['talk to my spouse', 'ask my wife', 'ask my husband', 'check with my partner', 'need to discuss'],
    label: 'Needs Spouse Approval',
    response: "That makes total sense — this is a family decision. Can we set a quick 10-minute call with both of you? I can walk through the numbers once so you're on the same page.",
  },
  {
    triggers: ['too expensive', 'costs too much', 'price is too high', "that's a lot", 'seems expensive'],
    label: 'Price Objection',
    response: "The cost of NOT being covered — for your family — is exponentially higher. What's your biggest concern: the monthly amount, or what it covers?",
  },
  {
    triggers: ['let me think about it', 'need to think', 'not ready yet', 'want to sleep on it'],
    label: 'Needs Time to Decide',
    response: "Totally fair. Usually when someone wants to think on it, there's one specific question that's not answered yet. What is it for you?",
  },
  {
    triggers: ['not interested', "don't want it", "don't need it", 'not for me', 'no thanks'],
    label: 'Not Interested',
    response: "I hear you. Who in your life would be most financially impacted if you weren't around? That's usually what makes this relevant.",
  },
  {
    triggers: ['not the right time', 'bad timing', 'wait until', 'come back later'],
    label: 'Timing Objection',
    response: "Rates are lower right now than they will be. What would need to be different for it to be the right time?",
  },
  {
    triggers: ['already talked to someone', 'already have an agent', 'have a broker', 'working with someone'],
    label: 'Already Shopped',
    response: "Are you confident the plan you were shown was the best product at the best rate for your situation? I work with 40+ carriers — I'd love to show you a comparison in under 10 minutes.",
  },
  {
    triggers: ['send me information', 'send me something', 'email me', 'drop something in the mail'],
    label: 'Wants Info First',
    response: "Instead of sending something generic, let me ask you two questions first so I can make sure what I send is actually relevant to your situation.",
  },
  {
    triggers: ["we're fine", "we're good", 'everything is fine', 'no need', "don't need anything"],
    label: 'No Perceived Need',
    response: "If your income stopped today, how long could your family maintain their current lifestyle? That's the question worth answering now rather than later.",
  },
]

type DeviceStatus = 'loading' | 'registering' | 'ready' | 'calling' | 'connected' | 'ended' | 'error'
interface TranscriptLine { id: string; text: string; final: boolean }
interface CaughtObjection { id: string; label: string; response: string; quote: string; time: string }

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

export default function LiveCallPage() {
  const [status, setStatus] = useState<DeviceStatus>('loading')
  const [phone, setPhone] = useState('')
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [objections, setObjections] = useState<CaughtObjection[]>([])
  const [flash, setFlash] = useState<CaughtObjection | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [err, setErr] = useState('')

  const deviceRef = useRef<any>(null)
  const callRef = useRef<any>(null)
  const channelRef = useRef<any>(null)
  const seenRef = useRef(new Set<string>())
  const elapsedRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Init Twilio Device
  useEffect(() => {
    let device: any
    async function init() {
      try {
        const { Device } = await import('@twilio/voice-sdk')
        const res = await fetch('/api/calls/token')
        const data = await res.json()
        if (data.error) throw new Error(data.error)

        device = new Device(data.token, { logLevel: 1 })
        deviceRef.current = device
        device.on('registered', () => setStatus('ready'))
        device.on('error', (e: any) => {
          setErr(e.message || 'Device error')
          setStatus('error')
        })
        setStatus('registering')
        await device.register()
      } catch (e: any) {
        setErr(e.message || 'Failed to load call device')
        setStatus('error')
      }
    }
    init()
    return () => { device?.destroy() }
  }, [])

  const cleanup = useCallback((withSummary = true) => {
    if (cleanedRef.current) return
    cleanedRef.current = true
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (flashRef.current) { clearTimeout(flashRef.current); flashRef.current = null }
    channelRef.current?.unsubscribe()
    channelRef.current = null
    callRef.current = null
    setMuted(false)
    setFlash(null)
    setStatus('ended')
    if (withSummary) setShowSummary(true)
  }, [])

  const checkObjection = useCallback((text: string) => {
    const lower = text.toLowerCase()
    for (const entry of OBJECTION_DB) {
      if (seenRef.current.has(entry.label)) continue
      if (entry.triggers.some(t => lower.includes(t))) {
        seenRef.current.add(entry.label)
        const obj: CaughtObjection = {
          id: crypto.randomUUID(),
          label: entry.label,
          response: entry.response,
          quote: text,
          time: fmt(elapsedRef.current),
        }
        setObjections(prev => [...prev, obj])
        setFlash(obj)
        if (flashRef.current) clearTimeout(flashRef.current)
        flashRef.current = setTimeout(() => setFlash(null), 7000)
        break
      }
    }
  }, [])

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (!text.trim()) return
    setLines(prev => {
      const last = prev[prev.length - 1]
      if (last && !last.final) {
        return [...prev.slice(0, -1), { id: last.id, text, final: isFinal }]
      }
      return [...prev, { id: crypto.randomUUID(), text, final: isFinal }]
    })
    if (isFinal) checkObjection(text)
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, 50)
  }, [checkObjection])

  const startCall = useCallback(async () => {
    if (status !== 'ready' || !deviceRef.current) return
    const number = phone.trim()
    if (!number) { setErr('Enter a phone number'); return }

    cleanedRef.current = false
    const sid = crypto.randomUUID()
    seenRef.current.clear()
    elapsedRef.current = 0
    setLines([])
    setObjections([])
    setFlash(null)
    setShowSummary(false)
    setElapsed(0)
    setErr('')
    setStatus('calling')

    try {
      const ch = sb
        .channel(`call:${sid}`)
        .on('broadcast', { event: 'transcript' }, ({ payload }: any) => {
          if (payload?.text) handleTranscript(payload.text, payload.final === true)
        })
        .subscribe()
      channelRef.current = ch

      const call = await deviceRef.current.connect({
        params: { Phone: number, SessionId: sid },
      })
      callRef.current = call

      call.on('accept', () => {
        setStatus('connected')
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
          elapsedRef.current += 1
          setElapsed(elapsedRef.current)
        }, 1000)
      })
      call.on('disconnect', () => cleanup())
      call.on('cancel', () => {
        channelRef.current?.unsubscribe()
        channelRef.current = null
        setStatus('ready')
      })
      call.on('error', (e: any) => {
        setErr(e.message || 'Call error')
        cleanup(false)
      })
    } catch (e: any) {
      setErr(e.message || 'Failed to start call')
      channelRef.current?.unsubscribe()
      channelRef.current = null
      setStatus('ready')
    }
  }, [status, phone, handleTranscript, cleanup])

  const endCall = useCallback(() => {
    callRef.current?.disconnect()
    cleanup()
  }, [cleanup])

  const toggleMute = useCallback(() => {
    if (!callRef.current) return
    const next = !muted
    callRef.current.mute(next)
    setMuted(next)
  }, [muted])

  const inCall = status === 'calling' || status === 'connected'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#E8E2D4', fontFamily: 'var(--font-space, system-ui, sans-serif)', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ backgroundColor: '#1A2C1E', height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/dashboard" style={{ color: '#C8D9CB', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 12 }}>
            <ArrowLeft size={13} /> Dashboard
          </Link>
          <span style={{ color: '#4A7C59' }}>|</span>
          <span style={{ color: '#C8D9CB', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em' }}>SPEAR LIVE</span>
          {inCall && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, backgroundColor: 'rgba(74,124,89,0.2)', border: '1px solid rgba(74,124,89,0.4)', fontSize: 10, fontWeight: 700, color: '#4A7C59', letterSpacing: '0.08em' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#4A7C59', animation: 'livePulse 1.4s ease-in-out infinite' }} />
              {status === 'connected' ? 'LIVE' : 'CONNECTING'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'connected' && (
            <span style={{ color: '#C8D9CB', fontFamily: 'monospace', fontSize: 13 }}>{fmt(elapsed)}</span>
          )}
          {inCall && (
            <button onClick={toggleMute} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, backgroundColor: muted ? 'rgba(139,58,58,0.2)' : 'rgba(255,255,255,0.07)', border: `1px solid ${muted ? 'rgba(139,58,58,0.4)' : 'rgba(255,255,255,0.1)'}`, color: muted ? '#D08080' : '#C8D9CB', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              {muted ? <MicOff size={12} /> : <Mic size={12} />}
              {muted ? 'Unmute' : 'Mute'}
            </button>
          )}
          {inCall && (
            <button onClick={endCall} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 7, backgroundColor: 'rgba(139,58,58,0.2)', border: '1px solid rgba(139,58,58,0.45)', color: '#D08080', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <PhoneOff size={12} /> End Call
            </button>
          )}
        </div>
      </header>

      {/* Idle / Ready / Error */}
      {!inCall && status !== 'ended' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#F0EAD8', border: '1px solid #DDD5C0', borderRadius: 16, padding: '40px 36px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: 'rgba(74,124,89,0.15)', border: '1px solid rgba(74,124,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Phone size={20} style={{ color: '#4A7C59' }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1A', margin: '0 0 8px' }}>Live Call</h2>
            <p style={{ fontSize: 13, color: '#7A7060', margin: '0 0 24px', lineHeight: 1.6 }}>
              Enter the prospect's number. Spear transcribes the conversation in real time and surfaces objection coaching as it happens.
            </p>

            {(status === 'loading' || status === 'registering') && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#7A7060', fontSize: 13 }}>
                <span style={{ width: 14, height: 14, border: '2px solid #DDD5C0', borderTopColor: '#4A7C59', borderRadius: '50%', display: 'inline-block', animation: 'devSpin 0.7s linear infinite' }} />
                Initializing phone device…
              </div>
            )}

            {status === 'error' && (
              <div style={{ backgroundColor: 'rgba(139,58,58,0.08)', border: '1px solid rgba(139,58,58,0.2)', borderRadius: 8, padding: '10px 14px', color: '#8B3A3A', fontSize: 13 }}>
                {err || 'Device error — check browser console.'}
              </div>
            )}

            {status === 'ready' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setErr('') }}
                  onKeyDown={e => { if (e.key === 'Enter') startCall() }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, border: '1px solid #DDD5C0', backgroundColor: '#E8E2D4', color: '#1C1C1A', fontSize: 15, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
                />
                {err && <p style={{ margin: 0, fontSize: 12, color: '#8B3A3A' }}>{err}</p>}
                <button
                  onClick={startCall}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 0', borderRadius: 10, backgroundColor: '#1A2C1E', color: '#C8D9CB', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <Phone size={15} /> Start Call
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-call / post-call transcript view */}
      {(inCall || status === 'ended') && !showSummary && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Transcript */}
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', borderRight: '1px solid #DDD5C0', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', backgroundColor: '#F0EAD8', borderBottom: '1px solid #DDD5C0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>TRANSCRIPT</span>
              {status === 'calling' && <span style={{ fontSize: 11, color: '#4A7C59' }}>Dialing {phone}…</span>}
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', backgroundColor: '#F0EAD8', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {lines.length === 0 ? (
                <p style={{ margin: 0, color: '#9A9080', fontSize: 13, fontStyle: 'italic' }}>
                  {status === 'connected' ? 'Waiting for transcription…' : 'Connecting…'}
                </p>
              ) : lines.map(line => (
                <p key={line.id} style={{ margin: 0, fontSize: 13, lineHeight: 1.7, fontFamily: 'monospace', color: line.final ? '#1C1C1A' : '#9A9080' }}>
                  {line.text}{!line.final && <span style={{ opacity: 0.4 }}>_</span>}
                </p>
              ))}
            </div>

            {flash && (
              <div style={{ margin: 10, padding: '11px 14px', borderRadius: 9, border: '1px solid #DDD5C0', borderLeft: '3px solid #8C6D2F', backgroundColor: '#F5ECD8', position: 'relative', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#8C6D2F', backgroundColor: 'rgba(140,109,47,0.12)', padding: '2px 7px', borderRadius: 4 }}>PHASE ALERT</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1A' }}>{flash.label}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5, paddingRight: 20 }}>"{flash.quote}"</p>
                <button onClick={() => setFlash(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9A9080', display: 'flex', padding: 2 }}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Coaching */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#E8E2D4' }}>
            <div style={{ padding: '10px 16px', backgroundColor: '#F0EAD8', borderBottom: '1px solid #DDD5C0', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7060' }}>COACHING</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {objections.length === 0 ? (
                <p style={{ margin: 0, padding: '6px 4px', color: '#9A9080', fontSize: 13, fontStyle: 'italic' }}>
                  Objection coaching appears here as the call progresses.
                </p>
              ) : objections.map(obj => (
                <div key={obj.id} style={{ borderRadius: 10, border: '1px solid #DDD5C0', overflow: 'hidden', backgroundColor: '#F0EAD8' }}>
                  <div style={{ padding: '9px 13px', backgroundColor: 'rgba(140,109,47,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8C6D2F' }}>{obj.label}</span>
                    <span style={{ fontSize: 10, color: '#9A9080' }}>{obj.time}</span>
                  </div>
                  <div style={{ padding: '10px 13px' }}>
                    <p style={{ margin: '0 0 9px', fontSize: 12, color: '#7A7060', fontStyle: 'italic', lineHeight: 1.5 }}>"{obj.quote}"</p>
                    <div style={{ backgroundColor: '#F5ECD8', border: '1px solid #E8D8B0', borderRadius: 7, padding: '9px 11px' }}>
                      <p style={{ margin: '0 0 5px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#8C6D2F' }}>SUGGESTED RESPONSE</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#1C1C1A', lineHeight: 1.6 }}>{obj.response}</p>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(232,226,212,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 }}>
          <div style={{ backgroundColor: '#F0EAD8', border: '1px solid #DDD5C0', borderRadius: 16, padding: '36px 32px', maxWidth: 500, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1A', margin: '0 0 5px' }}>Call Complete</h2>
            <p style={{ fontSize: 13, color: '#7A7060', margin: '0 0 20px' }}>
              Duration: {fmt(elapsed)} &nbsp;·&nbsp; {objections.length} objection{objections.length !== 1 ? 's' : ''} detected
            </p>
            {objections.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: '#7A7060' }}>No objections detected this call.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {objections.map((obj, i) => (
                  <div key={obj.id} style={{ borderRadius: 10, border: '1px solid #DDD5C0', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', backgroundColor: 'rgba(140,109,47,0.07)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#8C6D2F' }}>{i + 1}. {obj.label}</span>
                      <span style={{ fontSize: 11, color: '#9A9080' }}>@ {obj.time}</span>
                    </div>
                    <p style={{ margin: 0, padding: '8px 14px', fontSize: 12, color: '#7A7060', fontStyle: 'italic' }}>"{obj.quote}"</p>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => {
                  setShowSummary(false)
                  setStatus('ready')
                  cleanedRef.current = false
                  setLines([])
                  setObjections([])
                  setElapsed(0)
                }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, backgroundColor: '#1A2C1E', color: '#C8D9CB', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                New Call
              </button>
              <Link
                href="/dashboard"
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #DDD5C0', color: '#7A7060', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes devSpin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
