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
  id: number; date: string; time: string; prospect: string;
  duration: string; durationSec: number; score: number;
  disc: "D" | "I" | "S" | "C"; objectionCount: number;
  phase: string; outcome: "closed" | "lost" | "pending";
  revenue: number | null; product: string; topIssue: string | null;
  talkRatio: number;
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

const WEEKLY_DATA = [
  { label: "W1", calls: 8,  closed: 3, revenue: 41200, avgScore: 7.1 },
  { label: "W2", calls: 11, closed: 4, revenue: 56800, avgScore: 7.4 },
  { label: "W3", calls: 9,  closed: 3, revenue: 38900, avgScore: 7.2 },
  { label: "W4", calls: 13, closed: 5, revenue: 72400, avgScore: 7.9 },
  { label: "W5", calls: 10, closed: 4, revenue: 58100, avgScore: 8.1 },
  { label: "W6", calls: 14, closed: 6, revenue: 89300, avgScore: 8.3 },
  { label: "W7", calls: 11, closed: 4, revenue: 61400, avgScore: 8.0 },
  { label: "W8", calls: 12, closed: 5, revenue: 76200, avgScore: 8.2 },
];

const NEPQ_PHASE_DATA = [
  { phase: "Connection",        score: 8.4, color: "#10B981" },
  { phase: "Situation",         score: 7.1, color: "#3B82F6" },
  { phase: "Problem Awareness", score: 7.8, color: "#8B5CF6" },
  { phase: "Consequence",       score: 5.9, color: "#EF4444" },
  { phase: "Solution",          score: 7.2, color: "#F59E0B" },
  { phase: "Qualifying",        score: 7.6, color: "#06B6D4" },
  { phase: "Close",             score: 8.1, color: "#10B981" },
];

const OBJECTION_DATA = [
  { type: "Price",           count: 42, color: "#EF4444" },
  { type: "Think About It",  count: 38, color: "#F59E0B" },
  { type: "Spouse",          count: 29, color: "#8B5CF6" },
  { type: "Timing",          count: 24, color: "#3B82F6" },
  { type: "Already Covered", count: 18, color: "#6B7280" },
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
}

interface DashboardData {
  userId:    string | null;
  calls:     CallRecord[];
  hasReal:   boolean;   // true once we have at least 1 real call
  loading:   boolean;
  totalCalls: number; closeRate: number; avgScore: string; objectionsCaught: number;
}

const DashboardDataCtx = createContext<DashboardData>({
  userId: null, calls: MOCK_CALLS, hasReal: false, loading: true,
  totalCalls: 0, closeRate: 0, avgScore: "—", objectionsCaught: 0,
});

function useDashboardData() { return useContext(DashboardDataCtx); }

function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function sessionToRecord(s: RawCallSession, i: number): CallRecord {
  const dt = new Date(s.created_at);
  const phaseMap: Record<string, string> = {
    connection: "Connection", situation: "Situation",
    problemAwareness: "Problem Awareness", consequence: "Consequence",
    solutionAwareness: "Solution Awareness", qualifying: "Qualifying", close: "Close",
  };
  const phases = s.nepq_phases_completed ?? {};
  let lastPhase = "Connection";
  for (const key of Object.keys(phaseMap)) {
    if ((phases[key] as { score?: number } | undefined)?.score != null) lastPhase = phaseMap[key];
  }
  const outcome = s.outcome === "closed" ? "closed" : s.outcome === "not_closed" ? "lost" : "pending";
  return {
    id: i + 1,
    date: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    prospect: s.prospect_name ?? `Call ${i + 1}`,
    duration: fmtSec(s.duration_seconds ?? 0),
    durationSec: s.duration_seconds ?? 0,
    score: s.overall_score ?? 0,
    disc: (s.disc_profile_detected as "D" | "I" | "S" | "C") ?? "S",
    objectionCount: (s.objections_raised as unknown[])?.length ?? 0,
    phase: lastPhase, outcome, revenue: null, product: "Call Recording",
    topIssue: s.notes ?? null,
    talkRatio: Math.round(s.talk_ratio_agent ?? 50),
  };
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  let cls = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (score < 7) cls = "bg-amber-500/20 text-amber-300 border-amber-500/30";
  if (score < 6) cls = "bg-red-500/20 text-red-300 border-red-500/30";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${cls}`}>{score.toFixed(1)}</span>;
}

function OutcomeBadge({ outcome }: { outcome: "closed" | "lost" | "pending" }) {
  if (outcome === "closed") return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ Closed</span>;
  if (outcome === "lost")   return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20">✗ Lost</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">⋯ Pending</span>;
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
  const { calls, hasReal, loading } = useDashboardData();
  const [search, setSearch]             = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "closed" | "lost">("all");
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
          {(["all", "closed", "lost"] as const).map(f => (
            <button key={f} onClick={() => setOutcomeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${outcomeFilter === f ? "bg-blue-600/20 text-blue-300 border border-blue-500/30" : "text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300"}`}>
              {f === "all" ? "All" : f === "closed" ? "✓ Closed" : "✗ Lost"}
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
                  <td className="px-4 py-3"><OutcomeBadge outcome={call.outcome} /></td>
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

  const data = range === "4w" ? WEEKLY_DATA.slice(-4) : WEEKLY_DATA;
  const maxCalls   = Math.max(...data.map(w => w.calls));
  const maxRev     = Math.max(...data.map(w => w.revenue));
  const totalRev   = data.reduce((s, w) => s + w.revenue, 0);
  const totalClose = data.reduce((s, w) => s + w.closed, 0);
  const totalCalls = data.reduce((s, w) => s + w.calls, 0);
  const avgScore   = (data.reduce((s, w) => s + w.avgScore, 0) / data.length).toFixed(1);
  const maxObj     = Math.max(...OBJECTION_DATA.map(o => o.count));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Analytics</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Performance trends and insights</p>
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Calls",    value: totalCalls.toString(),                    sub: `${range} period`,        Icon: Phone,      color: "text-blue-400"   },
          { label: "Deals Closed",   value: totalClose.toString(),                    sub: `${Math.round((totalClose/totalCalls)*100)}% close rate`, Icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Revenue",        value: `$${(totalRev/1000).toFixed(0)}k`,        sub: "total influenced",       Icon: TrendingUp, color: "text-amber-400"  },
          { label: "Avg Call Score", value: avgScore,                                 sub: "call quality",           Icon: Star,       color: "text-purple-400" },
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

      {/* Bar charts */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-white mb-4">Weekly Call Volume</p>
          <div className="flex items-end gap-2" style={{ height: 96 }}>
            {data.map(w => (
              <div key={w.label} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-sm bg-blue-600/75 transition-all" style={{ height: `${Math.max((w.calls / maxCalls) * 80, 4)}px` }} />
                <span className="text-[9px] text-zinc-600">{w.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-white mb-4">Weekly Revenue</p>
          <div className="flex items-end gap-2" style={{ height: 96 }}>
            {data.map(w => (
              <div key={w.label} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-sm bg-emerald-600/75 transition-all" style={{ height: `${Math.max((w.revenue / maxRev) * 80, 4)}px` }} />
                <span className="text-[9px] text-zinc-600">{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NEPQ + Objections */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-white mb-5">NEPQ Phase Averages</p>
          <div className="space-y-3.5">
            {NEPQ_PHASE_DATA.map(({ phase, score, color }) => (
              <div key={phase}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-400">{phase}</span>
                  <span className="text-xs font-bold" style={{ color }}>{score}</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${score * 10}%`, backgroundColor: color }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-red-400 mt-4">⚠ Consequence Questions at 5.9 — your biggest growth lever</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-white mb-5">Objection Frequency</p>
          <div className="space-y-3">
            {OBJECTION_DATA.map(({ type, count, color }) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-28 shrink-0">{type}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(count / maxObj) * 100}%`, backgroundColor: color }} />
                </div>
                <span className="text-xs font-semibold text-zinc-300 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-4">{MOCK_CALLS.reduce((s, c) => s + c.objectionCount, 0)} total objections · last 30 days</p>
        </div>
      </div>

      {/* DISC distribution */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-xs font-semibold text-white mb-5">Buyer DISC Distribution</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { type: "D", label: "Dominant",        pct: 22, color: "#EF4444", desc: "Direct, decisive, wants results" },
            { type: "I", label: "Influential",      pct: 31, color: "#F59E0B", desc: "Social, optimistic, emotionally driven" },
            { type: "S", label: "Steady",           pct: 34, color: "#10B981", desc: "Patient, risk-averse, needs trust" },
            { type: "C", label: "Conscientious",    pct: 13, color: "#3B82F6", desc: "Analytical, detail-focused, cautious" },
          ].map(({ type, label, pct, color, desc }) => (
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
              <p className="text-[10px] text-zinc-600 mt-1 leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Coaching Tab ─────────────────────────────────────────────────────────────

function CoachingTab() {
  const { hasReal, loading } = useDashboardData();
  const [activeDrill, setActiveDrill] = useState<number | null>(1);
  const [sessions, setSessions] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 2 });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
    </div>
  );

  if (!hasReal) return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
      <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
        <BookOpen className="h-5 w-5 text-zinc-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-300">No coaching data yet</p>
        <p className="text-xs text-zinc-600 mt-1">AI drills generate automatically after your first few calls — each one targets your specific weak points.</p>
      </div>
    </div>
  );

  const logSession = (id: number, max: number) =>
    setSessions(p => ({ ...p, [id]: Math.min((p[id] ?? 0) + 1, max) }));

  const priorityStyle: Record<string, string> = {
    critical: "text-red-400 border-red-500/30 bg-red-500/10",
    high:     "text-amber-400 border-amber-500/30 bg-amber-500/10",
    medium:   "text-blue-400 border-blue-500/30 bg-blue-500/10",
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">Coaching Hub</h2>
        <p className="text-xs text-zinc-500 mt-0.5">AI-generated drills built from your actual call data</p>
      </div>

      {/* Skill profile */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-white">Your NEPQ Skill Profile</p>
          <AIBadge />
        </div>
        <div className="flex items-end gap-2" style={{ height: 80 }}>
          {NEPQ_PHASE_DATA.map(({ phase, score, color }) => (
            <div key={phase} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full bg-zinc-800 rounded-sm relative" style={{ height: 64 }}>
                <div className="absolute bottom-0 w-full rounded-sm"
                  style={{ height: `${(score / 10) * 64}px`, backgroundColor: color + "bb" }} />
              </div>
              <span className="text-[8px] text-zinc-600 text-center leading-tight hidden sm:block">{phase.split(" ")[0]}</span>
              <span className="text-[10px] font-bold" style={{ color }}>{score}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-red-400 mt-3">
          ⚠ Weakest phase: <span className="font-semibold">Consequence (5.9)</span> — this is costing you deals
        </p>
      </div>

      {/* Drill queue */}
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Drills</p>
      <div className="space-y-3">
        {COACHING_DRILLS.map(drill => {
          const done    = sessions[drill.id] ?? drill.sessionsCompleted;
          const isOpen  = activeDrill === drill.id;
          const pct     = done / drill.sessionsTarget;
          const complete = done >= drill.sessionsTarget;

          return (
            <div key={drill.id}
              className={`rounded-xl border transition-colors ${isOpen ? "border-blue-500/30 bg-zinc-900" : "border-zinc-800 bg-zinc-900"}`}>
              <div className="p-5 cursor-pointer" onClick={() => setActiveDrill(isOpen ? null : drill.id)}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border capitalize ${priorityStyle[drill.priority]}`}>{drill.priority}</span>
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

                {/* Score / ratio targets */}
                <div className="flex items-center gap-4 mt-3">
                  {drill.currentScore !== null && (
                    <span className="text-[11px] text-zinc-500">
                      Score: <span className="text-red-400 font-semibold">{drill.currentScore}</span>
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
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Practice Techniques</p>
                  <div className="space-y-2.5 mb-4">
                    {drill.questions.map((q, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg bg-zinc-800/60 px-4 py-3">
                        <span className="text-[10px] font-bold text-blue-400 mt-0.5 shrink-0">{i + 1}.</span>
                        <p className="text-xs text-zinc-200 leading-relaxed">{q}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => logSession(drill.id, drill.sessionsTarget)}
                    disabled={complete}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-semibold transition-colors"
                  >
                    {complete ? "✓ All sessions logged" : "Log Practice Session"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent coaching moments */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-xs font-semibold text-white mb-4">Recent Coaching Moments</p>
        <div className="space-y-3">
          {MOCK_CALLS.filter(c => c.topIssue).slice(0, 4).map(call => (
            <div key={call.id} className="flex items-start gap-3 rounded-lg bg-zinc-800/40 px-4 py-3">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-zinc-500 mb-0.5">{call.date} · {call.prospect} · Score {call.score}</p>
                <p className="text-xs text-zinc-300 leading-relaxed">{call.topIssue}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
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
  setIsDragging, handleFile,
}: {
  isAnalyzing: boolean; analyzeStep: string; result: SpearAnalysis | null;
  error: string | null; selectedFileName: string; isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  resultRef: React.RefObject<HTMLDivElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  setIsDragging: (v: boolean) => void;
  handleFile: (f: File) => void;
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

  const { calls, hasReal, totalCalls, closeRate, avgScore, objectionsCaught } = useDashboardData();
  const recentCalls = hasReal ? calls.slice(0, 4) : MOCK_CALLS.slice(0, 4);

  const liveStats = hasReal
    ? [
        { label: "Total Calls",          value: totalCalls.toString(),      change: "all time" },
        { label: "Avg Close Rate",        value: `${closeRate}%`,            change: "all calls" },
        { label: "Avg Call Score",        value: avgScore,                   change: "/ 10" },
        { label: "Objections Caught",     value: objectionsCaught.toString(), change: "all calls" },
      ]
    : DASHBOARD_STATS;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {liveStats.map(s => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white tracking-tight">{s.value}</p>
            <p className="mt-1 text-xs text-zinc-500 flex items-center gap-1">
              {hasReal ? s.change : <><TrendingUp className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">{s.change}</span></>}
            </p>
          </div>
        ))}
      </div>

      {/* Upload + Recent */}
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-white">Analyze a Call</h2>
            <span className="text-xs text-zinc-600">MP3 · MP4 · M4A · WAV</span>
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
            {!hasReal && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Demo</span>}
          </div>
          <div className="space-y-2">
            {recentCalls.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-8">No calls yet — upload a recording to get started.</p>
            ) : recentCalls.map(call => (
              <div key={call.id} className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
                <div>
                  <p className="text-xs font-medium text-zinc-200">{call.prospect}</p>
                  <p className="text-[10px] text-zinc-600">{call.date} · {call.duration}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreBadge score={call.score} />
                  <OutcomeBadge outcome={call.outcome} />
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

  useEffect(() => {
    // Get real user ID (used when uploading calls)
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });

    // Fetch real calls + stats
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

  const dashboardCtxValue: DashboardData = {
    userId,
    calls:     realCalls.length > 0 ? realCalls : MOCK_CALLS,
    hasReal:   realCalls.length > 0,
    loading:   dataLoading,
    totalCalls:       dashStats.totalCalls,
    closeRate:        dashStats.closeRate,
    avgScore:         dashStats.avgScore,
    objectionsCaught: dashStats.objectionsCaught,
  };

  // ── Analysis state ─────────────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing]         = useState(false);
  const [analyzeStep, setAnalyzeStep]         = useState("");
  const [result, setResult]                   = useState<SpearAnalysis | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
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
    setAnalyzeStep("Uploading recording...");
    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("sessionId", sessionIdRef.current);
      if (userId) formData.append("agentId", userId);
      setTimeout(() => setAnalyzeStep("Transcribing call..."), 2000);
      setTimeout(() => setAnalyzeStep("Generating Spear report..."), 8000);
      const res = await fetch("/api/analyze-call", { method: "POST", body: formData });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? "Analysis failed"); }
      const data = (await res.json()) as SpearAnalysis;
      setResult(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStep("");
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    sessionIdRef.current = `session-${Date.now()}`;
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
                <DashboardHome isAnalyzing={isAnalyzing} analyzeStep={analyzeStep} result={result} error={error} selectedFileName={selectedFileName} isDragging={isDragging} fileInputRef={fileInputRef} resultRef={resultRef} handleFileChange={handleFileChange} handleDragOver={handleDragOver} setIsDragging={setIsDragging} handleFile={handleFile} />
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
