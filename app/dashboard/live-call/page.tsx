"use client";

import React, { Suspense, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Phone, PhoneOff, Mic, MicOff, ArrowLeft,
  ThumbsUp, ThumbsDown, Brain, Sparkles,
} from "lucide-react";
import type { ProductRec } from "@/app/api/coaching/product-rec/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallState = "idle" | "active" | "outcome" | "saving" | "saved";
type Speaker = "agent" | "prospect";

interface TranscriptLine {
  id: string;
  speaker: Speaker;
  speakerNum: number; // Raw Deepgram speaker index (0 or 1)
  speakerOverride?: Speaker; // Per-line manual correction; takes priority over global agentSpeakerNum
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

// ─── Product focus options ────────────────────────────────────────────────────

const PRODUCT_FOCUSES = [
  { id: "mortgage_protection", label: "Mortgage Protection" },
  { id: "final_expense",       label: "Final Expense"        },
  { id: "term_life",           label: "Term Life"            },
  { id: "iul",                 label: "IUL / Living Benefits"},
  { id: "whole_life",          label: "Whole Life"           },
] as const;

type ProductFocus = typeof PRODUCT_FOCUSES[number]["id"];

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
  productRec?: ProductRec;
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
      body: "Steady buyer — family-focused, risk-averse. Lead with protection and security, not numbers." },
    productRec: {
      product: "20-Year Mortgage Protection Term",
      productType: "Mortgage Protection",
      reasoning: "Married with two kids and likely a mortgage — if he dies, the family keeps the house. 20-year term matches the typical payoff window.",
      carriers: ["North American", "American Amicable"],
      keyPitch: "If something happened to you tomorrow, your family keeps the house — that's exactly what this policy does.",
    } },
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

function LiveCallPageInner() {
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
  const userIdRef                     = useRef<string>("demo-agent");
  const [prospectName, setProspectName] = useState<string>("");
  const [selectedOutcome, setSelectedOutcome] = useState<"closed" | "not_closed" | "follow_up" | "unknown">("unknown");
  const [savedCallId, setSavedCallId] = useState<string | null>(null);
  const [productRec, setProductRec]   = useState<ProductRec | null>(null);
  const [productFocus, setProductFocus] = useState<ProductFocus>(() => {
    if (typeof window === "undefined") return "mortgage_protection";
    return (localStorage.getItem("spear_product_focus") as ProductFocus) ?? "mortgage_protection";
  });
  const searchParams = useSearchParams();
  const leadId = searchParams.get("lead");
  const leadName = searchParams.get("name");
  // Which Deepgram speaker index (0 or 1) is the agent. Flip if DG gets it wrong.
  const [agentSpeakerNum, setAgentSpeakerNum] = useState(0);
  const agentSpeakerNumRef = useRef(0);
  // Twilio: phone number to dial + active call SID
  const [dialNumber, setDialNumber]   = useState<string>("");
  const [twilioCallSid, setTwilioCallSid] = useState<string | null>(null);
  const [callStatus, setCallStatus]   = useState<string>(""); // "ringing" | "answered" | ""
  const hasTwilio = !!process.env.NEXT_PUBLIC_TWILIO_ENABLED;

  // Fetch real user ID and product focus on mount
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user?.id) { setUserId(user.id); userIdRef.current = user.id; }
    });
    // Load product focus so coaching is tailored to the agent's product type
    fetch("/api/agent-profile")
      .then(r => r.json())
      .then(data => { if (data.profile?.product_focus) setProductFocus(data.profile.product_focus); })
      .catch(() => {/* ignore */});
    // Pre-fill prospect name from lead URL param
    if (leadName) setProspectName(decodeURIComponent(leadName));
  }, [leadName]);

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
  const lastSpeakerRef     = useRef<number>(0);
  // Capture current state in refs so WebSocket callbacks always see fresh values
  const currentPhaseRef    = useRef(1);
  // Transcript ref so coaching callbacks always see latest lines
  const transcriptRef      = useRef<TranscriptLine[]>([]);
  // Deduplication: track the last 2 card types fired and their timestamps
  const recentCardTypesRef = useRef<{ type: string; ts: number }[]>([]);
  // Track if DISC card has been fired this call (only fire once)
  const discCardFiredRef   = useRef(false);
  const discProfileRef     = useRef<string | null>(null);
  // Product rec: fire after every 3rd prospect utterance
  const prospectUtteranceCountRef = useRef(0);

  useEffect(() => { currentPhaseRef.current = currentPhase; }, [currentPhase]);
  useEffect(() => { discProfileRef.current = discProfile; }, [discProfile]);
  useEffect(() => { agentSpeakerNumRef.current = agentSpeakerNum; }, [agentSpeakerNum]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { localStorage.setItem("spear_product_focus", productFocus); }, [productFocus]);

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
    const phase = NEPQ_PHASES[currentPhaseRef.current - 1].name;
    console.log(`[Spear] analyzeUtterance → speaker=${speaker} phase=${phase} text="${text.slice(0, 80)}"`);

    // Build recent conversation context (last 6 committed lines)
    // Respect per-line overrides; fall back to global agentSpeakerNum mapping
    const recentLines = transcriptRef.current.slice(-6).map(l => ({
      speaker: l.speakerOverride ?? (l.speakerNum === agentSpeakerNumRef.current ? "agent" : "prospect"),
      text: l.text,
    }));

    // Deduplication: get card types fired in the last 45 seconds
    const now = Date.now();
    recentCardTypesRef.current = recentCardTypesRef.current.filter(e => now - e.ts < 45_000);
    const recentCardTypes = recentCardTypesRef.current.map(e => e.type);

    // Skip DISC if already fired this call
    if (discCardFiredRef.current) {
      recentCardTypes.push("DISC_INSIGHT");
    }

    try {
      const res = await fetch("/api/coaching/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          utterance: text,
          speaker,
          nepqPhase: phase,
          discProfile: discProfileRef.current,
          agentId: userIdRef.current,       // always fresh — no stale closure
          recentLines,
          recentCardTypes,
          productFocus: productFocusRef.current, // always fresh — no stale closure
        }),
      });

      if (!res.ok) {
        console.error(`[Spear] coaching API error: ${res.status} ${res.statusText}`);
        return;
      }

      const { card } = await res.json() as { card: Omit<CoachingCard, "id" | "timestamp" | "accepted" | "dismissed"> | null };
      console.log("[Spear] card received:", card);

      if (card) {
        // Track fired card for deduplication
        recentCardTypesRef.current.push({ type: card.type, ts: Date.now() });
        if (card.type === "DISC_INSIGHT") discCardFiredRef.current = true;

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
  }, []); // stable — all values read via refs

  // ── Product recommendation ─────────────────────────────────────────────────

  const productFocusRef = useRef<ProductFocus>("mortgage_protection");
  useEffect(() => { productFocusRef.current = productFocus; }, [productFocus]);

  const analyzeProductRec = useCallback(async () => {
    const recentLines = transcriptRef.current.slice(-12).map(l => ({
      speaker: l.speakerOverride ?? (l.speakerNum === agentSpeakerNumRef.current ? "agent" : "prospect"),
      text: l.text,
    }));

    try {
      const res = await fetch("/api/coaching/product-rec", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recentLines,
          discProfile:  discProfileRef.current,
          nepqPhase:    NEPQ_PHASES[currentPhaseRef.current - 1].name,
          productFocus: productFocusRef.current,
        }),
      });
      if (!res.ok) return;
      const { rec } = await res.json() as { rec: ProductRec | null };
      if (rec) setProductRec(rec);
    } catch {
      // best-effort
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

    if (isFinal) {
      // Commit every is_final chunk immediately — don't wait for speech_final.
      if (!text) return;
      // Add to transcript first, then clear interim on next tick to avoid flicker
      setTranscript(prev => [...prev, {
        id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        speaker, speakerNum, text, isFinal: true, timestamp: Date.now(),
      }]);
      setTimeout(() => setInterim(prev => ({ ...prev, [speaker]: "" })), 50);
      // Accumulate for coaching analysis (fired on speech_final below)
      utteranceAccRef.current[speakerNum] =
        ((utteranceAccRef.current[speakerNum] ?? "") + " " + text).trim();
      if (!speechFinal) return;
    }

    // speech_final: run coaching on the full accumulated utterance
    const fullText = utteranceAccRef.current[speakerNum]?.trim() ?? "";
    utteranceAccRef.current[speakerNum] = "";

    if (!fullText) return;

    // NEPQ phase advance (agent only)
    if (speaker === "agent") {
      setCurrentPhase(prev => {
        const next = detectNextPhase(fullText, prev);
        currentPhaseRef.current = next;
        return next;
      });
    }

    // DISC detection + product rec on every 3rd prospect utterance
    if (speaker === "prospect") {
      prospectLinesRef.current = [...prospectLinesRef.current, fullText];
      prospectUtteranceCountRef.current += 1;
      if (prospectLinesRef.current.length % 3 === 0) {
        const detected = detectDisc(prospectLinesRef.current);
        if (detected) {
          setDiscProfile(detected);
          discProfileRef.current = detected;
        }
      }
      if (prospectUtteranceCountRef.current % 3 === 0) {
        analyzeProductRec();
      }
    }

    // Fire coaching on ALL utterances:
    // Prospect → OBJECTION, DISC_INSIGHT, CLOSE_SIGNAL detection
    // Agent → NEPQ_MOVE detection (did they pitch instead of ask? miss a phase?)
    analyzeUtterance(fullText, speaker);
  }, [analyzeUtterance]);

  // ── Deepgram WebSocket connection ──────────────────────────────────────────

  const connectDeepgram = useCallback((stream: MediaStream) => {
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!apiKey) {
      setMicError("NEXT_PUBLIC_DEEPGRAM_API_KEY is not set. Check your .env.local.");
      return;
    }

    // utterance_end_ms=1500: wait 1.5s of silence before closing an utterance (reduces short-fragment misidentification)
    // endpointing=500: slightly longer endpointing window for more accurate speaker diarization on short responses like "Yes."
    const qs = "model=nova-3&language=en&punctuate=true&smart_format=true&interim_results=true&diarize=true&utterance_end_ms=1500&endpointing=500&filler_words=false";
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
      recorder.start(250);
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
    setProductRec(null);
    setAgentSpeakerNum(0);
    agentSpeakerNumRef.current = 0;
    recentCardTypesRef.current = [];
    discCardFiredRef.current = false;
    prospectUtteranceCountRef.current = 0;
    transcriptRef.current = [];

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

      // Product recommendation
      if (line.productRec) setProductRec(line.productRec);
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
      setProductRec(null);
      setAgentSpeakerNum(0);
      agentSpeakerNumRef.current = 0;
      recentCardTypesRef.current = [];
      discCardFiredRef.current = false;
      prospectUtteranceCountRef.current = 0;
      transcriptRef.current = [];

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

  // ── Twilio outbound dial ───────────────────────────────────────────────────

  const dialOut = useCallback(async (toNumber: string) => {
    if (!toNumber) return;
    // Normalize: ensure E.164 format (+1XXXXXXXXXX for US numbers)
    let normalized = toNumber.replace(/\D/g, ""); // strip non-digits
    if (normalized.length === 10) normalized = "1" + normalized;
    if (!normalized.startsWith("+")) normalized = "+" + normalized;
    setMicError(null);
    setCallStatus("ringing");
    try {
      const res = await fetch("/api/twilio/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: normalized,
          agentId: userIdRef.current,
          leadId: leadId ?? undefined,
        }),
      });
      const data = await res.json() as { callSid?: string; error?: string };
      if (!res.ok || data.error) {
        setMicError(`Twilio error: ${data.error ?? "Unknown error"}`);
        setCallStatus("");
        return;
      }
      setTwilioCallSid(data.callSid ?? null);
      setCallStatus(data.callSid ? "ringing" : "");
      // Now start the browser mic + Deepgram for agent-side transcription
      await startCall();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMicError(`Failed to dial: ${msg}`);
      setCallStatus("");
    }
  }, [leadId, startCall]);

  // Step 1: stop the call, show outcome picker
  const endCall = useCallback(() => {
    stopMedia();
    setSelectedOutcome("unknown");
    setCallState("outcome");
  }, [stopMedia]);

  // Step 2: save with chosen outcome
  const saveCall = useCallback(async (outcome: "closed" | "not_closed" | "follow_up" | "unknown") => {
    setCallState("saving");
    try {
      const res = await fetch("/api/calls/save", {
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
          outcome,
          prospectName: prospectName.trim() || null,
          leadId: leadId || null,
          twilioCallSid: twilioCallSid || null,
        }),
      });
      const data = await res.json() as { id?: string };
      setSavedCallId(data.id ?? null);
      setCallState("saved");
    } catch {
      // Save best-effort — still show saved screen
      setCallState("saved");
    }
  }, [userId, duration, transcript, cards, talkRatio, discProfile, currentPhase, prospectName, leadId]);

  // ── Card thumbs ────────────────────────────────────────────────────────────

  const toggleCard = (id: string, action: "accept" | "dismiss") => {
    setCards(prev => prev.map(c =>
      c.id === id
        ? { ...c, accepted: action === "accept" ? !c.accepted : false, dismissed: action === "dismiss" ? !c.dismissed : false }
        : c
    ));
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const isActive     = callState === "active";
  const isOutcome    = callState === "outcome";
  const isSaved      = callState === "saved";
  const phase        = NEPQ_PHASES[currentPhase - 1];
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
            {callStatus === "ringing" && !isActive && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Ringing…
              </motion.span>
            )}
            {isActive && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                {twilioCallSid ? "LIVE · Twilio" : "LIVE"}
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

      {/* ── Outcome picker modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOutcome && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-base font-bold text-white mb-1">How did the call go?</h3>
              <p className="text-xs text-zinc-500 mb-5">Log the outcome so Spear can track your close rate.</p>

              <div className="grid grid-cols-2 gap-2.5 mb-5">
                {([
                  { value: "closed",      label: "🏆 Closed",       desc: "Got the sale",           color: "border-emerald-500/50 bg-emerald-500/8 hover:bg-emerald-500/15 text-emerald-300" },
                  { value: "not_closed",  label: "❌ Not Closed",    desc: "Didn't close",           color: "border-red-500/40 bg-red-500/6 hover:bg-red-500/12 text-red-300" },
                  { value: "follow_up",   label: "📅 Follow Up",     desc: "Callback scheduled",     color: "border-blue-500/40 bg-blue-500/6 hover:bg-blue-500/12 text-blue-300" },
                  { value: "unknown",     label: "— Skip",           desc: "Log later",              color: "border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400" },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedOutcome(opt.value)}
                    className={`rounded-xl border p-3 text-left transition-all ${opt.color} ${selectedOutcome === opt.value ? "ring-2 ring-white/20 scale-[1.02]" : ""}`}
                  >
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <button
                onClick={() => saveCall(selectedOutcome)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
              >
                Save &amp; Finish
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Saved screen ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSaved && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm text-center"
            >
              {/* Score ring */}
              <div className="w-20 h-20 rounded-full border-2 border-blue-500/40 bg-blue-500/10 flex items-center justify-center mx-auto mb-5">
                <Brain className="h-9 w-9 text-blue-400" />
              </div>

              <h2 className="text-xl font-bold text-white mb-1">Call saved</h2>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                {prospectName ? `${prospectName}'s call` : "Your call"} has been logged.{" "}
                {selectedOutcome === "closed" && "🏆 Nice close!"}
                {selectedOutcome === "follow_up" && "📅 Follow-up noted."}
              </p>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3 mb-7">
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Duration</p>
                  <p className="text-sm font-bold text-zinc-100">{formatDuration(duration)}</p>
                </div>
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Talk %</p>
                  <p className={`text-sm font-bold ${ratioWarning}`}>{talkRatio.agent}%</p>
                </div>
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Cards</p>
                  <p className="text-sm font-bold text-zinc-100">{cards.length}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {savedCallId && (
                  <Link
                    href={`/dashboard?tab=coaching&call=${savedCallId}`}
                    className="block w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors text-center"
                  >
                    View Coaching Report
                  </Link>
                )}
                <button
                  onClick={() => {
                    setCallState("idle");
                    setTranscript([]);
                    setCards([]);
                    setDiscProfile(null);
                    setProductRec(null);
                    setDuration(0);
                    setCurrentPhase(1);
                    setTalkRatio({ agent: 50, prospect: 50 });
                    setProspectName("");
                    setSavedCallId(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold transition-colors"
                >
                  Start Next Call
                </button>
                <Link href="/dashboard" className="block text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-1 text-center">
                  Back to Dashboard
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      // Flip global mapping AND clear all per-line overrides
                      const next = agentSpeakerNum === 0 ? 1 : 0;
                      setAgentSpeakerNum(next);
                      agentSpeakerNumRef.current = next;
                      setTranscript(prev => prev.map(l => ({ ...l, speakerOverride: undefined })));
                    }}
                    title="Flip all speakers globally (clears individual corrections)"
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
                  >
                    ⇄ Flip All
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

                {/* Twilio dial number (shown when Twilio is enabled) */}
                {hasTwilio && (
                  <div className="w-full max-w-xs">
                    <label className="block text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5">
                      Phone number to dial
                    </label>
                    <input
                      type="tel"
                      value={dialNumber}
                      onChange={e => setDialNumber(e.target.value)}
                      placeholder="+17725551234"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1">Include country code. Leave blank to use mic only.</p>
                  </div>
                )}

                {/* Product focus selector */}
                <div className="w-full max-w-xs">
                  <label className="block text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5">
                    Product focus
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRODUCT_FOCUSES.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setProductFocus(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                          productFocus === f.id
                            ? "bg-blue-600/30 border-blue-500/50 text-blue-300"
                            : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-300 hover:border-zinc-600"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
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
              // Per-line override takes priority; falls back to global agentSpeakerNum mapping
              const derivedSpeaker: Speaker = line.speakerOverride ?? (line.speakerNum === agentSpeakerNum ? "agent" : "prospect");
              return (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex gap-2.5 ${derivedSpeaker === "prospect" ? "flex-row-reverse" : ""}`}
                >
                  {/* Speaker badge — click to correct this individual line only */}
                  <button
                    title={`Correct: mark as ${derivedSpeaker === "agent" ? "Prospect" : "Agent"}`}
                    onClick={() => {
                      // Toggle this line's speaker without touching global mapping
                      const correctedSpeaker: Speaker = derivedSpeaker === "agent" ? "prospect" : "agent";
                      setTranscript(prev => prev.map(l =>
                        l.id === line.id ? { ...l, speakerOverride: correctedSpeaker } : l
                      ));
                    }}
                    className={`h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5 cursor-pointer transition-opacity hover:opacity-70 ${
                      derivedSpeaker === "agent"
                        ? "bg-blue-600/30 text-blue-300"
                        : "bg-zinc-700 text-zinc-300"
                    } ${line.speakerOverride ? "ring-1 ring-amber-400/60" : ""}`}
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
          <div className="px-4 pt-3 pb-2.5 border-b border-zinc-800 bg-zinc-900/40 shrink-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium shrink-0">AI Coaching</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/15 border border-blue-500/25 text-blue-400 font-medium truncate">
                {PRODUCT_FOCUSES.find(f => f.id === productFocus)?.label ?? productFocus}
              </span>
            </div>
            <AnimatePresence>
              {discProfile && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  className="text-[11px] px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/25 text-purple-300 font-medium shrink-0"
                >
                  DISC — {discProfile}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Product Match — sticky above card stack */}
          <AnimatePresence>
            {productRec && (
              <motion.div
                key={productRec.product}
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden shrink-0"
              >
                <div className="mx-3 mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-emerald-500/20 text-emerald-300">
                        Product Match
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">{productRec.productType}</span>
                  </div>
                  <p className="text-xs font-bold text-white mb-1 leading-snug">{productRec.product}</p>
                  <p className="text-xs text-zinc-300 leading-relaxed mb-2">{productRec.reasoning}</p>
                  {productRec.carriers.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mb-2.5">
                      {productRec.carriers.map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">{c}</span>
                      ))}
                    </div>
                  )}
                  <div className="pt-2 border-t border-white/6">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Say:</p>
                    <p className="text-[11px] text-zinc-200 italic leading-relaxed">&ldquo;{productRec.keyPitch}&rdquo;</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {cards.length === 0 && !productRec && (
              <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40">
                <Brain className="h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-500 text-center px-4 leading-relaxed">
                  Coaching cards will appear here during your call
                </p>
              </div>
            )}
            {cards.length === 0 && productRec && (
              <div className="flex items-center justify-center pt-4 opacity-30">
                <p className="text-xs text-zinc-500 text-center">Coaching cards will appear as the call unfolds</p>
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
                onClick={() => hasTwilio && dialNumber ? dialOut(dialNumber) : startCall()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
              >
                <Phone className="h-4 w-4" />
                {hasTwilio && dialNumber ? "Dial & Start" : "Start Call"}
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
            {callState === "outcome" && (
              <button disabled
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-zinc-800 text-zinc-500 text-sm font-semibold cursor-not-allowed"
              >
                <PhoneOff className="h-4 w-4" />
                Call Ended
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

export default function LiveCallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050A14] flex items-center justify-center text-zinc-500 text-sm">Loading...</div>}>
      <LiveCallPageInner />
    </Suspense>
  );
}
