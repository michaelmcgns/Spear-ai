"use client";

import React, { Suspense, useRef, useState, useCallback, useEffect, createContext, useContext } from "react";
import { useSearchParams } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, Phone, BarChart3, BookOpen, Users,
  Settings, LogOut, Upload, TrendingUp, CheckCircle2, AlertTriangle,
  Brain, Target, MessageSquare, Mic, Search, ChevronDown, ChevronRight,
  Award, ArrowUp, ArrowDown, Star, Zap, Radio, X, Lock,
} from "lucide-react";
import Link from "next/link";
import { RegulatoryBanner } from "@/components/compliance/RegulatoryBanner";
import { ComplianceStatus } from "@/components/compliance/ComplianceStatus";
import { AIBadge } from "@/components/compliance/AIBadge";
import { FeatureGate, PlanBadge } from "@/components/subscription/FeatureGate";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import { FEATURE_MIN_PLAN, type Feature } from "@/lib/subscription/plans";
import { ConsentModal } from "@/components/compliance/ConsentModal";
import { getConsentRequirement } from "@/lib/compliance/consentStates";

// ─── Welcome Modal ─────────────────────────────────────────────────────────────

const MAX_CALL_UPLOAD_BYTES = 500 * 1024 * 1024;
const MAX_CALL_UPLOAD_MB = Math.round(MAX_CALL_UPLOAD_BYTES / 1024 / 1024);

function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(5,10,20,0.85)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#0D1527",
        border: "1px solid rgba(201,168,76,0.25)",
        borderRadius: "16px",
        padding: "40px 36px",
        maxWidth: "460px",
        width: "100%",
        position: "relative",
        boxShadow: "0 0 80px rgba(201,168,76,0.08), 0 32px 64px rgba(0,0,0,0.5)",
      }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "16px", right: "16px",
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(184,168,120,0.5)", padding: "4px",
            display: "flex", alignItems: "center",
          }}
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div style={{
          width: "56px", height: "56px", borderRadius: "14px",
          background: "rgba(201,168,76,0.12)",
          border: "1px solid rgba(201,168,76,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "20px", fontSize: "26px",
        }}>
          🎯
        </div>

        <h2 style={{
          fontSize: "22px", fontWeight: 800, color: "#B8A878",
          marginBottom: "10px", letterSpacing: "-0.02em",
          fontFamily: "var(--font-space), system-ui, sans-serif",
        }}>
          Welcome to Spear.
        </h2>
        <p style={{ fontSize: "14px", color: "rgba(184,168,120,0.75)", lineHeight: 1.7, marginBottom: "28px" }}>
          Your account is active. Start by uploading your first call recording or launching a live call session.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link href="/dashboard/live-call" onClick={onClose} style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", padding: "13px",
              background: "#C9A84C", color: "#060D20",
              border: "none", borderRadius: "8px",
              fontWeight: 700, fontSize: "14px", cursor: "pointer",
              letterSpacing: "0.04em",
              fontFamily: "var(--font-space), system-ui, sans-serif",
            }}>
              Start Live Call
            </button>
          </Link>
          <button
            onClick={() => {
              onClose();
              document.getElementById("upload-section")?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{
              width: "100%", padding: "13px",
              background: "transparent", color: "#B8A878",
              border: "1px solid rgba(184,168,120,0.2)", borderRadius: "8px",
              fontWeight: 600, fontSize: "14px", cursor: "pointer",
              letterSpacing: "0.04em",
              fontFamily: "var(--font-space), system-ui, sans-serif",
            }}
          >
            Upload a Call Recording
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhaseScore { score: number; note: string; }

interface SpearAnalysis {
  overallScore: number;
  nepqPhases: {
    connection: PhaseScore; situation: PhaseScore; problemAwareness: PhaseScore;
    consequence: PhaseScore; solutionAwareness: PhaseScore; qualifying: PhaseScore; close: PhaseScore;
  };
  discProfile: { type: "D" | "I" | "S" | "C"; description: string; adjustments: string[]; };
  talkRatio: { agentPct: number; prospectPct: number; status: "green" | "yellow" | "red"; };
  objections: Array<{ text: string; type: string; handling: string; suggestedResponse: string; }>;
  strengths: string[];
  improvements: Array<{ what: string; why: string; instead: string; }>;
  mindsetNote: string;
  nextCallFocus: string;
  _ftcDisclosure?: string;
}

type CallRecord = {
  id: number; sessionId?: string; date: string; time: string; prospect: string;
  duration: string; durationSec: number; score: number;
  disc: "D" | "I" | "S" | "C"; objectionCount: number;
  phase: string; outcome: "closed" | "lost" | "follow_up" | "pending";
  revenue: number | null; product: string; topIssue: string | null;
  talkRatio: number;
  createdAtMs?: number;
  nepqScores?: Record<string, number>;
  objectionTypes?: string[];
};

type AgentRecord = {
  id: number; name: string; initials: string; role: string;
  callsMonth: number; avgScore: number; closeRate: number;
  revenueMTD: number; trend: "up" | "down" | "flat"; trendPct: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreBarColor(s: number) {
  if (s >= 9) return "bg-emerald-500"; if (s >= 7) return "bg-indigo-500";
  if (s >= 5) return "bg-amber-500"; return "bg-red-500";
}
function scoreTextColor(s: number) {
  if (s >= 9) return "text-emerald-400"; if (s >= 7) return "text-indigo-400";
  if (s >= 5) return "text-amber-400"; return "text-red-400";
}
function discBadgeColor(t: string) {
  const m: Record<string, string> = {
    D: "border-red-500/30 bg-red-500/15 text-red-300", I: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    S: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300", C: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  };
  return m[t] ?? "border-zinc-500/30 bg-zinc-500/15 text-zinc-300";
}
function discDotColor(t: string) {
  const m: Record<string, string> = { D: "bg-red-400", I: "bg-amber-400", S: "bg-emerald-400", C: "bg-blue-400" };
  return m[t] ?? "bg-zinc-400";
}
function objectionTypeColor(t: string) {
  const m: Record<string, string> = {
    price: "bg-red-500/20 text-red-300", spouse: "bg-purple-500/20 text-purple-300",
    timing: "bg-amber-500/20 text-amber-300", think_about_it: "bg-orange-500/20 text-orange-300",
    trust: "bg-blue-500/20 text-blue-300", other: "bg-zinc-500/20 text-zinc-300",
  };
  return m[t] ?? "bg-zinc-500/20 text-zinc-300";
}
function handlingColor(h: string) {
  const m: Record<string, string> = { resolved: "text-emerald-400", acknowledged: "text-amber-400", deflected: "text-red-400", ignored: "text-red-500" };
  return m[h] ?? "text-zinc-400";
}
function ratioColor(s: string) { if (s === "green") return "bg-emerald-500"; if (s === "yellow") return "bg-amber-500"; return "bg-red-500"; }
function ratioTextColor(s: string) { if (s === "green") return "text-emerald-400"; if (s === "yellow") return "text-amber-400"; return "text-red-400"; }
function ratioLabel(s: string) {
  if (s === "green") return "✅ Prospect is selling themselves";
  if (s === "yellow") return "⚠️ Slipping into pitch mode";
  return "🔴 This is a presentation, not a sales call";
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CALLS: CallRecord[] = [
  { id: 1,  date: "May 24", time: "2:34 PM",  prospect: "Robert Chen",     duration: "28:44", durationSec: 1724, score: 8.7, disc: "D", objectionCount: 1, phase: "Close",            outcome: "closed",  revenue: 11400, product: "IUL Policy",    topIssue: null,                                                              talkRatio: 34 },
  { id: 2,  date: "May 24", time: "11:15 AM", prospect: "Maria Vasquez",   duration: "41:22", durationSec: 2482, score: 5.2, disc: "S", objectionCount: 4, phase: "Consequence",       outcome: "lost",    revenue: null,  product: "Term Life",     topIssue: "Skipped consequence questions entirely",                         talkRatio: 58 },
  { id: 3,  date: "May 23", time: "4:01 PM",  prospect: "James Whitfield", duration: "33:18", durationSec: 1998, score: 9.1, disc: "I", objectionCount: 2, phase: "Close",            outcome: "closed",  revenue: 18200, product: "IUL Policy",    topIssue: null,                                                              talkRatio: 31 },
  { id: 4,  date: "May 23", time: "10:44 AM", prospect: "Diane Park",      duration: "22:57", durationSec: 1377, score: 7.8, disc: "C", objectionCount: 2, phase: "Qualifying",       outcome: "closed",  revenue: 6800,  product: "Final Expense", topIssue: null,                                                              talkRatio: 38 },
  { id: 5,  date: "May 22", time: "3:22 PM",  prospect: "Tony Okafor",     duration: "47:11", durationSec: 2831, score: 5.9, disc: "D", objectionCount: 5, phase: "Problem Awareness", outcome: "lost",    revenue: null,  product: "Term Life",     topIssue: "Over-talked at 61% — prospect never had room to sell themselves", talkRatio: 61 },
  { id: 6,  date: "May 22", time: "1:08 PM",  prospect: "Natalie Ford",    duration: "36:40", durationSec: 2200, score: 8.1, disc: "S", objectionCount: 2, phase: "Close",            outcome: "closed",  revenue: 9100,  product: "IUL Policy",    topIssue: null,                                                              talkRatio: 36 },
  { id: 7,  date: "May 21", time: "10:30 AM", prospect: "Carl Bennett",    duration: "54:18", durationSec: 3258, score: 6.4, disc: "C", objectionCount: 3, phase: "Consequence",       outcome: "lost",    revenue: null,  product: "Annuity",       topIssue: "Strong connection phase, broke down in consequence questions",    talkRatio: 44 },
  { id: 8,  date: "May 21", time: "9:02 AM",  prospect: "Sharon Miles",    duration: "29:33", durationSec: 1773, score: 9.2, disc: "S", objectionCount: 1, phase: "Close",            outcome: "closed",  revenue: 14600, product: "IUL Policy",    topIssue: null,                                                              talkRatio: 29 },
  { id: 9,  date: "May 20", time: "4:45 PM",  prospect: "Kevin Yuen",      duration: "38:59", durationSec: 2339, score: 7.1, disc: "I", objectionCount: 3, phase: "Qualifying",       outcome: "closed",  revenue: 7300,  product: "Final Expense", topIssue: null,                                                              talkRatio: 41 },
  { id: 10, date: "May 20", time: "2:11 PM",  prospect: "Patricia Lowry",  duration: "25:02", durationSec: 1502, score: 6.8, disc: "D", objectionCount: 2, phase: "Situation",         outcome: "lost",    revenue: null,  product: "Term Life",     topIssue: "Moved to solution too fast — situation phase was shallow",        talkRatio: 47 },
];

const MOCK_AGENTS: AgentRecord[] = [
  { id: 1, name: "Marcus T.", initials: "MT", role: "Senior Agent",  callsMonth: 48, avgScore: 8.4, closeRate: 42, revenueMTD: 124400, trend: "up",   trendPct: 8.2 },
  { id: 2, name: "Priya N.",  initials: "PN", role: "Agent",         callsMonth: 41, avgScore: 8.1, closeRate: 40, revenueMTD: 98600,  trend: "up",   trendPct: 4.1 },
  { id: 3, name: "You",       initials: "ME", role: "Agent",         callsMonth: 36, avgScore: 7.8, closeRate: 36, revenueMTD: 73200,  trend: "up",   trendPct: 2.7 },
  { id: 4, name: "Sarah K.",  initials: "SK", role: "Agent",         callsMonth: 39, avgScore: 7.9, closeRate: 38, revenueMTD: 86400,  trend: "flat", trendPct: 0.2 },
  { id: 5, name: "James R.",  initials: "JR", role: "Agent",         callsMonth: 31, avgScore: 7.2, closeRate: 31, revenueMTD: 52100,  trend: "down", trendPct: 3.1 },
  { id: 6, name: "Derek M.",  initials: "DM", role: "Junior Agent",  callsMonth: 28, avgScore: 6.1, closeRate: 24, revenueMTD: 31800,  trend: "up",   trendPct: 6.4 },
];

const COACHING_DRILLS = [
  {
    id: 1, phase: "Consequence Questions", priority: "critical" as const,
    title: "The Cost of Inaction Drill",
    description: "Your consequence phase averages 5.9 — the weakest in your profile. The prospect needs to emotionally feel the weight of NOT solving this. Practice these question patterns until they're automatic.",
    questions: [
      '"If this situation doesn\'t change, what does that look like for your family 5 years from now?"',
      '"What\'s the real cost — financially and emotionally — of leaving this unresolved?"',
      '"Who else in your household is affected if nothing changes here?"',
    ],
    currentScore: 5.9, targetScore: 8.0,
    currentTalkRatio: null, targetTalkRatio: null,
    sessionsCompleted: 0, sessionsTarget: 5,
  },
  {
    id: 2, phase: "Talk Ratio", priority: "high" as const,
    title: "Shut Up and Ask Drill",
    description: "Your average talk ratio is 44% — above the 40% threshold where you transition from selling to presenting. This drill forces you to end every statement with a question and treat silence as a win.",
    questions: [
      'After every piece of information you share, ask: "Does that make sense to you?"',
      "Never go more than 30 seconds without inviting the prospect to speak",
      "Count their silences as wins — prospects fill silence by selling themselves",
    ],
    currentScore: null, targetScore: null,
    currentTalkRatio: 44, targetTalkRatio: 35,
    sessionsCompleted: 0, sessionsTarget: 7,
  },
  {
    id: 3, phase: "Situation Questions", priority: "medium" as const,
    title: "Deep Discovery Framework",
    description: "You move through situation questions too quickly at 7.1. You're leaving insight — and trust — on the table. Slow down and paint a full picture before you go anywhere near problem awareness.",
    questions: [
      '"Walk me through what your current coverage looks like today..."',
      '"Tell me about your family situation — who depends on your income right now?"',
      '"What made you decide to take a look at this now, specifically?"',
    ],
    currentScore: 7.1, targetScore: 8.5,
    currentTalkRatio: null, targetTalkRatio: null,
    sessionsCompleted: 2, sessionsTarget: 5,
  },
];

const DASHBOARD_STATS = [
  { label: "Total Calls", value: "1,284", change: "+12.4% this month" },
  { label: "Avg Close Rate", value: "34.8%", change: "+2.1% this month" },
  { label: "Objections Caught", value: "416", change: "+18.9% this month" },
  { label: "Revenue Influenced", value: "$238,400", change: "+9.7% this month" },
];

// ─── Dashboard data context ───────────────────────────────────────────────────

interface RawCallSession {
  id: string; created_at: string; duration_seconds: number;
  outcome: string; overall_score: number | null;
  disc_profile_detected: string | null;
  objections_raised: unknown[];
  nepq_phases_completed: Record<string, { score?: number }>;
  talk_ratio_agent: number | null; notes: string | null;
  prospect_name: string | null;
  product_name?: string | null;
}

interface DashboardData {
  userId:    string | null;
  calls:     CallRecord[];
  hasReal:   boolean;   // true once we have at least 1 real call
  loading:   boolean;
  totalCalls: number; closeRate: number; avgScore: string; objectionsCaught: number;
  updateCallOutcome?: (sessionId: string, outcome: "closed" | "lost" | "follow_up" | "pending") => void;
}

const DashboardDataCtx = createContext<DashboardData>({
  userId: null, calls: MOCK_CALLS, hasReal: false, loading: true,
  totalCalls: 0, closeRate: 0, avgScore: "—", objectionsCaught: 0,
  updateCallOutcome: undefined,
});

function useDashboardData() { return useContext(DashboardDataCtx); }

function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getObjectionTypes(objections: unknown[]): string[] {
  return objections.map((objection) => {
    if (typeof objection === "object" && objection !== null) {
      const record = objection as Record<string, unknown>;
      const raw = record.type ?? record.text ?? "Other";
      return String(raw).trim() || "Other";
    }
    return String(objection || "Other").trim() || "Other";
  });
}

function titleCaseLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function sessionToRecord(s: RawCallSession, i: number): CallRecord {
  const dt = new Date(s.created_at);
  const phaseMap: Record<string, string> = {
    connection: "Connection", situation: "Situation",
    problemAwareness: "Problem Awareness", consequence: "Consequence",
    solutionAwareness: "Solution Awareness", qualifying: "Qualifying", close: "Close",
  };
  const phases = s.nepq_phases_completed ?? {};
  const nepqScores = Object.fromEntries(
    Object.entries(phases)
      .filter(([, value]) => value?.score != null)
      .map(([key, value]) => [key, Number(value.score)])
  );
  const objections = Array.isArray(s.objections_raised) ? s.objections_raised : [];
  let lastPhase = "Connection";
  for (const key of Object.keys(phaseMap)) {
    if ((phases[key] as { score?: number } | undefined)?.score != null) lastPhase = phaseMap[key];
  }
  const outcome =
    s.outcome === "closed" ? "closed" :
    s.outcome === "not_closed" ? "lost" :
    s.outcome === "follow_up" ? "follow_up" :
    "pending";
  return {
    id: i + 1,
    sessionId: s.id,
    date: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    createdAtMs: dt.getTime(),
    prospect: s.prospect_name ?? `Call ${i + 1}`,
    duration: fmtSec(s.duration_seconds ?? 0),
    durationSec: s.duration_seconds ?? 0,
    score: s.overall_score ?? 0,
    disc: (s.disc_profile_detected as "D" | "I" | "S" | "C") ?? "S",
    objectionCount: (s.objections_raised as unknown[])?.length ?? 0,
    phase: lastPhase, outcome, revenue: null, product: s.product_name ?? "Call Recording",
    topIssue: s.notes ?? null,
    talkRatio: Math.round(s.talk_ratio_agent ?? 50),
    nepqScores,
    objectionTypes: getObjectionTypes(objections),
  };
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  let cls = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (score < 7) cls = "bg-amber-500/20 text-amber-300 border-amber-500/30";
  if (score < 6) cls = "bg-red-500/20 text-red-300 border-red-500/30";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${cls}`}>{score.toFixed(1)}</span>;
}

function OutcomeBadge({ outcome, sessionId, onUpdate }: {
  outcome: "closed" | "lost" | "follow_up" | "pending";
  sessionId?: string;
  onUpdate?: (sessionId: string, outcome: "closed" | "lost" | "follow_up" | "pending") => void;
}) {
  const [current, setCurrent] = useState(outcome);
  const [saving, setSaving] = useState<"closed" | "lost" | "follow_up" | "pending" | null>(null);

  useEffect(() => { setCurrent(outcome); }, [outcome]);

  async function select(val: "closed" | "lost" | "follow_up" | "pending") {
    if (!sessionId || saving) return;
    setSaving(val);
    const prev = current;
    setCurrent(val);
    try {
      const res = await fetch("/api/calls/update-outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, outcome: val }),
      });
      if (!res.ok) {
        setCurrent(prev);
        return;
      }
      onUpdate?.(sessionId, val);
    } catch {
      setCurrent(prev);
    } finally {
      setSaving(null);
    }
  }

  if (current === "closed") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ Closed</span>;
  }
  if (current === "lost") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20">✗ Lost</span>;
  }
  if (current === "follow_up") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">↗ Follow-up</span>;
  }

  if (!sessionId) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-500/15 text-zinc-500 border border-zinc-500/20">—</span>;
  }

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => select("closed")}
        disabled={!!saving}
        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
      >
        {saving === "closed" ? "…" : "✓ Closed"}
      </button>
      <button
        type="button"
        onClick={() => select("lost")}
        disabled={!!saving}
        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
      >
        {saving === "lost" ? "…" : "✗ Lost"}
      </button>
      <button
        type="button"
        onClick={() => select("follow_up")}
        disabled={!!saving}
        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
      >
        {saving === "follow_up" ? "…" : "↗ Follow-up"}
      </button>
    </div>
  );
}

function DiscPill({ disc }: { disc: "D" | "I" | "S" | "C" }) {
  const cls: Record<string, string> = {
    D: "bg-red-500/15 text-red-300 border-red-500/25",
    I: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    S: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    C: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border ${cls[disc]}`}>{disc}</span>;
}

// ─── Calls Tab ────────────────────────────────────────────────────────────────

function CallsTab() {
  const { calls, hasReal, loading, updateCallOutcome } = useDashboardData();
  const [search, setSearch]             = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "closed" | "lost" | "follow_up">("all");
  const [sortKey, setSortKey]           = useState<"date" | "score" | "duration">("date");
  const [expandedId, setExpandedId]     = useState<number | null>(null);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
    </div>
  );

  if (!hasReal) return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
      <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
        <Phone className="h-5 w-5 text-zinc-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-300">No calls yet</p>
        <p className="text-xs text-zinc-600 mt-1">Upload a recording or start a Live Call — your history will appear here.</p>
      </div>
    </div>
  );

  const filtered = calls
    .filter(c => outcomeFilter === "all" || c.outcome === outcomeFilter)
    .filter(c =>
      c.prospect.toLowerCase().includes(search.toLowerCase()) ||
      c.product.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortKey === "score")    return b.score - a.score;
      if (sortKey === "duration") return b.durationSec - a.durationSec;
      return b.id - a.id;
    });

  const closedCount  = filtered.filter(c => c.outcome === "closed").length;
  const totalRevenue = filtered.reduce((s, c) => s + (c.revenue ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Call History</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {filtered.length} calls · {closedCount} closed · ${totalRevenue.toLocaleString()} revenue
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <input
              type="text" placeholder="Search prospect or product..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600 w-52"
            />
          </div>
          {(["all", "closed", "lost", "follow_up"] as const).map(f => (
            <button key={f} onClick={() => setOutcomeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${outcomeFilter === f ? "bg-blue-600/20 text-blue-300 border border-blue-500/30" : "text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300"}`}>
              {f === "all" ? "All" : f === "closed" ? "✓ Closed" : f === "lost" ? "✗ Lost" : "↗ Follow-up"}
            </button>
          ))}
          <select value={sortKey} onChange={e => setSortKey(e.target.value as typeof sortKey)}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none">
            <option value="date">Newest first</option>
            <option value="score">Highest score</option>
            <option value="duration">Longest call</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              {["Date", "Prospect", "Product", "Duration", "Score", "DISC", "Obj", "Outcome", ""].map((h, i) => (
                <th key={i} className={`text-left px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider ${i >= 2 && i <= 3 ? "hidden md:table-cell" : ""} ${i === 5 ? "hidden sm:table-cell" : ""} ${i === 6 ? "hidden lg:table-cell" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(call => (
              <React.Fragment key={call.id}>
                <tr onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                  className="border-b border-zinc-800/60 bg-zinc-900 hover:bg-zinc-800/40 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs text-zinc-300">{call.date}</p>
                    <p className="text-[10px] text-zinc-600">{call.time}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-zinc-100">{call.prospect}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400 hidden md:table-cell">{call.product}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400 hidden md:table-cell">{call.duration}</td>
                  <td className="px-4 py-3"><ScoreBadge score={call.score} /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><DiscPill disc={call.disc} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {call.objectionCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[11px] font-semibold">{call.objectionCount}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <OutcomeBadge outcome={call.outcome} sessionId={call.sessionId} onUpdate={updateCallOutcome} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {expandedId === call.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </td>
                </tr>
                {expandedId === call.id && (
                  <tr key={`${call.id}-exp`} className="border-b border-zinc-800 bg-zinc-800/25">
                    <td colSpan={9} className="px-6 py-5">
                      <div className="grid sm:grid-cols-3 gap-6">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Performance</p>
                          <div className="flex items-baseline gap-2 mb-2">
                            <span className={`text-2xl font-bold ${scoreTextColor(call.score)}`}>{call.score}</span>
                            <span className="text-xs text-zinc-600">/ 10</span>
                          </div>
                          <p className="text-xs text-zinc-500">Talk ratio: <span className={call.talkRatio > 45 ? "text-red-400" : call.talkRatio > 40 ? "text-amber-400" : "text-emerald-400"}>{call.talkRatio}% agent</span></p>
                          <p className="text-xs text-zinc-500 mt-1">Focus phase: <span className="text-zinc-300">{call.phase}</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Revenue</p>
                          {call.revenue
                            ? <p className="text-xl font-bold text-emerald-400">${call.revenue.toLocaleString()}</p>
                            : <p className="text-sm text-zinc-600">No deal</p>
                          }
                          <p className="text-xs text-zinc-500 mt-1">{call.product} · {call.duration}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Coaching Note</p>
                          {call.topIssue ? (
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-zinc-300 leading-relaxed">{call.topIssue}</p>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-zinc-300">Clean execution — no critical issues</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

const ANALYTICS_PHASES = [
  { key: "connection",        phase: "Connection",        color: "#10B981" },
  { key: "situation",         phase: "Situation",         color: "#3B82F6" },
  { key: "problemAwareness",  phase: "Problem Awareness", color: "#6366F1" },
  { key: "consequence",       phase: "Consequence",       color: "#EF4444" },
  { key: "solutionAwareness", phase: "Solution",          color: "#8B5CF6" },
  { key: "qualifying",        phase: "Qualifying",        color: "#F59E0B" },
  { key: "close",             phase: "Close",             color: "#10B981" },
];

const DISC_ANALYTICS = [
  { type: "D" as const, label: "Dominant",     color: "#EF4444", desc: "Direct, decisive, wants results" },
  { type: "I" as const, label: "Influential",  color: "#F59E0B", desc: "Social, optimistic, emotionally driven" },
  { type: "S" as const, label: "Steady",       color: "#10B981", desc: "Patient, risk-averse, needs trust" },
  { type: "C" as const, label: "Conscientious",color: "#3B82F6", desc: "Analytical, detail-focused, cautious" },
];

function AnalyticsTab() {
  const { calls, hasReal, loading } = useDashboardData();
  const [range, setRange] = useState<"4w" | "8w">("8w");

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
    </div>
  );

  if (!hasReal) return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
      <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
        <BarChart3 className="h-5 w-5 text-zinc-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-300">No analytics yet</p>
        <p className="text-xs text-zinc-600 mt-1">Upload a call recording or complete a Live Call — charts will populate automatically.</p>
      </div>
    </div>
  );

  const weekCount = range === "4w" ? 4 : 8;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const periodStart = now - (weekCount * weekMs);
  const periodCalls = calls.filter(call => (call.createdAtMs ?? 0) >= periodStart);
  const data = Array.from({ length: weekCount }, (_, idx) => {
    const start = now - ((weekCount - idx) * weekMs);
    const end = start + weekMs;
    const bucketCalls = calls.filter(call => {
      const created = call.createdAtMs ?? 0;
      return created >= start && created < end;
    });
    const scored = bucketCalls.filter(call => call.score > 0);
    return {
      label: `W${idx + 1}`,
      calls: bucketCalls.length,
      closed: bucketCalls.filter(call => call.outcome === "closed").length,
      avgScore: scored.length > 0 ? scored.reduce((sum, call) => sum + call.score, 0) / scored.length : 0,
    };
  });

  const totalCalls = periodCalls.length;
  const totalClose = periodCalls.filter(call => call.outcome === "closed").length;
  const scoredCalls = periodCalls.filter(call => call.score > 0);
  const avgScore = scoredCalls.length > 0
    ? (scoredCalls.reduce((sum, call) => sum + call.score, 0) / scoredCalls.length).toFixed(1)
    : "—";
  const totalObjections = periodCalls.reduce((sum, call) => sum + call.objectionCount, 0);
  const closeRate = totalCalls > 0 ? Math.round((totalClose / totalCalls) * 100) : 0;
  const maxCalls = Math.max(1, ...data.map(w => w.calls));
  const maxWeeklyScore = Math.max(1, ...data.map(w => w.avgScore));

  const phaseScores = ANALYTICS_PHASES.map(phase => {
    const scores = periodCalls
      .map(call => call.nepqScores?.[phase.key])
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
    const avg = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    return { ...phase, score: avg, count: scores.length };
  });
  const weakestPhase = phaseScores
    .filter(phase => phase.score != null)
    .sort((a, b) => (a.score ?? 10) - (b.score ?? 10))[0];

  const objectionCounts = new Map<string, number>();
  for (const call of periodCalls) {
    for (const type of call.objectionTypes ?? []) {
      const label = titleCaseLabel(type || "Other");
      objectionCounts.set(label, (objectionCounts.get(label) ?? 0) + 1);
    }
  }
  const objectionData = Array.from(objectionCounts.entries())
    .map(([type, count], idx) => ({ type, count, color: ["#EF4444", "#8B5CF6", "#F59E0B", "#3B82F6", "#10B981"][idx % 5] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const maxObj = Math.max(1, ...objectionData.map(o => o.count));

  const discCounts = DISC_ANALYTICS.map(item => {
    const count = periodCalls.filter(call => call.disc === item.type).length;
    const pct = totalCalls > 0 ? Math.round((count / totalCalls) * 100) : 0;
    return { ...item, count, pct };
  });

  if (totalCalls === 0) return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Analytics</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Performance trends from saved calls only</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["4w", "8w"] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${range === r ? "bg-blue-600/20 text-blue-300 border border-blue-500/30" : "text-zinc-500 border border-zinc-800 hover:text-zinc-300"}`}>
              {r === "4w" ? "4 Weeks" : "8 Weeks"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900">
        <BarChart3 className="h-5 w-5 text-zinc-600" />
        <div>
          <p className="text-sm font-semibold text-zinc-300">No calls in this range</p>
          <p className="text-xs text-zinc-600 mt-1">Switch ranges or analyze a new call to start fresh analytics.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Analytics</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Performance trends from saved calls only</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["4w", "8w"] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${range === r ? "bg-blue-600/20 text-blue-300 border border-blue-500/30" : "text-zinc-500 border border-zinc-800 hover:text-zinc-300"}`}>
              {r === "4w" ? "4 Weeks" : "8 Weeks"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Calls",    value: totalCalls.toString(),       sub: `${range} period`,           Icon: Phone,        color: "text-blue-400"   },
          { label: "Deals Closed",   value: totalClose.toString(),       sub: `${closeRate}% close rate`,  Icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Objections",     value: totalObjections.toString(),  sub: "caught in calls",          Icon: Target,       color: "text-amber-400"  },
          { label: "Avg Call Score", value: avgScore,                    sub: "call quality",             Icon: Star,         color: "text-purple-400" },
        ].map(({ label, value, sub, Icon, color }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</p>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-zinc-600 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-white mb-4">Weekly Call Volume</p>
          <div className="flex items-end gap-2" style={{ height: 96 }}>
            {data.map(w => (
              <div key={w.label} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-sm bg-blue-600/75 transition-all" style={{ height: `${Math.max((w.calls / maxCalls) * 80, w.calls > 0 ? 4 : 0)}px` }} />
                <span className="text-[9px] text-zinc-600">{w.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-white mb-4">Weekly Avg Score</p>
          <div className="flex items-end gap-2" style={{ height: 96 }}>
            {data.map(w => (
              <div key={w.label} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-sm bg-emerald-600/75 transition-all" style={{ height: `${Math.max((w.avgScore / maxWeeklyScore) * 80, w.avgScore > 0 ? 4 : 0)}px` }} />
                <span className="text-[9px] text-zinc-600">{w.avgScore > 0 ? w.avgScore.toFixed(1) : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-white mb-5">NEPQ Phase Averages</p>
          <div className="space-y-3.5">
            {phaseScores.map(({ phase, score, color, count }) => (
              <div key={phase}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-400">{phase}</span>
                  <span className="text-xs font-bold" style={{ color }}>{score == null ? "—" : score.toFixed(1)}</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${score == null ? 0 : score * 10}%`, backgroundColor: color }} />
                </div>
                {count === 0 && <p className="text-[9px] text-zinc-700 mt-1">No data yet</p>}
              </div>
            ))}
          </div>
          {weakestPhase?.score != null && (
            <p className="text-[10px] text-red-400 mt-4">Weakest phase: {weakestPhase.phase} at {weakestPhase.score.toFixed(1)}</p>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-white mb-5">Objection Frequency</p>
          {objectionData.length === 0 ? (
            <p className="text-xs text-zinc-600">No objections detected yet.</p>
          ) : (
            <div className="space-y-3">
              {objectionData.map(({ type, count, color }) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-28 shrink-0">{type}</span>
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(count / maxObj) * 100}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-xs font-semibold text-zinc-300 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-zinc-600 mt-4">{totalObjections} total objections · {range} period</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-xs font-semibold text-white mb-5">Buyer DISC Distribution</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {discCounts.map(({ type, label, pct, count, color, desc }) => (
            <div key={type} className="text-center">
              <div className="relative w-14 h-14 mx-auto mb-3">
                <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#27272a" strokeWidth="4" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="4"
                    strokeDasharray={`${pct * 0.879} ${100 * 0.879}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-black" style={{ color }}>{type}</span>
              </div>
              <p className="text-base font-bold text-zinc-100">{pct}%</p>
              <p className="text-[11px] text-zinc-400 font-medium">{label}</p>
              <p className="text-[10px] text-zinc-600 mt-1 leading-snug">{count} call{count === 1 ? "" : "s"} · {desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Coaching Tab ─────────────────────────────────────────────────────────────

interface CoachingReportData {
  totalCalls: number;
  nepqPhaseScores: { phase: string; key: string; score: number; color: string }[];
  weakestPhase: string | null;
  avgTalkRatio: number | null;
  avgScore: number | null;
  closeRate: number | null;
  drills: {
    id: number; phase: string; priority: "critical" | "high" | "medium";
    title: string; description: string; questions: string[];
    currentScore: number | null; targetScore: number | null;
    currentTalkRatio: number | null; targetTalkRatio: number | null;
    sessionsTarget: number;
  }[];
  recentMoments: { date: string; prospect: string; score: number; issue: string }[];
  coachingFocus: string | null;
}

interface CoachingWorkspaceState {
  sessions: Record<number, number>;
  notes: Record<number, string>;
  practiced: Record<number, boolean[]>;
  activePrompt: Record<number, number>;
  drafts: Record<number, string>;
}

interface PracticeFeedback {
  score: number;
  what_worked: string;
  what_missed: string;
  ideal_response: string;
}

function CoachingTab() {
  const { hasReal, loading: ctxLoading } = useDashboardData();
  const [report, setReport]   = useState<CoachingReportData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [activeDrill, setActiveDrill] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [practiced, setPracticed] = useState<Record<number, boolean[]>>({});
  const [activePrompt, setActivePrompt] = useState<Record<number, number>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [timerDrill, setTimerDrill] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [feedbackLoading, setFeedbackLoading] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, PracticeFeedback | null>>({});

  async function getFeedback(drill: CoachingReportData["drills"][0], question: string, promptIndex: number) {
    const draft = drafts[drill.id]?.trim();
    if (!draft) return;
    setFeedbackLoading(drill.id);
    setFeedback(prev => ({ ...prev, [drill.id]: null }));
    try {
      const res = await fetch("/api/coaching/practice-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          response: draft,
          phase: drill.phase,
          drillTitle: drill.title,
        }),
      });
      if (res.ok) {
        const data = await res.json() as PracticeFeedback;
        setFeedback(prev => ({ ...prev, [drill.id]: data }));
        // Auto-mark as practiced if score >= 6
        if (data.score >= 6) {
          setPracticed(prev => {
            const next = [...(prev[drill.id] ?? [])];
            next[promptIndex] = true;
            return { ...prev, [drill.id]: next };
          });
        }
      }
    } catch { /* non-fatal */ }
    finally { setFeedbackLoading(null); }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("spear_coaching_workspace_v1");
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<CoachingWorkspaceState>;
      setSessions(saved.sessions ?? {});
      setNotes(saved.notes ?? {});
      setPracticed(saved.practiced ?? {});
      setActivePrompt(saved.activePrompt ?? {});
      setDrafts(saved.drafts ?? {});
    } catch {
      // Ignore corrupt local practice data.
    }
  }, []);

  useEffect(() => {
    const payload: CoachingWorkspaceState = { sessions, notes, practiced, activePrompt, drafts };
    localStorage.setItem("spear_coaching_workspace_v1", JSON.stringify(payload));
  }, [sessions, notes, practiced, activePrompt, drafts]);

  useEffect(() => {
    if (timerDrill == null) return;
    const id = window.setInterval(() => setTimerSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerDrill]);

  useEffect(() => {
    if (!hasReal) return;
    setFetching(true);
    fetch("/api/coaching/report")
      .then(r => r.ok ? r.json() : null)
      .then((data: CoachingReportData | null) => {
        if (data) {
          setReport(data);
          if (data.drills.length > 0) setActiveDrill(data.drills[0].id);
        }
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setFetching(false));
  }, [hasReal]);

  const logSession = (id: number, max: number) =>
    setSessions(p => ({ ...p, [id]: Math.min((p[id] ?? 0) + 1, max) }));

  const togglePracticed = (id: number, index: number) =>
    setPracticed(prev => {
      const next = [...(prev[id] ?? [])];
      next[index] = !next[index];
      return { ...prev, [id]: next };
    });

  const resetDrill = (id: number) => {
    setSessions(prev => ({ ...prev, [id]: 0 }));
    setPracticed(prev => ({ ...prev, [id]: [] }));
    setNotes(prev => ({ ...prev, [id]: "" }));
    setDrafts(prev => ({ ...prev, [id]: "" }));
    if (timerDrill === id) {
      setTimerDrill(null);
      setTimerSeconds(0);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const priorityStyle: Record<string, string> = {
    critical: "text-red-400 border-red-500/30 bg-red-500/10",
    high:     "text-amber-400 border-amber-500/30 bg-amber-500/10",
    medium:   "text-blue-400 border-blue-500/30 bg-blue-500/10",
  };

  if (ctxLoading || fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
    </div>
  );

  if (!hasReal || !report || report.totalCalls === 0) return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
      <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
        <BookOpen className="h-5 w-5 text-zinc-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-300">No coaching data yet</p>
        <p className="text-xs text-zinc-600 mt-1 max-w-xs">Upload a call recording or complete a live call — your personalized AI coaching drills will generate automatically.</p>
      </div>
    </div>
  );

  const phasesWithRealData = report.nepqPhaseScores.filter(p => p.score !== 5.0);
  const weakest = report.weakestPhase;
  const loggedSessions = Object.values(sessions).reduce((sum, value) => sum + value, 0);
  const targetSessions = report.drills.reduce((sum, drill) => sum + drill.sessionsTarget, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Coaching Hub</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Drills generated from your {report.totalCalls} call{report.totalCalls !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">
            {loggedSessions}/{targetSessions} practice sessions
          </span>
          <AIBadge />
        </div>
      </div>

      {/* AI coaching focus */}
      {report.coachingFocus && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/6 px-4 py-3 flex items-start gap-3">
          <Zap className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold mb-0.5">Current Focus</p>
            <p className="text-xs text-zinc-200 leading-relaxed">{report.coachingFocus}</p>
          </div>
        </div>
      )}

      {/* NEPQ skill profile */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-white">Your NEPQ Skill Profile</p>
          {phasesWithRealData.length === 0 && (
            <span className="text-[10px] text-zinc-600">Upload analyzed calls to see real scores</span>
          )}
        </div>
        <div className="flex items-end gap-2" style={{ height: 80 }}>
          {report.nepqPhaseScores.map(({ phase, score, color }) => (
            <div key={phase} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full bg-zinc-800 rounded-sm relative" style={{ height: 64 }}>
                <div className="absolute bottom-0 w-full rounded-sm transition-all duration-700"
                  style={{ height: `${(score / 10) * 64}px`, backgroundColor: color + "bb" }} />
              </div>
              <span className="text-[8px] text-zinc-600 text-center leading-tight hidden sm:block">
                {phase.split(" ")[0]}
              </span>
              <span className="text-[10px] font-bold" style={{ color }}>{score.toFixed(1)}</span>
            </div>
          ))}
        </div>
        {weakest && (
          <p className="text-[10px] text-red-400 mt-3">
            ⚠ Weakest phase: <span className="font-semibold">{weakest}</span> — focus your drills here first
          </p>
        )}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800/60">
          {report.avgTalkRatio != null && (
            <span className="text-[11px] text-zinc-500">
              Avg talk ratio: <span className={`font-semibold ${report.avgTalkRatio > 50 ? "text-red-400" : report.avgTalkRatio > 40 ? "text-amber-400" : "text-emerald-400"}`}>{report.avgTalkRatio}%</span>
              <span className="text-zinc-600 ml-1">(target ≤40%)</span>
            </span>
          )}
          {report.closeRate != null && (
            <span className="text-[11px] text-zinc-500">
              Close rate: <span className="font-semibold text-white">{Math.round(report.closeRate * 100)}%</span>
            </span>
          )}
          {report.avgScore != null && (
            <span className="text-[11px] text-zinc-500">
              Avg score: <span className="font-semibold text-white">{Number(report.avgScore).toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Drill queue */}
      {report.drills.length > 0 && (
        <>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Drills</p>
          <div className="space-y-3">
            {report.drills.map(drill => {
              const done     = sessions[drill.id] ?? 0;
              const isOpen   = activeDrill === drill.id;
              const pct      = done / drill.sessionsTarget;
              const complete = done >= drill.sessionsTarget;

              return (
                <div key={drill.id}
                  className={`rounded-xl border transition-colors ${isOpen ? "border-blue-500/30 bg-zinc-900" : "border-zinc-800 bg-zinc-900"}`}>
                  <div className="p-5 cursor-pointer" onClick={() => setActiveDrill(isOpen ? null : drill.id)}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border capitalize ${priorityStyle[drill.priority]}`}>
                            {drill.priority}
                          </span>
                          <span className="text-[10px] text-zinc-500">{drill.phase}</span>
                        </div>
                        <p className="text-sm font-semibold text-white">{drill.title}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-zinc-500 mb-1.5">{done}/{drill.sessionsTarget} sessions</p>
                        <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct * 100}%` }} />
                        </div>
                        {complete && <p className="text-[10px] text-emerald-400 font-semibold mt-1">✓ Complete</p>}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{drill.description}</p>

                    <div className="flex items-center gap-4 mt-3">
                      {drill.currentScore !== null && (
                        <span className="text-[11px] text-zinc-500">
                          Score: <span className="text-red-400 font-semibold">{drill.currentScore.toFixed(1)}</span>
                          <span className="text-zinc-700 mx-1">→</span>
                          <span className="text-blue-400 font-semibold">{drill.targetScore}</span>
                        </span>
                      )}
                      {drill.currentTalkRatio !== null && (
                        <span className="text-[11px] text-zinc-500">
                          Talk ratio: <span className="text-amber-400 font-semibold">{drill.currentTalkRatio}%</span>
                          <span className="text-zinc-700 mx-1">→</span>
                          <span className="text-blue-400 font-semibold">≤{drill.targetTalkRatio}%</span>
                        </span>
                      )}
                      <ChevronDown className={`h-4 w-4 text-zinc-600 ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-4 border-t border-zinc-800/60">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Practice Lab</p>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300">
                            {timerDrill === drill.id ? formatTimer(timerSeconds) : "0:00"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (timerDrill === drill.id) {
                                setTimerDrill(null);
                              } else {
                                setTimerDrill(drill.id);
                                setTimerSeconds(0);
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                          >
                            {timerDrill === drill.id ? "Pause" : "Start"}
                          </button>
                        </div>
                      </div>
                      {(() => {
                        const promptIndex = activePrompt[drill.id] ?? 0;
                        const question = drill.questions[promptIndex] ?? drill.questions[0];
                        const checked = practiced[drill.id]?.[promptIndex] ?? false;
                        const practicedCount = (practiced[drill.id] ?? []).filter(Boolean).length;

                        return (
                          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 mb-4">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <span className="text-[10px] text-blue-300 uppercase tracking-wider font-semibold">
                                Prompt {promptIndex + 1} of {drill.questions.length}
                              </span>
                              <span className="text-[10px] text-zinc-500">{practicedCount}/{drill.questions.length} practiced</span>
                            </div>
                            <p className="text-sm text-zinc-100 leading-relaxed mb-4">{question}</p>
                            <textarea
                              value={drafts[drill.id] ?? ""}
                              onChange={e => {
                                setDrafts(prev => ({ ...prev, [drill.id]: e.target.value }));
                                setFeedback(prev => ({ ...prev, [drill.id]: null }));
                              }}
                              placeholder="Type your version of the response here..."
                              className="w-full min-h-20 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600"
                            />
                            <button
                              type="button"
                              disabled={!drafts[drill.id]?.trim() || feedbackLoading === drill.id}
                              onClick={() => getFeedback(drill, question, promptIndex)}
                              className="mt-2 w-full py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-semibold hover:bg-blue-600/30 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                            >
                              {feedbackLoading === drill.id
                                ? <><span className="h-3 w-3 rounded-full border border-blue-400 border-t-transparent animate-spin" />Getting feedback...</>
                                : "⚡ Get AI Feedback"}
                            </button>
                            {feedback[drill.id] && (
                              <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Spear Feedback</span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${(feedback[drill.id]!.score ?? 0) >= 7 ? "bg-emerald-500/15 text-emerald-300" : (feedback[drill.id]!.score ?? 0) >= 5 ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>
                                    {feedback[drill.id]!.score}/10
                                  </span>
                                </div>
                                <div className="px-4 py-3 space-y-3">
                                  {feedback[drill.id]!.what_worked && (
                                    <div className="flex gap-2">
                                      <span className="text-emerald-400 text-xs shrink-0">✓</span>
                                      <p className="text-xs text-zinc-300 leading-relaxed">{feedback[drill.id]!.what_worked}</p>
                                    </div>
                                  )}
                                  {feedback[drill.id]!.what_missed && (
                                    <div className="flex gap-2">
                                      <span className="text-red-400 text-xs shrink-0">✗</span>
                                      <p className="text-xs text-zinc-300 leading-relaxed">{feedback[drill.id]!.what_missed}</p>
                                    </div>
                                  )}
                                  {feedback[drill.id]!.ideal_response && (
                                    <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 px-3 py-2.5">
                                      <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold mb-1.5">Use This Instead</p>
                                      <p className="text-xs text-zinc-100 leading-relaxed italic">"{feedback[drill.id]!.ideal_response}"</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2 mt-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActivePrompt(prev => ({ ...prev, [drill.id]: Math.max(promptIndex - 1, 0) }))}
                                  disabled={promptIndex === 0}
                                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                                >
                                  Previous
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActivePrompt(prev => ({ ...prev, [drill.id]: Math.min(promptIndex + 1, drill.questions.length - 1) }))}
                                  disabled={promptIndex >= drill.questions.length - 1}
                                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => togglePracticed(drill.id, promptIndex)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${checked ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700"}`}
                              >
                                {checked ? "Practiced" : "Mark Practiced"}
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">All Techniques</p>
                      <div className="space-y-2.5 mb-4">
                        {drill.questions.map((q, i) => (
                          <div key={i} className="flex items-start gap-3 rounded-lg bg-zinc-800/60 px-4 py-3">
                            <input
                              type="checkbox"
                              checked={practiced[drill.id]?.[i] ?? false}
                              onChange={() => togglePracticed(drill.id, i)}
                              className="mt-0.5 h-3.5 w-3.5 rounded accent-blue-500 shrink-0"
                            />
                            <p className="text-xs text-zinc-200 leading-relaxed">{q}</p>
                          </div>
                        ))}
                      </div>
                      <label className="block mb-4">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Practice Notes</span>
                        <textarea
                          value={notes[drill.id] ?? ""}
                          onChange={e => setNotes(prev => ({ ...prev, [drill.id]: e.target.value }))}
                          placeholder="What felt awkward? What line will you use on the next call?"
                          className="mt-2 w-full min-h-20 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600"
                        />
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => logSession(drill.id, drill.sessionsTarget)}
                          disabled={complete}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-semibold transition-colors"
                        >
                          {complete ? "All Sessions Logged" : "Log Practice Session"}
                        </button>
                        <button
                          type="button"
                          onClick={() => resetDrill(drill.id)}
                          className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold transition-colors"
                        >
                          Reset Drill
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Recent coaching moments from real calls */}
      {report.recentMoments.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-white mb-4">Recent Coaching Moments</p>
          <div className="space-y-3">
            {report.recentMoments.map((moment, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-zinc-800/40 px-4 py-3">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">
                    {moment.date} · {moment.prospect}{moment.score > 0 ? ` · Score ${moment.score.toFixed(1)}` : ""}
                  </p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{moment.issue}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Agents Tab ───────────────────────────────────────────────────────────────

function AgentsTab() {
  const { hasReal, loading } = useDashboardData();
  const [sortKey, setSortKey] = useState<"score" | "closeRate" | "revenue" | "calls">("score");
  const [search, setSearch]   = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
    </div>
  );

  if (!hasReal) return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
      <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
        <Users className="h-5 w-5 text-zinc-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-300">No agent data yet</p>
        <p className="text-xs text-zinc-600 mt-1">Agent leaderboard appears once your team starts logging calls.</p>
      </div>
    </div>
  );

  const sorted = [...MOCK_AGENTS]
    .filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === "score")     return b.avgScore - a.avgScore;
      if (sortKey === "closeRate") return b.closeRate - a.closeRate;
      if (sortKey === "revenue")   return b.revenueMTD - a.revenueMTD;
      return b.callsMonth - a.callsMonth;
    });

  const teamAvgScore  = (MOCK_AGENTS.reduce((s, a) => s + a.avgScore, 0) / MOCK_AGENTS.length).toFixed(1);
  const teamCloseRate = Math.round(MOCK_AGENTS.reduce((s, a) => s + a.closeRate, 0) / MOCK_AGENTS.length);
  const teamRevenue   = MOCK_AGENTS.reduce((s, a) => s + a.revenueMTD, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Agents</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{MOCK_AGENTS.length} agents · Current month</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <input type="text" placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600 w-40" />
          </div>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as typeof sortKey)}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none">
            <option value="score">Score</option>
            <option value="closeRate">Close Rate</option>
            <option value="revenue">Revenue</option>
            <option value="calls">Calls</option>
          </select>
        </div>
      </div>

      {/* Team summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Team Avg Score",    value: teamAvgScore,                       color: "text-indigo-400" },
          { label: "Team Close Rate",   value: `${teamCloseRate}%`,               color: "text-emerald-400" },
          { label: "Team Revenue MTD",  value: `$${(teamRevenue/1000).toFixed(0)}k`, color: "text-amber-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className="text-left px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider w-8">#</th>
              <th className="text-left px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Agent</th>
              <th className="text-left px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider hidden sm:table-cell">Calls</th>
              <th className="text-left px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Score</th>
              <th className="text-left px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider hidden md:table-cell">Close Rate</th>
              <th className="text-left px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider hidden lg:table-cell">Revenue MTD</th>
              <th className="text-left px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider hidden md:table-cell">Trend</th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((agent, rank) => {
              const isMe  = agent.name === "You";
              const isExp = expandedId === agent.id;
              return (
                <>
                  <tr key={agent.id} onClick={() => setExpandedId(isExp ? null : agent.id)}
                    className={`border-b border-zinc-800/60 cursor-pointer transition-colors ${isMe ? "bg-blue-500/5 hover:bg-blue-500/8" : "bg-zinc-900 hover:bg-zinc-800/40"}`}>
                    <td className="px-4 py-3">
                      {rank === 0
                        ? <Award className="h-4 w-4 text-amber-400" />
                        : <span className="text-xs text-zinc-600">{rank + 1}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${isMe ? "bg-blue-600/30 text-blue-300" : "bg-zinc-700 text-zinc-300"}`}>
                          {agent.initials}
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${isMe ? "text-blue-300" : "text-zinc-100"}`}>
                            {agent.name} {isMe && <span className="text-[10px] text-zinc-600">(you)</span>}
                          </p>
                          <p className="text-[10px] text-zinc-600">{agent.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400 hidden sm:table-cell">{agent.callsMonth}</td>
                    <td className="px-4 py-3"><ScoreBadge score={agent.avgScore} /></td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${agent.closeRate}%` }} />
                        </div>
                        <span className="text-xs text-zinc-300 font-medium">{agent.closeRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-zinc-200 hidden lg:table-cell">
                      ${(agent.revenueMTD / 1000).toFixed(0)}k
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {agent.trend === "up"   && <div className="flex items-center gap-1 text-emerald-400 text-xs"><ArrowUp className="h-3 w-3" />{agent.trendPct}%</div>}
                      {agent.trend === "down" && <div className="flex items-center gap-1 text-red-400 text-xs"><ArrowDown className="h-3 w-3" />{agent.trendPct}%</div>}
                      {agent.trend === "flat" && <span className="text-xs text-zinc-600">— flat</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                  </tr>
                  {isExp && (
                    <tr key={`${agent.id}-exp`} className={`border-b border-zinc-800 ${isMe ? "bg-blue-500/3" : "bg-zinc-800/20"}`}>
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {[
                            { label: "Calls / Month",  value: agent.callsMonth.toString(),                 color: "text-zinc-100"    },
                            { label: "Close Rate",     value: `${agent.closeRate}%`,                      color: "text-emerald-400" },
                            { label: "Revenue MTD",    value: `$${agent.revenueMTD.toLocaleString()}`,    color: "text-amber-400"   },
                            { label: "Score Trend",    value: agent.trend === "up" ? `↑ ${agent.trendPct}%` : agent.trend === "down" ? `↓ ${agent.trendPct}%` : "Flat", color: agent.trend === "up" ? "text-emerald-400" : agent.trend === "down" ? "text-red-400" : "text-zinc-400" },
                          ].map(({ label, value, color }) => (
                            <div key={label}>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
                              <p className={`text-base font-bold ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Dashboard tab content (existing analysis flow) ───────────────────────────

function DashboardHome({
  isAnalyzing, analyzeStep, result, error, selectedFileName, isDragging,
  fileInputRef, resultRef, handleFileChange, handleDragOver,
  setIsDragging, handleFile, manualProduct, setManualProduct, manualOutcome, setManualOutcome,
}: {
  isAnalyzing: boolean; analyzeStep: string; result: SpearAnalysis | null;
  error: string | null; selectedFileName: string; isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  resultRef: React.RefObject<HTMLDivElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  setIsDragging: (v: boolean) => void;
  handleFile: (f: File) => void;
  manualProduct: string;
  setManualProduct: (value: string) => void;
  manualOutcome: "unknown" | "closed" | "not_closed" | "follow_up";
  setManualOutcome: (value: "unknown" | "closed" | "not_closed" | "follow_up") => void;
}) {
  const phases = result ? [
    { label: "Connection & Credibility",  ...result.nepqPhases.connection        },
    { label: "Situation Questions",        ...result.nepqPhases.situation         },
    { label: "Problem Awareness",          ...result.nepqPhases.problemAwareness  },
    { label: "Consequence Questions",      ...result.nepqPhases.consequence       },
    { label: "Solution Awareness",         ...result.nepqPhases.solutionAwareness },
    { label: "Qualifying",                 ...result.nepqPhases.qualifying        },
    { label: "Presentation & Close",       ...result.nepqPhases.close            },
  ] : [];
  const nepqAvg = result
    ? (Object.values(result.nepqPhases).reduce((a, p) => a + p.score, 0) / 7).toFixed(1)
    : null;

  const { calls, hasReal, loading, totalCalls, closeRate, avgScore, objectionsCaught, updateCallOutcome } = useDashboardData();
  const recentCalls = hasReal ? calls.slice(0, 4) : [];

  const liveStats = [
    { label: "Total Calls",      value: hasReal ? totalCalls.toString()       : "—",  change: "all time"  },
    { label: "Avg Close Rate",   value: hasReal ? `${closeRate}%`             : "—",  change: "all calls" },
    { label: "Avg Call Score",   value: hasReal ? avgScore                    : "—",  change: "/ 10"      },
    { label: "Objections Caught",value: hasReal ? objectionsCaught.toString() : "—",  change: "all calls" },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {liveStats.map(s => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
            {loading
              ? <div className="mt-2 h-7 w-16 rounded bg-zinc-800 animate-pulse" />
              : <p className="mt-2 text-2xl font-semibold text-white tracking-tight">{s.value}</p>
            }
            <p className="mt-1 text-xs text-zinc-600">{s.change}</p>
          </div>
        ))}
      </div>

      {/* Upload + Recent */}
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-white">Analyze a Call</h2>
            <span className="text-xs text-zinc-600">MP3 · MP4 · M4A · WAV · up to {MAX_CALL_UPLOAD_MB} MB</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Product</span>
              <input
                type="text"
                value={manualProduct}
                onChange={e => setManualProduct(e.target.value)}
                placeholder="e.g. Term Life, IUL, Final Expense"
                disabled={isAnalyzing}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Call Status</span>
              <select
                value={manualOutcome}
                onChange={e => setManualOutcome(e.target.value as "unknown" | "closed" | "not_closed" | "follow_up")}
                disabled={isAnalyzing}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-600 disabled:opacity-60"
              >
                <option value="unknown">Pending / Unknown</option>
                <option value="closed">Closed</option>
                <option value="not_closed">Not Closed</option>
                <option value="follow_up">Follow-up</option>
              </select>
            </label>
          </div>
          <input ref={fileInputRef} type="file" accept=".mp3,.mp4,.m4a,.wav" className="hidden" onChange={handleFileChange} />
          <div
            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors cursor-pointer ${isDragging ? "border-indigo-500 bg-indigo-500/10" : isAnalyzing ? "border-zinc-700 cursor-not-allowed opacity-70" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40"}`}
          >
            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-10 w-10">
                  <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 animate-spin" />
                </div>
                <p className="text-sm font-medium text-indigo-300">{analyzeStep}</p>
                <p className="text-xs text-zinc-600">{selectedFileName}</p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
                  <Upload className="h-5 w-5 text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-200">{selectedFileName || "Drop your call recording here"}</p>
                <p className="mt-1 text-xs text-zinc-600">or click to browse</p>
              </>
            )}
          </div>
          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-white">Recent Calls</h2>
          </div>
          <div className="space-y-2">
            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="space-y-1.5">
                      <div className="h-3 w-24 rounded bg-zinc-800 animate-pulse" />
                      <div className="h-2.5 w-16 rounded bg-zinc-800/60 animate-pulse" />
                    </div>
                    <div className="h-6 w-14 rounded bg-zinc-800 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : recentCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-zinc-600" />
                </div>
                <p className="text-xs text-zinc-600 text-center leading-relaxed">
                  No calls yet.<br />Upload a recording or start a live call.
                </p>
              </div>
            ) : recentCalls.map(call => (
              <div key={call.id} className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
                <div>
                  <p className="text-xs font-medium text-zinc-200">{call.prospect}</p>
                  <p className="text-[10px] text-zinc-600">{call.date} · {call.duration}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreBadge score={call.score} />
                  <OutcomeBadge outcome={call.outcome} sessionId={call.sessionId} onUpdate={updateCallOutcome} />
                </div>
              </div>
            ))
            }
          </div>
        </div>
      </div>

      {/* Analysis report */}
      {result && (
        <div ref={resultRef} className="space-y-5 pt-2">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Spear Coaching Report</h2>
              {result._ftcDisclosure && (
                <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed max-w-xl">{result._ftcDisclosure}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <AIBadge />
              <span className="text-xs text-zinc-600">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col items-center justify-center text-center">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Overall Score</p>
              <div className={`text-4xl font-bold ${scoreTextColor(result.overallScore)}`}>
                {result.overallScore}<span className="text-lg text-zinc-700">/10</span>
              </div>
              <AIBadge className="mt-2" />
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-3">Buyer Type</p>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-sm font-bold ${discBadgeColor(result.discProfile.type)}`}>{result.discProfile.type}</span>
                <Brain className="h-3.5 w-3.5 text-zinc-600" />
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{result.discProfile.description}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-3">Talk Ratio</p>
              <div className="space-y-2 mb-2">
                {[{ label: "Agent", pct: result.talkRatio.agentPct, colored: true }, { label: "Prospect", pct: result.talkRatio.prospectPct, colored: false }].map(({ label, pct, colored }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-500 w-14">{label}</span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colored ? ratioColor(result.talkRatio.status) : "bg-zinc-600"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`font-semibold w-8 text-right ${colored ? ratioTextColor(result.talkRatio.status) : "text-zinc-400"}`}>{pct}%</span>
                  </div>
                ))}
              </div>
              <p className={`text-xs ${ratioTextColor(result.talkRatio.status)}`}>{ratioLabel(result.talkRatio.status)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-white">NEPQ Phase Breakdown</h3>
              <div className="flex items-center gap-3"><AIBadge /><span className="text-xs text-zinc-500">Avg {nepqAvg}/10</span></div>
            </div>
            <div className="space-y-4">
              {phases.map(({ label, score, note }) => (
                <div key={label}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs text-zinc-400 w-44 shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${scoreBarColor(score)}`} style={{ width: `${score * 10}%` }} />
                    </div>
                    <span className={`text-xs font-semibold w-8 text-right ${scoreTextColor(score)}`}>{score}/10</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 ml-44 pl-3 leading-relaxed">{note}</p>
                </div>
              ))}
            </div>
          </div>

          {result.objections.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center gap-2 mb-5">
                <MessageSquare className="h-4 w-4 text-zinc-500" />
                <h3 className="text-sm font-semibold text-white">Objections Detected ({result.objections.length})</h3>
                <AIBadge className="ml-auto" />
              </div>
              <div className="space-y-4">
                {result.objections.map((obj, i) => (
                  <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-4">
                    <div className="flex items-start gap-3 mb-2.5">
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${objectionTypeColor(obj.type)}`}>{obj.type.replace(/_/g, " ")}</span>
                      <p className="text-sm text-zinc-200">&ldquo;{obj.text}&rdquo;</p>
                    </div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-[11px] text-zinc-600">Handled:</span>
                      <span className={`text-[11px] font-medium capitalize ${handlingColor(obj.handling)}`}>{obj.handling}</span>
                    </div>
                    <div className="rounded bg-zinc-900 border border-zinc-700 px-3 py-2.5">
                      <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Ideal NEPQ response</p>
                      <p className="text-xs text-zinc-200 leading-relaxed">&ldquo;{obj.suggestedResponse}&rdquo;</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.discProfile.adjustments.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-4 w-4 text-zinc-500" />
                <h3 className="text-sm font-semibold text-white">DISC Adjustments — {result.discProfile.type} Buyer</h3>
                <AIBadge className="ml-auto" />
              </div>
              <div className="space-y-2.5">
                {result.discProfile.adjustments.map((adj, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${discDotColor(result.discProfile.type)}`} />
                    <p className="text-sm text-zinc-300">{adj}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Top 3 Strengths</h3>
                <AIBadge className="ml-auto" />
              </div>
              <div className="space-y-3">
                {result.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-emerald-400">{i + 1}</span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{s}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Top 3 Improvements</h3>
                <AIBadge className="ml-auto" />
              </div>
              <div className="space-y-5">
                {result.improvements.map((imp, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider">What happened</p>
                    <p className="text-xs text-zinc-300 mb-1.5">{imp.what}</p>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Why it hurt</p>
                    <p className="text-xs text-zinc-400 mb-1.5">{imp.why}</p>
                    <div className="rounded bg-zinc-800 border border-zinc-700 px-3 py-2">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Instead say</p>
                      <p className="text-xs text-indigo-300">&ldquo;{imp.instead}&rdquo;</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-3">Mindset Note</p>
              <p className="text-sm text-zinc-200 leading-relaxed italic">&ldquo;{result.mindsetNote}&rdquo;</p>
            </div>
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-6">
              <p className="text-[11px] text-indigo-400 uppercase tracking-wider mb-3">Next Call Focus</p>
              <p className="text-sm text-white leading-relaxed font-medium">{result.nextCallFocus}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Spear uses AI to analyze call recordings. Prospects are informed of recording per applicable state law.
              This report was generated by artificial intelligence and is intended for internal coaching use only.
              It does not constitute legal, financial, or insurance advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "dashboard" | "calls" | "analytics" | "coaching" | "agents";

function DashboardPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  // Welcome modal — shown once after successful Stripe checkout
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (searchParams.get("welcome") === "true") {
      const alreadySeen = sessionStorage.getItem("spear_welcome_seen");
      if (!alreadySeen) {
        setShowWelcome(true);
        sessionStorage.setItem("spear_welcome_seen", "1");
      }
    }
  }, [searchParams]);

  // ── Real data ──────────────────────────────────────────────────────────────
  const [userId, setUserId]         = useState<string | null>(null);
  const [realCalls, setRealCalls]   = useState<CallRecord[]>([]);
  const [dashStats, setDashStats]   = useState({ totalCalls: 0, closeRate: 0, avgScore: "—", objectionsCaught: 0 });
  const [dataLoading, setDataLoading] = useState(true);

  const refreshCalls = useCallback(() => {
    Promise.all([
      fetch("/api/calls/list").then(r => r.json()),
      fetch("/api/dashboard/stats").then(r => r.json()),
    ]).then(([callsData, statsData]) => {
      if (Array.isArray(callsData.calls) && callsData.calls.length > 0) {
        setRealCalls((callsData.calls as RawCallSession[]).map(sessionToRecord));
      }
      setDashStats(statsData);
    }).catch(console.error).finally(() => setDataLoading(false));
  }, []);

  const updateCallOutcome = useCallback((sessionId: string, outcome: "closed" | "lost" | "follow_up" | "pending") => {
    setRealCalls(prev => prev.map(c => c.sessionId === sessionId ? { ...c, outcome } : c));
    fetch("/api/dashboard/stats")
      .then(r => r.json())
      .then(setDashStats)
      .catch(console.error);
  }, []);

  useEffect(() => {
    // Get real user ID (used when uploading calls)
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    refreshCalls();
  }, [refreshCalls]);

  const dashboardCtxValue: DashboardData = {
    userId,
    calls:     realCalls.length > 0 ? realCalls : MOCK_CALLS,
    hasReal:   realCalls.length > 0,
    loading:   dataLoading,
    totalCalls:       dashStats.totalCalls,
    closeRate:        dashStats.closeRate,
    avgScore:         dashStats.avgScore,
    objectionsCaught: dashStats.objectionsCaught,
    updateCallOutcome,
  };

  // ── Analysis state ─────────────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing]         = useState(false);
  const [analyzeStep, setAnalyzeStep]         = useState("");
  const [result, setResult]                   = useState<SpearAnalysis | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [manualProduct, setManualProduct]     = useState("");
  const [manualOutcome, setManualOutcome]     = useState<"unknown" | "closed" | "not_closed" | "follow_up">("unknown");
  const [isDragging, setIsDragging]           = useState(false);

  // Compliance gate
  const [pendingFile, setPendingFile]         = useState<File | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const sessionIdRef = useRef(`session-${Date.now()}`);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultRef    = useRef<HTMLDivElement | null>(null);

  const proceedWithAnalysis = useCallback(async (file: File) => {
    setSelectedFileName(file.name);
    setResult(null);
    setError(null);
    setIsAnalyzing(true);
    try {
      if (file.size > MAX_CALL_UPLOAD_BYTES) {
        throw new Error(`Call recordings can be up to ${MAX_CALL_UPLOAD_MB} MB.`);
      }

      // ── Step 1: get R2 presigned URLs ────────────────────────────────────
      // The browser will PUT the file DIRECTLY to Cloudflare R2 — Vercel is
      // never in the upload path, so its 4.5 MB body limit doesn't apply.
      setAnalyzeStep("Uploading recording...");

      // Step 1a — get presigned R2 URLs from our server
      let presignData: { putUrl?: string; getUrl?: string } = {};
      try {
        const presignRes = await fetch("/api/upload-audio/presign-r2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: file.type || "application/octet-stream",
            fileName: file.name,
          }),
        });
        if (!presignRes.ok) {
          const body = await presignRes.text();
          throw new Error(`Presign ${presignRes.status}: ${body.slice(0, 120)}`);
        }
        presignData = await presignRes.json();
      } catch (e) {
        throw new Error(`Step 1 (presign): ${e instanceof Error ? e.message : String(e)}`);
      }

      const { putUrl, getUrl } = presignData;
      if (!putUrl || !getUrl) throw new Error("Presign returned no URLs — check R2 env vars.");

      // Step 1b — browser PUTs directly to R2 (Vercel not involved)
      // "Failed to fetch" here almost always means R2 CORS isn't allowing this origin.
      // Debug info: log the putUrl domain so it's visible in the console.
      try {
        const putDomain = (() => { try { return new URL(putUrl).hostname; } catch { return "?"; } })();
        console.log(`[upload] PUT to R2 domain: ${putDomain}`);

        const putRes = await fetch(putUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) {
          const body = await putRes.text();
          throw new Error(`R2 PUT ${putRes.status}: ${body.slice(0, 200)}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // "Failed to fetch" = network/CORS error — give a clear hint
        const hint = msg.includes("fetch") ? " (CORS or network — check R2 CORS config at spearai.live/api/upload-audio/fix-r2-cors)" : "";
        throw new Error(`Step 2 (R2 upload): ${msg}${hint}`);
      }

      setTimeout(() => setAnalyzeStep("Transcribing call..."), 500);
      setTimeout(() => setAnalyzeStep("Generating Spear report..."), 8000);

      // ── Step 3: trigger analysis ──────────────────────────────────────
      // Pass the R2 presigned GET URL — AssemblyAI downloads directly from R2.
      const res = await fetch("/api/analyze-call", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          audioUrl: getUrl,
          sessionId: sessionIdRef.current,
          agentId: userId ?? undefined,
          productName: manualProduct.trim() || undefined,
          outcome: manualOutcome,
        }),
      });

      if (!res.ok) {
        let errMsg = "Analysis failed";
        try { const b = await res.json(); errMsg = b.error ?? errMsg; } catch { /* ignore */ }
        throw new Error(errMsg);
      }
      const data = (await res.json()) as SpearAnalysis;
      setResult(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      refreshCalls();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStep("");
    }
  }, [userId, refreshCalls, manualProduct, manualOutcome]); // userId kept for agentId passthrough to GHL sync

  const handleFile = useCallback((file: File) => {
    sessionIdRef.current = `session-${Date.now()}`;
    if (file.size > MAX_CALL_UPLOAD_BYTES) {
      setSelectedFileName(file.name);
      setError(`Call recordings can be up to ${MAX_CALL_UPLOAD_MB} MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPendingFile(file);
    setShowConsentModal(true);
  }, []);

  const handleConsentConfirm = useCallback(() => {
    setShowConsentModal(false);
    if (pendingFile) { proceedWithAnalysis(pendingFile); setPendingFile(null); }
  }, [pendingFile, proceedWithAnalysis]);

  const handleConsentCancel = useCallback(() => {
    setShowConsentModal(false);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };

  const consentReq = getConsentRequirement(null);

  const { hasFeature } = useSubscription();

  const NAV: { id: Tab; label: string; Icon: React.ElementType; feature: Feature }[] = [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard, feature: "call_upload"  },
    { id: "calls",     label: "Calls",     Icon: Phone,           feature: "call_history" },
    { id: "analytics", label: "Analytics", Icon: BarChart3,       feature: "analytics"    },
    { id: "coaching",  label: "Coaching",  Icon: BookOpen,        feature: "coaching_hub" },
    { id: "agents",    label: "Agents",    Icon: Users,           feature: "agents_tab"   },
  ];

  const tabTitle: Record<Tab, string> = {
    dashboard: "Dashboard", calls: "Calls", analytics: "Analytics",
    coaching: "Coaching Hub", agents: "Agents",
  };

  return (
    <DashboardDataCtx.Provider value={dashboardCtxValue}>
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
      <RegulatoryBanner />

      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {showConsentModal && (
        <ConsentModal consentReq={consentReq} sessionId={sessionIdRef.current}
          onConfirm={handleConsentConfirm} onCancel={handleConsentCancel} />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-zinc-800 bg-zinc-900/50 overflow-y-auto">
          <div className="px-5 py-4 border-b border-zinc-800">
            <span style={{ fontSize: "22px", fontWeight: 800, color: "#B8A878", letterSpacing: "-0.5px", fontFamily: "var(--font-space), system-ui, sans-serif" }}>SPEAR</span>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {/* Live Call CTA */}
            <Link href="/dashboard/live-call"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 mb-3 text-sm font-semibold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors">
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                <span className="absolute h-3 w-3 rounded-full bg-emerald-400 opacity-40 animate-ping" />
                <Radio className="h-4 w-4 relative" />
              </span>
              Live Call
            </Link>

            {NAV.map(({ id, label, Icon, feature }) => {
              const locked = !hasFeature(feature);
              return (
                <button key={id} type="button" onClick={() => setActiveTab(id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeTab === id
                      ? "bg-blue-600/15 text-blue-300 border border-blue-500/20"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 border border-transparent"
                  }`}>
                  {locked ? <Lock className="h-4 w-4 shrink-0 text-zinc-600" /> : <Icon className="h-4 w-4 shrink-0" />}
                  {label}
                  {locked && <PlanBadge plan={FEATURE_MIN_PLAN[feature]} />}
                </button>
              );
            })}
          </nav>

          <div className="px-3 pb-3">
            <ComplianceStatus />
          </div>

          <div className="px-3 py-4 border-t border-zinc-800 space-y-0.5">
            <Link href="/settings/privacy"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors border border-transparent">
              <Settings className="h-4 w-4 shrink-0" />
              Privacy &amp; Data
            </Link>
            <form action={logout}>
              <button type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
                <LogOut className="h-4 w-4 shrink-0" />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div>
                <h1 className="text-xl font-semibold text-white">{tabTitle[activeTab]}</h1>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
              {process.env.NEXT_PUBLIC_BYPASS_AUTH === "true" && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Demo Mode</span>
              )}
            </div>

            {/* Mobile tab bar */}
            <div className="flex lg:hidden gap-1 mb-6 overflow-x-auto pb-1">
              {NAV.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${activeTab === id ? "bg-blue-600/20 text-blue-300 border border-blue-500/30" : "text-zinc-500 border border-zinc-800"}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            {/* Tab content — each wrapped in its feature gate */}
            {activeTab === "dashboard"  && (
              <FeatureGate feature="call_upload">
                <DashboardHome
                  isAnalyzing={isAnalyzing}
                  analyzeStep={analyzeStep}
                  result={result}
                  error={error}
                  selectedFileName={selectedFileName}
                  isDragging={isDragging}
                  fileInputRef={fileInputRef}
                  resultRef={resultRef}
                  handleFileChange={handleFileChange}
                  handleDragOver={handleDragOver}
                  setIsDragging={setIsDragging}
                  handleFile={handleFile}
                  manualProduct={manualProduct}
                  setManualProduct={setManualProduct}
                  manualOutcome={manualOutcome}
                  setManualOutcome={setManualOutcome}
                />
              </FeatureGate>
            )}
            {activeTab === "calls"      && (
              <FeatureGate feature="call_history">
                <CallsTab />
              </FeatureGate>
            )}
            {activeTab === "analytics"  && (
              <FeatureGate feature="analytics">
                <AnalyticsTab />
              </FeatureGate>
            )}
            {activeTab === "coaching"   && (
              <FeatureGate feature="coaching_hub">
                <CoachingTab />
              </FeatureGate>
            )}
            {activeTab === "agents"     && (
              <FeatureGate feature="agents_tab">
                <AgentsTab />
              </FeatureGate>
            )}
          </div>
        </main>
      </div>
    </div>
    </DashboardDataCtx.Provider>
  );
}

export default function DashboardPageWithSearchParams() {
  return (
    <Suspense fallback={null}>
      <DashboardPage />
    </Suspense>
  );
}
