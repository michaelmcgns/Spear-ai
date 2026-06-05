"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, MicOff, X } from "lucide-react";

// ─── Web Speech API — webkit prefix support ───────────────────────────────────
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

// ─── Objection / response database ───────────────────────────────────────────
const OBJECTION_DB = [
  {
    triggers: [
      "we already have coverage",
      "already have life insurance",
      "already covered",
      "coverage through work",
      "have insurance through",
    ],
    label: "Already Has Coverage",
    response:
      "That's great — most employer plans cover 1–2× salary. If you passed away tonight, how long would that last your family? Let's make sure the gap is actually covered.",
  },
  {
    triggers: [
      "can't afford",
      "cannot afford",
      "not in the budget",
      "tight on money",
      "don't have the money",
      "too much money",
    ],
    label: "Can't Afford It",
    response:
      "Compared to what? Most policies run $4–8 a day. What's peace of mind worth to your family if something happened tomorrow?",
  },
  {
    triggers: [
      "talk to my spouse",
      "check with my wife",
      "check with my husband",
      "run it by my partner",
      "need to ask my",
      "discuss with my spouse",
    ],
    label: "Needs Spouse Approval",
    response:
      "Of course — what would you need to feel comfortable presenting this to them? I can help you frame it so it's a five-minute conversation.",
  },
  {
    triggers: [
      "too expensive",
      "costs too much",
      "that's too much",
      "way too expensive",
      "price is too high",
      "monthly is too high",
    ],
    label: "Price Objection",
    response:
      "I understand. What specifically feels too expensive — the monthly amount, or the comparison to something else? Let's break it down together.",
  },
  {
    triggers: [
      "let me think about it",
      "need to think",
      "think it over",
      "think about it",
      "sleep on it",
    ],
    label: "Needs Time to Decide",
    response:
      "What specifically did you want to think through — the coverage amount, the cost, or something else? Let's address it right now so you're not left wondering.",
  },
  {
    triggers: [
      "not interested",
      "i'm not interested",
      "no thanks",
      "not looking for",
      "don't need life insurance",
      "not looking to buy",
    ],
    label: "Not Interested",
    response:
      "Before we wrap up — if something happened to you tomorrow, how long would your family be financially stable without your income? I just want to make sure you've thought through that.",
  },
  {
    triggers: [
      "not the right time",
      "have to wait",
      "bad timing",
      "wrong time",
      "maybe next year",
      "wait until",
    ],
    label: "Timing Objection",
    response:
      "What's driving the timing? The longer we wait, the more coverage costs. A healthy 35-year-old pays roughly half what a 45-year-old pays for the same benefit.",
  },
  {
    triggers: [
      "already talked to someone",
      "spoke with another agent",
      "another company",
      "already have a quote",
      "already shopping",
    ],
    label: "Already Shopped",
    response:
      "Great — what did they show you? I want to make sure you're comparing apples to apples before you make a final decision.",
  },
  {
    triggers: [
      "send me information",
      "email me the details",
      "send me more info",
      "leave your card",
      "send something over",
    ],
    label: "Wants Info First",
    response:
      "What specifically would you want to see? I'd rather send you exactly what matters to your situation than a generic packet.",
  },
  {
    triggers: [
      "we're fine",
      "i'm fine",
      "we're good",
      "healthy and fine",
      "nothing is going to happen",
      "don't think we need",
    ],
    label: "No Perceived Need",
    response:
      "Good to hear. Out of curiosity — if something happened to you tomorrow, how long would your family be financially stable without your income?",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface TranscriptLine {
  id: string;
  text: string;
  final: boolean;
}

interface CaughtObjection {
  id: string;
  label: string;
  response: string;
  quote: string;
  time: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtElapsed(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function nowStamp() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

let _idSeq = 0;
function uid() {
  return (++_idSeq).toString();
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LiveCallPage() {
  const [live, setLive]               = useState(false);
  const [lines, setLines]             = useState<TranscriptLine[]>([]);
  const [objections, setObjections]   = useState<CaughtObjection[]>([]);
  const [flash, setFlash]             = useState<CaughtObjection | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [supported, setSupported]     = useState<boolean | null>(null);
  const [micError, setMicError]       = useState<string | null>(null);
  const [elapsed, setElapsed]         = useState(0);

  const recogRef    = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const seenRef     = useRef<Set<string>>(new Set());
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRef     = useRef(false);

  // ── Check browser support ──────────────────────────────────────────────────
  useEffect(() => {
    const SR = typeof window !== "undefined"
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    setSupported(!!SR);
  }, []);

  // ── Auto-scroll transcript ─────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      recogRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (flashRef.current) clearTimeout(flashRef.current);
    };
  }, []);

  // ── Objection detection ────────────────────────────────────────────────────
  const checkObjection = useCallback((text: string) => {
    const lower = text.toLowerCase();
    for (const obj of OBJECTION_DB) {
      for (const trigger of obj.triggers) {
        const key = obj.label + "|" + trigger;
        if (lower.includes(trigger) && !seenRef.current.has(key)) {
          seenRef.current.add(key);
          const caught: CaughtObjection = {
            id: uid(),
            label: obj.label,
            response: obj.response,
            quote: `"${text.slice(0, 100)}${text.length > 100 ? "…" : ""}"`,
            time: nowStamp(),
          };
          setObjections(prev => [caught, ...prev]);
          setFlash(caught);
          if (flashRef.current) clearTimeout(flashRef.current);
          flashRef.current = setTimeout(() => setFlash(null), 7000);
          return;
        }
      }
    }
  }, []);

  // ── Speech recognition lifecycle ───────────────────────────────────────────
  const startRecog = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = (e: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }

      if (finalText.trim()) {
        setLines(prev => {
          const finals = prev.filter(l => l.final);
          return [...finals, { id: uid(), text: finalText.trim(), final: true }];
        });
        checkObjection(finalText);
      }

      if (interimText) {
        setLines(prev => {
          const finals = prev.filter(l => l.final);
          return [...finals, { id: "interim", text: interimText, final: false }];
        });
      }
    };

    recog.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed") {
        setMicError("Microphone access denied. Please allow mic access in browser settings and try again.");
        liveRef.current = false;
        setLive(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      }
      // "no-speech" is expected during silence — ignore it
    };

    // Restart automatically on silence (SpeechRecognition auto-stops)
    recog.onend = () => {
      if (liveRef.current) {
        try { recog.start(); } catch { /* already starting */ }
      }
    };

    recogRef.current = recog;
    try {
      recog.start();
    } catch (err) {
      setMicError("Failed to start microphone. Please check your browser permissions.");
      liveRef.current = false;
      setLive(false);
    }
  }, [checkObjection]);

  const startCall = useCallback(() => {
    setMicError(null);
    setLines([]);
    setObjections([]);
    seenRef.current.clear();
    setFlash(null);
    setShowSummary(false);
    setElapsed(0);
    liveRef.current = true;
    setLive(true);
    startRecog();
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }, [startRecog]);

  const endCall = useCallback(() => {
    liveRef.current = false;
    setLive(false);
    recogRef.current?.stop();
    recogRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (flashRef.current) { clearTimeout(flashRef.current); flashRef.current = null; }
    setFlash(null);
    // Drop any interim line before showing summary
    setLines(prev => prev.filter(l => l.final));
    setShowSummary(true);
  }, []);

  // ── Not supported fallback ─────────────────────────────────────────────────
  if (supported === false) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 40, fontFamily: "var(--font-space), system-ui, sans-serif" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(139,58,58,0.1)", border: "1px solid rgba(139,58,58,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
          🎤
        </div>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1A", marginBottom: 8 }}>Browser Not Supported</h2>
          <p style={{ fontSize: 14, color: "#7A7060", lineHeight: 1.7 }}>
            Live transcription requires the Web Speech API, which is available in Chrome and Edge.
            Please open this page in Chrome and try again.
          </p>
        </div>
        <Link href="/dashboard" style={{ fontSize: 13, color: "#8C6D2F", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  if (supported === null) return null;

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: "100vh",
      backgroundColor: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--font-space), system-ui, sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        backgroundColor: "#1A2C1E",
        borderBottom: "1px solid #2C4A32",
        padding: "0 24px",
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 6, color: "#C8D9CB", fontSize: 13, textDecoration: "none", opacity: 0.7 }}>
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <span style={{ color: "#2C4A32" }}>|</span>
          <span style={{ color: "#C8D9CB", fontWeight: 800, letterSpacing: "-0.3px", fontSize: 16 }}>SPEAR</span>
          <span style={{ fontSize: 11, color: "#C8D9CB", opacity: 0.5, letterSpacing: "0.18em", textTransform: "uppercase" }}>Live</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {live && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  backgroundColor: "#4A7C59",
                  boxShadow: "0 0 8px #4A7C59",
                  animation: "livePulse 1.5s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 10, color: "#4A7C59", fontWeight: 700, letterSpacing: "0.18em" }}>LIVE</span>
              </div>
              <span style={{ fontSize: 13, color: "#C8D9CB", opacity: 0.65, fontVariantNumeric: "tabular-nums" }}>
                {fmtElapsed(elapsed)}
              </span>
            </>
          )}
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "20px 24px 0 24px" }}>

        {/* Flash alert */}
        {flash && (
          <div style={{
            backgroundColor: "rgba(140,109,47,0.10)",
            border: "1px solid rgba(140,109,47,0.30)",
            borderLeft: "3px solid #8C6D2F",
            borderRadius: 8,
            padding: "14px 16px",
            marginBottom: 16,
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            animation: "alertIn 0.2s ease",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "#8C6D2F",
                  border: "1px solid #8C6D2F", borderRadius: 4, padding: "2px 7px",
                }}>PHASE ALERT</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1A" }}>{flash.label}</span>
                <span style={{ fontSize: 11, color: "#9A9080", marginLeft: "auto" }}>{flash.time}</span>
              </div>
              <p style={{ fontSize: 12, color: "#5A4A30", fontStyle: "italic", marginBottom: 10, lineHeight: 1.5 }}>
                {flash.quote}
              </p>
              <div style={{ backgroundColor: "#F5ECD8", border: "1px solid #E8D8B0", borderRadius: 6, padding: "10px 12px" }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8C6D2F", marginBottom: 5 }}>
                  SUGGESTED RESPONSE
                </p>
                <p style={{ fontSize: 13, color: "#1C1C1A", lineHeight: 1.65 }}>{flash.response}</p>
              </div>
            </div>
            <button
              onClick={() => setFlash(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9080", padding: 2, flexShrink: 0, marginTop: 2 }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Split layout */}
        <div style={{ flex: 1, display: "flex", gap: 16, overflow: "hidden", minHeight: 0 }}>

          {/* Transcript panel */}
          <div style={{
            flex: 3,
            backgroundColor: "#FDFAF5",
            border: "1px solid #E8E0D0",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "11px 16px",
              borderBottom: "1px solid #E8E0D0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7A7060" }}>
                Transcript
              </span>
              {live && (
                <span style={{ fontSize: 10, color: "#4A7C59", fontWeight: 600 }}>● Recording</span>
              )}
              {lines.filter(l => l.final).length > 0 && (
                <span style={{ fontSize: 11, color: "#9A9080", marginLeft: "auto" }}>
                  {lines.filter(l => l.final).length} line{lines.filter(l => l.final).length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
              {lines.length === 0 ? (
                <p style={{ color: "#9A9080", fontSize: 13, fontStyle: "italic", textAlign: "center", marginTop: 48 }}>
                  {live ? "Listening — speak to begin transcription" : "Press "Start Live Call" to begin"}
                </p>
              ) : (
                lines.map((line, i) => (
                  <p
                    key={line.id + i}
                    style={{
                      fontSize: 14,
                      lineHeight: 1.8,
                      marginBottom: 6,
                      color: line.final ? "#1C1C1A" : "#9A9080",
                      fontStyle: line.final ? "normal" : "italic",
                      fontFamily: "'Courier New', Courier, monospace",
                    }}
                  >
                    {line.final && (
                      <span style={{ color: "#C8B87A", fontSize: 10, marginRight: 8, userSelect: "none" }}>›</span>
                    )}
                    {line.text}
                  </p>
                ))
              )}
            </div>
          </div>

          {/* Coaching panel */}
          <div style={{
            flex: 2,
            backgroundColor: "#FDFAF5",
            border: "1px solid #E8E0D0",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "11px 16px",
              borderBottom: "1px solid #E8E0D0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7A7060" }}>
                Objections Caught
              </span>
              {objections.length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  backgroundColor: "rgba(140,109,47,0.12)", color: "#8C6D2F",
                  borderRadius: 10, padding: "2px 8px",
                }}>
                  {objections.length}
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {objections.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>🎯</div>
                  <p style={{ fontSize: 12, color: "#9A9080", fontStyle: "italic", lineHeight: 1.6 }}>
                    No objections detected yet.
                    {live ? " Keep talking — Spear is listening." : ""}
                  </p>
                </div>
              ) : (
                objections.map(obj => (
                  <div
                    key={obj.id}
                    style={{ border: "1px solid #E8D8B0", borderRadius: 8, marginBottom: 10, overflow: "hidden" }}
                  >
                    {/* Alert header */}
                    <div style={{
                      backgroundColor: "rgba(140,109,47,0.08)",
                      padding: "8px 12px",
                      borderBottom: "1px solid #E8D8B0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
                          textTransform: "uppercase", color: "#8C6D2F",
                          border: "1px solid rgba(140,109,47,0.4)", borderRadius: 3,
                          padding: "1px 5px",
                        }}>PHASE ALERT</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#1C1C1A" }}>{obj.label}</span>
                      </div>
                      <span style={{ fontSize: 10, color: "#9A9080", flexShrink: 0 }}>{obj.time}</span>
                    </div>

                    {/* Quote */}
                    <div style={{ padding: "7px 12px", backgroundColor: "rgba(0,0,0,0.02)" }}>
                      <p style={{ fontSize: 11, color: "#5A4A30", fontStyle: "italic", lineHeight: 1.5 }}>{obj.quote}</p>
                    </div>

                    {/* Suggested response */}
                    <div style={{ backgroundColor: "#F5ECD8", padding: "8px 12px" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8C6D2F", marginBottom: 4 }}>
                        SUGGESTED RESPONSE
                      </p>
                      <p style={{ fontSize: 12, color: "#1C1C1A", lineHeight: 1.6 }}>{obj.response}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ padding: "18px 0 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexShrink: 0 }}>
          {micError && (
            <div style={{
              fontSize: 12, color: "#8B3A3A",
              backgroundColor: "rgba(139,58,58,0.08)",
              border: "1px solid rgba(139,58,58,0.2)",
              borderRadius: 6, padding: "8px 14px",
            }}>
              {micError}
            </div>
          )}
          {!live ? (
            <button
              onClick={startCall}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                backgroundColor: "#4A7C59", color: "#fff",
                border: "none", borderRadius: 8,
                padding: "12px 32px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.04em",
                fontFamily: "var(--font-space), system-ui",
                boxShadow: "0 2px 12px rgba(74,124,89,0.3)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              <Mic size={16} />
              Start Live Call
            </button>
          ) : (
            <button
              onClick={endCall}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                backgroundColor: "#8B3A3A", color: "#fff",
                border: "none", borderRadius: 8,
                padding: "12px 32px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.04em",
                fontFamily: "var(--font-space), system-ui",
                boxShadow: "0 2px 12px rgba(139,58,58,0.3)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              <MicOff size={16} />
              End Call
            </button>
          )}
        </div>
      </div>

      {/* ── Summary modal ────────────────────────────────────────────────── */}
      {showSummary && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          backgroundColor: "rgba(232,224,208,0.88)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            backgroundColor: "#FDFAF5",
            border: "1px solid #E8E0D0",
            borderRadius: 16,
            padding: "36px 32px",
            maxWidth: 480, width: "100%",
            boxShadow: "0 16px 48px rgba(0,0,0,0.12), 0 0 40px rgba(201,168,76,0.08)",
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1C1C1A", marginBottom: 4, letterSpacing: "-0.02em" }}>
              Call Summary
            </h2>
            <p style={{ fontSize: 13, color: "#7A7060", marginBottom: 24 }}>
              Duration: {fmtElapsed(elapsed)} · {objections.length} objection{objections.length !== 1 ? "s" : ""} caught
            </p>

            {objections.length === 0 ? (
              <p style={{ fontSize: 13, color: "#7A7060", fontStyle: "italic", marginBottom: 24 }}>
                No objections were detected during this call.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto", marginBottom: 24 }}>
                {[...objections].reverse().map((obj, i) => (
                  <div key={obj.id} style={{
                    backgroundColor: "rgba(140,109,47,0.06)",
                    border: "1px solid rgba(140,109,47,0.18)",
                    borderRadius: 8, padding: "10px 12px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#1C1C1A" }}>{i + 1}. {obj.label}</span>
                      <span style={{ fontSize: 10, color: "#9A9080" }}>{obj.time}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#5A4A30", fontStyle: "italic", lineHeight: 1.5 }}>{obj.quote}</p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setShowSummary(false); setLines([]); setObjections([]); setElapsed(0); }}
                style={{
                  flex: 1, padding: "11px 16px", borderRadius: 8,
                  border: "1px solid #DDD5C0",
                  backgroundColor: "transparent", color: "#1C1C1A",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "var(--font-space), system-ui",
                }}
              >
                New Call
              </button>
              <Link
                href="/dashboard"
                style={{
                  flex: 1, padding: "11px 16px", borderRadius: 8,
                  backgroundColor: "#2C4A32", color: "#C8D9CB",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  textDecoration: "none", textAlign: "center",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-space), system-ui",
                }}
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #4A7C59; }
          50%       { opacity: 0.4; box-shadow: 0 0 3px #4A7C59; }
        }
        @keyframes alertIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
