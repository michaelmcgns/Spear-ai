"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Phone, PhoneOff, Mic, MicOff, ArrowLeft,
  ThumbsUp, ThumbsDown, Brain,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallState = "idle" | "active" | "saving";
type Speaker = "agent" | "prospect";

interface TranscriptLine {
  id: string;
  speaker: Speaker;
  speakerNum: number; // Raw Deepgram speaker index (0 or 1)
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface CoachingCard {
  id: string;
  type: "OBJECTION" | "NEPQ_MOVE" | "DISC_INSIGHT" | "CLOSE_SIGNAL";
  title: string;
  body: string;
  suggestedResponse?: string;
  timestamp: number;
  accepted: boolean;
  dismissed: boolean;
}

// ─── NEPQ phases ──────────────────────────────────────────────────────────────

const NEPQ_PHASES = [
  { id: 1, name: "Connection",         hint: "Build rapport and credibility" },
  { id: 2, name: "Situation",          hint: "Understand their current state" },
  { id: 3, name: "Problem Awareness",  hint: "Surface the pain they feel" },
  { id: 4, name: "Solution Awareness", hint: "Confirm the problem is real" },
  { id: 5, name: "Consequence",        hint: "Amplify the cost of inaction" },
  { id: 6, name: "Qualifying",         hint: "Assess fit, budget, decision" },
  { id: 7, name: "Close",              hint: "Present and ask for the sale" },
];

const PHASE_TRIGGERS: { phase: number; patterns: RegExp[] }[] = [
  { phase: 2, patterns: [/currently have/i, /how long have/i, /tell me about/i, /what does your/i, /walk me through/i] },
  { phase: 3, patterns: [/what happens if/i, /what.?s the risk/i, /concerned about/i, /worried about/i, /biggest concern/i] },
  { phase: 4, patterns: [/so that.?s been/i, /how long has this/i, /aware that/i, /been a problem/i] },
  { phase: 5, patterns: [/what would that mean/i, /how would that affect/i, /what.?s the cost/i, /5 years from now/i, /cost of inaction/i] },
  { phase: 6, patterns: [/budget/i, /timeline/i, /decision maker/i, /who else/i, /afford/i, /how soon/i] },
  { phase: 7, patterns: [/let me share/i, /based on what/i, /i.?d like to show/i, /here.?s what/i, /solution for you/i] },
];

function detectNextPhase(text: string, current: number): number {
  for (let p = current + 1; p <= 7; p++) {
    const entry = PHASE_TRIGGERS.find(t => t.phase === p);
    if (entry?.patterns.some(re => re.test(text))) return p;
  }
  return current;
}

// ─── DISC detection ───────────────────────────────────────────────────────────

const DISC_PATTERNS: Record<string, RegExp[]> = {
  D: [/bottom line/i, /results/i, /get to the point/i, /just tell me/i, /in control/i, /efficient/i, /quickly/i, /decided/i],
  I: [/that.?s great/i, /love that/i, /excited/i, /fun/i, /amazing/i, /together/i, /people/i, /laugh/i],
  S: [/just want to make sure/i, /not sure/i, /take.*time/i, /careful/i, /everyone/i, /comfortable/i, /family/i],
  C: [/how does that work/i, /can you explain/i, /specifically/i, /numbers/i, /data/i, /verify/i, /exactly/i],
};

function detectDisc(utterances: string[]): string | null {
  const combined = utterances.join(" ");
  const scores: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };
  Object.entries(DISC_PATTERNS).forEach(([type, patterns]) => {
    scores[type] = patterns.filter(p => p.test(combined)).length;
  });
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : null;
}

// ─── Card styles ──────────────────────────────────────────────────────────────

const CARD_STYLE: Record<string, { border: string; bg: string; badge: string; emoji: string }> = {
  OBJECTION:    { border: "border-red-500/40",    bg: "bg-red-500/6",    badge: "bg-red-500/20 text-red-300",       emoji: "🚨" },
  NEPQ_MOVE:    { border: "border-blue-500/40",   bg: "bg-blue-500/6",   badge: "bg-blue-500/20 text-blue-300",     emoji: "🎯" },
  DISC_INSIGHT: { border: "border-purple-500/40", bg: "bg-purple-500/6", badge: "bg-purple-500/20 text-purple-300", emoji: "🧠" },
  CLOSE_SIGNAL: { border: "border-amber-500/40",  bg: "bg-amber-500/6",  badge: "bg-amber-500/20 text-amber-300",   emoji: "⚡" },
};

// ─── Demo mode ────────────────────────────────────────────────────────────────

// Demo activates automatically when Deepgram key is absent (no real mic needed)
const IS_DEMO = !process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;

interface DemoLine {
  speaker: Speaker;
  text: string;
  card?: {
    type: CoachingCard["type"];
    title: string;
    body: string;
    suggestedResponse?: string;
  };
  discUpdate?: string;
  nepqPhaseForce?: number;
}

const DEMO_SCRIPT: DemoLine[] = [
  { speaker: "agent",
    text: "Hey John, how's it going today?" },
  { speaker: "prospect",
    text: "Good, just busy. What's this about?" },
  { speaker: "agent",
    text: "I wanted to talk to you about protecting your family financially…",
    nepqPhaseForce: 2 },
  { speaker: "prospect",
    text: "I already have some coverage through work.",
    card: { type: "OBJECTION", title: "Existing Coverage Objection",
      body: "Don't argue. Get curious. Ask how much and who it covers.",
      suggestedResponse: "That's great — how much does your job actually provide?" } },
  { speaker: "agent",
    text: "That's great — how much coverage does your job provide?",
    card: { type: "NEPQ_MOVE", title: "Good — Now Go Deeper",
      body: "They don't know their coverage. This is a gap. Ask: what happens to your family if something happens to you tomorrow?" } },
  { speaker: "prospect",
    text: "I think like $50,000? I'm not really sure." },
  { speaker: "agent",
    text: "Got it — and do you have a family, kids?",
    nepqPhaseForce: 3 },
  { speaker: "prospect",
    text: "Yeah, wife and two kids.",
    discUpdate: "S",
    card: { type: "DISC_INSIGHT", title: "S-Type Buyer Detected",
      body: "Steady buyer — family-focused, risk-averse. Lead with protection and security, not numbers." } },
  { speaker: "prospect",
    text: "Honestly I don't know if I need more, and it sounds expensive." },
  { speaker: "agent",
    text: "I totally understand — what part feels expensive, the monthly cost or just the idea of adding another bill?",
    nepqPhaseForce: 5 },
  { speaker: "prospect",
    text: "I just need to think about it.",
    card: { type: "OBJECTION", title: "Think About It",
      body: "Isolate it. Ask: what specifically do you want to think through?",
      suggestedResponse: "Totally fair — what specifically do you want to think through?" } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getSupportedMimeType(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const t of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LiveCallPage() {
  const [callState, setCallState]     = useState<CallState>("idle");
  const [transcript, setTranscript]   = useState<TranscriptLine[]>([]);
  const [interim, setInterim]         = useState<{ agent: string; prospect: string }>({ agent: "", prospect: "" });
  const [cards, setCards]             = useState<CoachingCard[]>([]);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [discProfile, setDiscProfile] = useState<string | null>(null);
  const [talkRatio, setTalkRatio]     = useState({ agent: 50, prospect: 50 });
  const [duration, setDuration]       = useState(0);
  const [micError, setMicError]       = useState<string | null>(null);
  const [userId, setUserId]           = useState<string>("demo-agent");
  const [prospectName, setProspectName] = useState<string>("");
  // Which Deepgram speaker index (0 or 1) is the agent. Flip if DG gets it wrong.
  const [agentSpeakerNum, setAgentSpeakerNum] = useState(0);
  const agentSpeakerNumRef = useRef(0);

  // Fetch real user ID on mount
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setUserId(user.id);
    });
  }, []);

  const wsRef              = useRef<WebSocket | null>(null);
  const streamRef          = useRef<MediaStream | null>(null);
  const recorderRef        = useRef<MediaRecorder | null>(null);
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef   = useRef<HTMLDivElement | null>(null);
  const talkDurRef         = useRef<Record<number, number>>({ 0: 0, 1: 0 });
  const prospectLinesRef   = useRef<string[]>([]);
  const reconnectRef       = useRef(0);
  const callActiveRef      = useRef(false);
  // Accumulate is_final segments per speaker until speech_final marks end of turn
  const utteranceAccRef    = useRef<Record<number, string>>({ 0: "", 1: "" });
  // Capture current state in refs so WebSocket callbacks always see fresh values
  const currentPhaseRef    = useRef(1);
  const discProfileRef     = useRef<string | null>(null);

  useEffect(() => { currentPhaseRef.current = currentPhase; }, [currentPhase]);
  useEffect(() => { discProfileRef.current = discProfile; }, [discProfile]);
  useEffect(() => { agentSpeakerNumRef.current = agentSpeakerNum; }, [agentSpeakerNum]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interim]);

  const stopMedia = useCallback(() => {
    callActiveRef.current = false;
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
    if (timerRef.current) clearInterval(timerRef.current);
    if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    wsRef.current = null;
    streamRef.current = null;
    recorderRef.current = null;
    timerRef.current = null;
    demoIntervalRef.current = null;
  }, []);

  useEffect(() => () => { stopMedia(); }, [stopMedia]);

  // ── Coaching analysis (non-blocking, best-effort) ──────────────────────────

  const analyzeUtterance = useCallback(async (text: string, speaker: Speaker) => {
    console.log(`[Spear] analyzeUtterance → speaker=${speaker} phase=${NEPQ_PHASES[currentPhaseRef.current - 1].name} text="${text.slice(0, 80)}"`);
    try {
      const res = await fetch("/api/coaching/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          utterance: text,
          speaker,
          nepqPhase: NEPQ_PHASES[currentPhaseRef.current - 1].name,
          discProfile: discProfileRef.current,
          agentId: userId,
        }),
      });
      console.log(`[Spear] /api/coaching/analyze → status=${res.status}`);
      if (!res.ok) {
        console.error(`[Spear] coaching API error: ${res.status} ${res.statusText}`);
        return;
      }
      const { card } = await res.json() as { card: Omit<CoachingCard, "id" | "timestamp" | "accepted" | "dismissed"> | null };
      console.log("[Spear] card received:", card);
      if (card) {
        setCards(prev => [{
          id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...card,
          timestamp: Date.now(),
          accepted: false,
          dismissed: false,
        }, ...prev]);
      }
    } catch (err) {
      console.error("[Spear] analyzeUtterance threw:", err);
    }
  }, []);

  // ── Deepgram message handler ───────────────────────────────────────────────

  const handleDgMessage = useCallback((raw: string) => {
    interface DgWord { word: string; start: number; end: number; speaker?: number; }
    interface DgResult {
      type?: string;
      is_final?: boolean;
      speech_final?: boolean;
      channel?: { alternatives?: { transcript?: string; words?: DgWord[] }[] };
    }
    let msg: DgResult;
    try { msg = JSON.parse(raw) as DgResult; } catch { return; }
    if (msg.type !== "Results") return;

    const alt      = msg.channel?.alternatives?.[0];
    const text     = alt?.transcript?.trim() ?? "";
    const words    = alt?.words ?? [];
    const isFinal  = msg.is_final    ?? false;
    const speechFinal = msg.speech_final ?? false;

    // Determine dominant speaker from word-level diarization tags
    const counts: Record<number, number> = {};
    words.forEach(w => { if (w.speaker != null) counts[w.speaker] = (counts[w.speaker] ?? 0) + 1; });
    const topEntry = Object.entries(counts).sort((a, b) => +b[1] - +a[1])[0];
    const speakerNum: number = topEntry ? +topEntry[0] : 0;
    // Use agentSpeakerNumRef so flipping mid-call takes effect immediately
    const speaker: Speaker = speakerNum === agentSpeakerNumRef.current ? "agent" : "prospect";

    if (!isFinal && !speechFinal) {
      // Pure interim — show live typing (don't commit anything)
      if (text) setInterim(prev => ({ ...prev, [speaker]: text }));
      return;
    }

    // Accumulate talk durations from word timings
    words.forEach(w => {
      const spk = w.speaker ?? speakerNum;
      talkDurRef.current[spk] = (talkDurRef.current[spk] ?? 0) + (w.end - w.start);
    });
    const totalSec = (talkDurRef.current[0] ?? 0) + (talkDurRef.current[1] ?? 0);
    if (totalSec > 0) {
      const agentPct = Math.round(((talkDurRef.current[0] ?? 0) / totalSec) * 100);
      setTalkRatio({ agent: agentPct, prospect: 100 - agentPct });
    }

    if (isFinal && !speechFinal) {
      // Mid-turn final segment: accumulate text, show in interim so the agent
      // can read along, but don't commit to transcript yet
      if (text) {
        utteranceAccRef.current[speakerNum] =
          ((utteranceAccRef.current[speakerNum] ?? "") + " " + text).trim();
        setInterim(prev => ({ ...prev, [speaker]: utteranceAccRef.current[speakerNum] }));
      }
      return;
    }

    // speech_final: true — utterance is complete. Flush the buffer.
    const accumulated = (utteranceAccRef.current[speakerNum] ?? "").trim();
    const fullText = text
      ? accumulated ? `${accumulated} ${text}` : text
      : accumulated;
    utteranceAccRef.current[speakerNum] = "";

    if (!fullText) return;

    console.log(`[Spear] DG utterance complete → speaker=${speaker}(${speakerNum}) text="${fullText.slice(0, 80)}"`);

    // Commit full utterance to transcript
    setTranscript(prev => [...prev, {
      id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      speaker,
      speakerNum,
      text: fullText,
      isFinal: true,
      timestamp: Date.now(),
    }]);
    setInterim(prev => ({ ...prev, [speaker]: "" }));

    // NEPQ phase advance (agent only)
    if (speaker === "agent") {
      setCurrentPhase(prev => {
        const next = detectNextPhase(fullText, prev);
        currentPhaseRef.current = next;
        return next;
      });
    }

    // DISC detection on every 3rd prospect utterance
    if (speaker === "prospect") {
      prospectLinesRef.current = [...prospectLinesRef.current, fullText];
      if (prospectLinesRef.current.length % 3 === 0) {
        const detected = detectDisc(prospectLinesRef.current);
        if (detected) {
          setDiscProfile(detected);
          discProfileRef.current = detected;
        }
      }
    }

    // Fire coaching analysis on complete prospect utterances only
    if (speaker === "prospect") analyzeUtterance(fullText, speaker);
  }, [analyzeUtterance]);

  // ── Deepgram WebSocket connection ──────────────────────────────────────────

  const connectDeepgram = useCallback((stream: MediaStream) => {
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!apiKey) {
      setMicError("NEXT_PUBLIC_DEEPGRAM_API_KEY is not set. Check your .env.local.");
      return;
    }

    // nova-3 has better diarization; utterance_end_ms=2000 prevents mid-utterance speaker flips
    const qs = "model=nova-3&language=en&punctuate=true&smart_format=true&interim_results=true&diarize=true&utterance_end_ms=2000&filler_words=false";
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${qs}`, ["token", apiKey]);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectRef.current = 0;
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (e) => {
        if (ws.readyState === WebSocket.OPEN && e.data.size > 0) ws.send(e.data);
      });
      recorder.start(250); // 250ms chunks
    };

    ws.onmessage = (e) => handleDgMessage(e.data as string);

    ws.onerror = () => {
      setMicError("Transcription service connection failed. Check your Deepgram API key and internet connection.");
    };

    ws.onclose = () => {
      if (callActiveRef.current && reconnectRef.current < 3) {
        reconnectRef.current += 1;
        recorderRef.current?.stop();
        recorderRef.current = null;
        setTimeout(() => { if (callActiveRef.current) connectDeepgram(stream); }, 1500);
      }
    };
  }, [handleDgMessage]);

  // ── Demo call playback ─────────────────────────────────────────────────────

  const startDemoCall = useCallback(() => {
    callActiveRef.current = true;
    let idx = 0;
    let agentCount = 0;
    let totalCount = 0;

    setCallState("active");
    setTranscript([]);
    setCards([]);
    setInterim({ agent: "", prospect: "" });
    setCurrentPhase(1);
    setTalkRatio({ agent: 50, prospect: 50 });
    setDuration(0);
    setDiscProfile(null);
    setAgentSpeakerNum(0);
    agentSpeakerNumRef.current = 0;

    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

    demoIntervalRef.current = setInterval(() => {
      if (idx >= DEMO_SCRIPT.length) {
        if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
        return;
      }

      const line = DEMO_SCRIPT[idx];
      idx += 1;
      totalCount += 1;
      if (line.speaker === "agent") agentCount += 1;

      // Transcript line
      setTranscript(prev => [...prev, {
        id: `demo-${idx}`,
        speaker: line.speaker,
        speakerNum: line.speaker === "agent" ? 0 : 1,
        text: line.text,
        isFinal: true,
        timestamp: Date.now(),
      }]);

      // NEPQ phase
      if (line.nepqPhaseForce) {
        setCurrentPhase(line.nepqPhaseForce);
        currentPhaseRef.current = line.nepqPhaseForce;
      } else if (line.speaker === "agent") {
        setCurrentPhase(prev => {
          const next = detectNextPhase(line.text, prev);
          currentPhaseRef.current = next;
          return next;
        });
      }

      // DISC profile update
      if (line.discUpdate) {
        setDiscProfile(line.discUpdate);
        discProfileRef.current = line.discUpdate;
      }

      // Talk ratio (line-count approximation for demo)
      const agentPct = Math.round((agentCount / totalCount) * 100);
      setTalkRatio({ agent: agentPct, prospect: 100 - agentPct });

      // Coaching card
      if (line.card) {
        setCards(prev => [{
          id: `demo-card-${idx}`,
          ...line.card!,
          timestamp: Date.now(),
          accepted: false,
          dismissed: false,
        }, ...prev]);
      }
    }, 4000);
  }, []);

  // ── Start / End call ───────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    setMicError(null);

    if (IS_DEMO) {
      startDemoCall();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      callActiveRef.current = true;
      talkDurRef.current = { 0: 0, 1: 0 };
      utteranceAccRef.current = { 0: "", 1: "" };
      prospectLinesRef.current = [];
      reconnectRef.current = 0;

      setCallState("active");
      setTranscript([]);
      setCards([]);
      setInterim({ agent: "", prospect: "" });
      setCurrentPhase(1);
      setTalkRatio({ agent: 50, prospect: 50 });
      setDuration(0);
      setDiscProfile(null);
      setAgentSpeakerNum(0);
      agentSpeakerNumRef.current = 0;

      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      connectDeepgram(stream);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicError("Spear needs microphone access to coach you in real time. Please allow mic access and refresh.");
      } else {
        setMicError("Could not start microphone. Please check your device settings.");
      }
    }
  }, [connectDeepgram, startDemoCall]);

  const endCall = useCallback(async () => {
    stopMedia();
    setCallState("saving");

    // Save session to DB (non-blocking from UI perspective)
    try {
      await fetch("/api/calls/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: userId,
          durationSeconds: duration,
          transcript,
          coachingCardsFired: cards,
          cardsAccepted: cards.filter(c => c.accepted).map(c => c.id),
          cardsDismissed: cards.filter(c => c.dismissed).map(c => c.id),
          talkRatioAgent: talkRatio.agent,
          talkRatioProspect: talkRatio.prospect,
          discProfile,
          nepqPhases: { highest_phase_reached: currentPhase },
          outcome: "unknown",
          prospectName: prospectName.trim() || null,
        }),
      });
    } catch {
      // Save is best-effort; don't block
    } finally {
      setCallState("idle");
      setProspectName(""); // Clear for the next call
    }
  }, [stopMedia, duration, transcript, cards, talkRatio, discProfile, currentPhase, prospectName]);

  // ── Card thumbs ────────────────────────────────────────────────────────────

  const toggleCard = (id: string, action: "accept" | "dismiss") => {
    setCards(prev => prev.map(c =>
      c.id === id
        ? { ...c, accepted: action === "accept" ? !c.accepted : false, dismissed: action === "dismiss" ? !c.dismissed : false }
        : c
    ));
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const isActive = callState === "active";
  const phase    = NEPQ_PHASES[currentPhase - 1];
  const ratioWarning = talkRatio.agent > 50 ? "text-red-400" : talkRatio.agent > 42 ? "text-amber-400" : "text-emerald-400";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 shrink-0 gap-4">
        <Link href="/dashboard"
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm shrink-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        <div className="flex items-center gap-3">
          {IS_DEMO && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-amber-400/15 border border-amber-400/30 text-amber-300 uppercase">
              Demo
            </span>
          )}
          <AnimatePresence>
            {isActive && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                LIVE
              </motion.span>
            )}
          </AnimatePresence>
          <Image src="/spear-logo.PNG" alt="Spear" width={160} height={160}
            style={{ height: "36px", width: "auto", objectFit: "contain" }} />
        </div>

        <div className="w-20 text-right shrink-0">
          {(isActive || callState === "saving") && (
            <span className="font-mono text-sm text-zinc-300 tabular-nums">{formatDuration(duration)}</span>
          )}
        </div>
      </header>

      {/* ── Mic error banner ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {micError && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-red-500/10 border-b border-red-500/20 px-4 py-3 text-sm text-red-300"
          >
            {micError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Two-panel body ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel — Transcript (60%) */}
        <div className="flex flex-col w-full lg:w-[60%] border-r border-zinc-800 overflow-hidden">

          {/* NEPQ phase strip */}
          <div className="px-4 pt-3 pb-2.5 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">NEPQ Phase</p>
              <div className="flex items-center gap-2">
                {isActive && (
                  <button
                    onClick={() => {
                      const next = agentSpeakerNum === 0 ? 1 : 0;
                      setAgentSpeakerNum(next);
                      agentSpeakerNumRef.current = next;
                    }}
                    title="Swap which voice is Agent vs Prospect"
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
                  >
                    ⇄ Flip Speakers
                  </button>
                )}
                <p className="text-xs text-zinc-300 font-medium">
                  {currentPhase}. {phase.name}
                </p>
              </div>
            </div>
            <div className="flex gap-1 mb-1.5">
              {NEPQ_PHASES.map(p => (
                <div key={p.id} className="flex-1">
                  <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${
                    p.id < currentPhase  ? "bg-blue-600" :
                    p.id === currentPhase ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" :
                    "bg-zinc-800"
                  }`} />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">{phase.hint}</p>
          </div>

          {/* Transcript scroll area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {transcript.length === 0 && callState === "idle" && (
              <div className="h-full flex flex-col items-center justify-center gap-5">
                <div className="h-16 w-16 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center opacity-60">
                  <Mic className="h-7 w-7 text-zinc-600" />
                </div>
                {/* Prospect name field */}
                <div className="w-full max-w-xs">
                  <label className="block text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5">
                    Prospect name <span className="normal-case text-zinc-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={prospectName}
                    onChange={e => setProspectName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>
                <p className="text-sm text-zinc-500 text-center max-w-xs leading-relaxed opacity-60">
                  Click <span className="text-emerald-400 font-medium">Start Call</span> and the transcript
                  will appear here as you speak.
                </p>
              </div>
            )}

            {transcript.length === 0 && callState === "active" && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-sm text-zinc-600 text-center mt-16"
              >
                Listening for speech…
              </motion.p>
            )}

            {transcript.map(line => {
              // Derive speaker live from agentSpeakerNum — so flipping updates all lines instantly
              const derivedSpeaker: Speaker = line.speakerNum === agentSpeakerNum ? "agent" : "prospect";
              return (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex gap-2.5 ${derivedSpeaker === "prospect" ? "flex-row-reverse" : ""}`}
                >
                  {/* Speaker badge — click to flip this speaker's assignment */}
                  <button
                    title={`Switch to ${derivedSpeaker === "agent" ? "Prospect" : "Agent"}`}
                    onClick={() => {
                      // Reassign: make this line's speakerNum the agent speaker
                      const newAgentNum = line.speakerNum;
                      setAgentSpeakerNum(newAgentNum);
                      agentSpeakerNumRef.current = newAgentNum;
                    }}
                    className={`h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5 cursor-pointer transition-opacity hover:opacity-70 ${
                      derivedSpeaker === "agent"
                        ? "bg-blue-600/30 text-blue-300"
                        : "bg-zinc-700 text-zinc-300"
                    }`}
                  >
                    {derivedSpeaker === "agent" ? "A" : "P"}
                  </button>
                  <div className={`flex-1 max-w-[80%] ${derivedSpeaker === "prospect" ? "text-right items-end flex flex-col" : ""}`}>
                    <p className={`text-[10px] font-medium mb-0.5 ${
                      derivedSpeaker === "agent" ? "text-blue-500" : "text-zinc-500"
                    }`}>
                      {derivedSpeaker === "agent" ? "Agent" : "Prospect"}
                    </p>
                    <p className={`text-sm leading-relaxed ${
                      derivedSpeaker === "agent" ? "text-blue-200" : "text-zinc-100"
                    }`}>
                      {line.text}
                    </p>
                  </div>
                </motion.div>
              );
            })}

            {/* Interim (live typing) */}
            {(["agent", "prospect"] as Speaker[]).map(spk => {
              const text = interim[spk];
              if (!text) return null;
              return (
                <motion.div
                  key={`interim-${spk}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.55 }}
                  className={`flex gap-2.5 ${spk === "prospect" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5 ${
                    spk === "agent" ? "bg-blue-600/30 text-blue-300" : "bg-zinc-700 text-zinc-300"
                  }`}>
                    {spk === "agent" ? "A" : "P"}
                  </div>
                  <p className={`text-sm leading-relaxed italic ${
                    spk === "agent" ? "text-blue-200" : "text-zinc-100"
                  }`}>
                    {text}
                  </p>
                </motion.div>
              );
            })}

            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Right panel — Coaching cards (40%, desktop only) */}
        <div className="hidden lg:flex flex-col w-[40%] overflow-hidden">
          <div className="px-4 pt-3 pb-2.5 border-b border-zinc-800 bg-zinc-900/40 shrink-0 flex items-center justify-between">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">AI Coaching</p>
            <AnimatePresence>
              {discProfile && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  className="text-[11px] px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/25 text-purple-300 font-medium"
                >
                  DISC — {discProfile}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {cards.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40">
                <Brain className="h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-500 text-center px-4 leading-relaxed">
                  Coaching cards will appear here during your call
                </p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {cards.map((card, idx) => {
                const style = CARD_STYLE[card.type];
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, x: 32, scale: 0.97 }}
                    animate={{ opacity: idx === 0 ? 1 : 0.5, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 32, scale: 0.95, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                    className={`rounded-xl border p-3.5 transition-opacity ${style.border} ${style.bg} ${card.dismissed ? "opacity-20" : ""}`}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none">{style.emoji}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${style.badge}`}>
                          {card.type.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => toggleCard(card.id, "accept")}
                          title="Used this"
                          className={`p-1.5 rounded-md transition-colors ${
                            card.accepted ? "text-emerald-400 bg-emerald-500/15" : "text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10"
                          }`}
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => toggleCard(card.id, "dismiss")}
                          title="Not relevant"
                          className={`p-1.5 rounded-md transition-colors ${
                            card.dismissed ? "text-zinc-600 bg-zinc-700/30" : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700/30"
                          }`}
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-white mb-1 leading-snug">{card.title}</p>
                    <p className="text-xs text-zinc-300 leading-relaxed">{card.body}</p>

                    {card.suggestedResponse && (
                      <div className="mt-2.5 pt-2.5 border-t border-white/6">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Say:</p>
                        <p className="text-[11px] text-zinc-200 italic leading-relaxed">
                          &ldquo;{card.suggestedResponse}&rdquo;
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      <div className="border-t border-zinc-800 bg-zinc-900/90 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">

          {/* Mic status */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isActive ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <Mic className="h-4 w-4 text-emerald-400" />
              </>
            ) : (
              <MicOff className="h-4 w-4 text-zinc-600" />
            )}
          </div>

          {/* Talk ratio bar */}
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <span className="text-[11px] text-zinc-500 shrink-0">Agent</span>
            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-l-full transition-all duration-1000"
                style={{ width: `${talkRatio.agent}%` }}
              />
            </div>
            <div
              className="h-2 bg-zinc-600 rounded-r-full transition-all duration-1000"
              style={{ width: "4px" }}
            />
            <span className="text-[11px] text-zinc-500 shrink-0">Prospect</span>
            <span className={`text-[11px] font-semibold shrink-0 tabular-nums ${ratioWarning}`}>
              {talkRatio.agent}% / {talkRatio.prospect}%
            </span>
          </div>

          {/* Call button */}
          <div className="shrink-0">
            {callState === "idle" && (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={startCall}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
              >
                <Phone className="h-4 w-4" />
                Start Call
              </motion.button>
            )}
            {callState === "active" && (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={endCall}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
              >
                <PhoneOff className="h-4 w-4" />
                End Call
              </motion.button>
            )}
            {callState === "saving" && (
              <button disabled
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-zinc-800 text-zinc-500 text-sm font-semibold cursor-not-allowed"
              >
                <span className="h-4 w-4 rounded-full border-2 border-zinc-600 border-t-zinc-400 animate-spin" />
                Saving…
              </button>
            )}
          </div>
        </div>

        {/* Mobile coaching cards — horizontal scroll strip */}
        <AnimatePresence>
          {cards.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="lg:hidden mt-3 pt-3 border-t border-zinc-800/60 overflow-hidden"
            >
              <div className="flex gap-2 overflow-x-auto pb-1">
                {cards.slice(0, 5).map(card => {
                  const s = CARD_STYLE[card.type];
                  return (
                    <div key={card.id}
                      className={`rounded-lg border p-2.5 min-w-[200px] max-w-[220px] shrink-0 ${s.border} ${s.bg}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span>{s.emoji}</span>
                        <p className="text-xs font-semibold text-white truncate">{card.title}</p>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed line-clamp-2">{card.body}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
