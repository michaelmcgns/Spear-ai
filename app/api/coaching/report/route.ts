import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NepqPhaseScore {
  phase: string;
  key: string;
  score: number;
  color: string;
}

export interface CoachingDrill {
  id: number;
  phase: string;
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  questions: string[];
  currentScore: number | null;
  targetScore: number | null;
  currentTalkRatio: number | null;
  targetTalkRatio: number | null;
  sessionsTarget: number;
}

export interface CoachingMoment {
  date: string;
  prospect: string;
  score: number;
  issue: string;
}

export interface CoachingReport {
  totalCalls: number;
  nepqPhaseScores: NepqPhaseScore[];
  weakestPhase: string | null;
  avgTalkRatio: number | null;
  avgScore: number | null;
  closeRate: number | null;
  drills: CoachingDrill[];
  recentMoments: CoachingMoment[];
  coachingFocus: string | null;
}

// ─── NEPQ phase config ────────────────────────────────────────────────────────

const PHASE_CONFIG: { key: string; label: string; color: string }[] = [
  { key: "connection",        label: "Connection",        color: "#10B981" },
  { key: "situation",         label: "Situation",         color: "#3B82F6" },
  { key: "problemAwareness",  label: "Problem Awareness", color: "#8B5CF6" },
  { key: "consequence",       label: "Consequence",       color: "#EF4444" },
  { key: "solutionAwareness", label: "Solution",          color: "#F59E0B" },
  { key: "qualifying",        label: "Qualifying",        color: "#06B6D4" },
  { key: "close",             label: "Close",             color: "#10B981" },
];

// ─── Drill library keyed by what's weak ──────────────────────────────────────

function buildDrills(
  weakPhases: string[],
  avgTalkRatio: number | null,
  closeRate: number | null,
  phaseScores: Record<string, number>,
): CoachingDrill[] {
  const drills: CoachingDrill[] = [];
  let id = 1;

  // Consequence — most impactful, always check first
  if (weakPhases.includes("consequence") || (phaseScores.consequence != null && phaseScores.consequence < 6.5)) {
    drills.push({
      id: id++, phase: "Consequence Questions", priority: "critical",
      title: "The Cost of Inaction Drill",
      description: `Your consequence phase is scoring ${phaseScores.consequence?.toFixed(1) ?? "low"} — this is the phase that converts prospects into buyers. They need to feel the weight of NOT solving this problem. Practice until these questions are automatic.`,
      questions: [
        '"If this situation doesn\'t change, what does that look like for your family 5 years from now?"',
        '"What\'s the real cost — financially and emotionally — of leaving this unresolved?"',
        '"If something happened to you this month, how long could your family maintain their lifestyle without your income?"',
        '"Who else in your household is directly affected if nothing changes here?"',
      ],
      currentScore: phaseScores.consequence ?? null, targetScore: 8.0,
      currentTalkRatio: null, targetTalkRatio: null,
      sessionsTarget: 5,
    });
  }

  // Talk ratio
  if (avgTalkRatio != null && avgTalkRatio > 40) {
    drills.push({
      id: id++, phase: "Talk Ratio", priority: avgTalkRatio > 50 ? "critical" : "high",
      title: "Shut Up and Ask Drill",
      description: `Your average talk ratio is ${Math.round(avgTalkRatio)}% — above the 40% ceiling. At this level you're presenting, not selling. Every extra minute you talk is a minute the prospect isn't selling themselves.`,
      questions: [
        "After every piece of information you share, follow with: \"Does that make sense to you?\" or \"What are your thoughts on that?\"",
        "Never go more than 20 seconds without asking a question or inviting a response",
        "When the prospect goes quiet, count to 5 in your head before speaking — let them fill the silence",
        "Record your next 3 calls and count your question-to-statement ratio",
      ],
      currentScore: null, targetScore: null,
      currentTalkRatio: Math.round(avgTalkRatio), targetTalkRatio: 35,
      sessionsTarget: 7,
    });
  }

  // Problem awareness
  if (weakPhases.includes("problemAwareness") || (phaseScores.problemAwareness != null && phaseScores.problemAwareness < 6.5)) {
    drills.push({
      id: id++, phase: "Problem Awareness", priority: "high",
      title: "Surface the Real Pain Drill",
      description: `Problem awareness is scoring ${phaseScores.problemAwareness?.toFixed(1) ?? "low"}. You can't sell a solution to someone who doesn't feel a problem. The prospect needs to discover the gap themselves — your job is to ask questions that make them see it.`,
      questions: [
        '"What\'s your biggest concern about your family\'s financial situation if something happened to you?"',
        '"Walk me through what you currently have in place to protect your family financially..."',
        '"If your income stopped tomorrow, what\'s the plan?"',
        '"Have you ever sat down and calculated what your family would actually need to maintain their lifestyle?"',
      ],
      currentScore: phaseScores.problemAwareness ?? null, targetScore: 8.0,
      currentTalkRatio: null, targetTalkRatio: null,
      sessionsTarget: 5,
    });
  }

  // Situation questions
  if (weakPhases.includes("situation") || (phaseScores.situation != null && phaseScores.situation < 6.5)) {
    drills.push({
      id: id++, phase: "Situation Questions", priority: "high",
      title: "Deep Discovery Framework",
      description: `Situation phase scoring ${phaseScores.situation?.toFixed(1) ?? "low"}. You're moving through discovery too quickly. Slow down — every detail you uncover here makes the rest of the call easier. Prospects buy more from agents who listen.`,
      questions: [
        '"Walk me through what your current coverage looks like today — what do you have in place?"',
        '"Tell me about your family situation — who depends on your income right now?"',
        '"What made you decide to take a look at this now, specifically?"',
        '"How long have you been thinking about getting this figured out?"',
      ],
      currentScore: phaseScores.situation ?? null, targetScore: 8.5,
      currentTalkRatio: null, targetTalkRatio: null,
      sessionsTarget: 5,
    });
  }

  // Close rate
  if (closeRate != null && closeRate < 0.25) {
    drills.push({
      id: id++, phase: "Close", priority: "high",
      title: "Commit to the Ask Drill",
      description: `Your close rate is ${Math.round(closeRate * 100)}%. The close isn't a pitch — it's a logical next step after the prospect has told you they have a problem and want a solution. Practice asking directly without hedging.`,
      questions: [
        "Practice: \"Based on everything you've shared, I'd recommend [X]. Would you like to get started today?\" — say it out loud 20 times",
        "Never end a call with \"I'll send you some info\" — always ask for a decision or a next step",
        "Trial close before final close: \"If the numbers made sense, is this something you'd want to move forward with?\"",
        "Present 2 options, never 1 — the choice between options removes the choice of doing nothing",
      ],
      currentScore: null, targetScore: null,
      currentTalkRatio: null, targetTalkRatio: null,
      sessionsTarget: 6,
    });
  }

  // Qualifying
  if (weakPhases.includes("qualifying") || (phaseScores.qualifying != null && phaseScores.qualifying < 6.5)) {
    drills.push({
      id: id++, phase: "Qualifying", priority: "medium",
      title: "Qualify Before You Present Drill",
      description: `Qualifying is at ${phaseScores.qualifying?.toFixed(1) ?? "low"}. Presenting to unqualified prospects wastes your time and kills your energy. Know budget, health, and decision authority before you show a single number.`,
      questions: [
        '"Health-wise, any major conditions I should know about before we run numbers together?"',
        '"Are you a tobacco user?"',
        '"If the numbers make sense, is this something you\'d want to get started on this week?"',
        '"Is there anyone else involved in this decision — a spouse, a business partner?"',
      ],
      currentScore: phaseScores.qualifying ?? null, targetScore: 8.0,
      currentTalkRatio: null, targetTalkRatio: null,
      sessionsTarget: 4,
    });
  }

  // Solution awareness
  if (weakPhases.includes("solutionAwareness") || (phaseScores.solutionAwareness != null && phaseScores.solutionAwareness < 6.5)) {
    drills.push({
      id: id++, phase: "Solution Awareness", priority: "medium",
      title: "Let Them Ask for the Solution",
      description: `Solution awareness at ${phaseScores.solutionAwareness?.toFixed(1) ?? "low"}. Most agents present solutions before the prospect is ready. Wait until they're asking you — then present. Use these bridge questions to make the transition natural.`,
      questions: [
        '"Have you ever thought about what it would look like to have that risk completely taken off the table?"',
        '"What would it mean to you — and your family — to know this was handled?"',
        '"If you could solve this for a reasonable monthly amount, is that something you\'d want to explore?"',
        '"Based on what you\'ve shared, it sounds like you\'d want a permanent solution — not just a temporary one. Is that right?"',
      ],
      currentScore: phaseScores.solutionAwareness ?? null, targetScore: 8.0,
      currentTalkRatio: null, targetTalkRatio: null,
      sessionsTarget: 4,
    });
  }

  // Connection — if nothing else is weak, work on rapport
  if (drills.length === 0 || (weakPhases.includes("connection") || (phaseScores.connection != null && phaseScores.connection < 6.5))) {
    drills.push({
      id: id++, phase: "Connection", priority: "medium",
      title: "Permission-Based Rapport Drill",
      description: `Connection phase ${phaseScores.connection != null ? `at ${phaseScores.connection.toFixed(1)}` : "needs work"}. You can't rush the connection phase in life insurance — trust is the product. Build it or lose everything downstream.`,
      questions: [
        "Open with a genuine question about them, not about the product: \"Before we get into anything — tell me a bit about your situation\"",
        "Establish credibility in one sentence: what you do, who you help, and why it matters",
        '"Is it okay if I ask you a few questions first, just to make sure I give you the right information?"',
        "Mirror their energy and pace — if they're slow and deliberate, slow down",
      ],
      currentScore: phaseScores.connection ?? null, targetScore: 9.0,
      currentTalkRatio: null, targetTalkRatio: null,
      sessionsTarget: 4,
    });
  }

  // Cap at 4 drills — too many is overwhelming
  return drills.slice(0, 4);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const empty: CoachingReport = {
    totalCalls: 0, nepqPhaseScores: [], weakestPhase: null,
    avgTalkRatio: null, avgScore: null, closeRate: null,
    drills: [], recentMoments: [], coachingFocus: null,
  };

  if (!user) return NextResponse.json(empty);

  // agent_profiles table is a user-profile table (name/agency/license), not performance data — skip it
  const profile = null;

  // Fetch recent call sessions for detailed NEPQ data
  const { data: calls } = await supabase
    .from("call_sessions")
    .select("id, created_at, overall_score, nepq_phases_completed, talk_ratio_agent, notes, outcome, prospect_name, objections_raised")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!calls || calls.length === 0) return NextResponse.json(empty);

  const totalCalls = calls.length;

  // ── Compute average NEPQ phase scores ──────────────────────────────────────
  // Only from calls that have full per-phase scores (uploaded/analyzed calls)
  const phaseAccum: Record<string, number[]> = {};
  for (const call of calls) {
    const phases = (call.nepq_phases_completed ?? {}) as Record<string, unknown>;
    for (const cfg of PHASE_CONFIG) {
      const val = phases[cfg.key];
      if (val && typeof val === "object" && "score" in val && typeof (val as { score: unknown }).score === "number") {
        (phaseAccum[cfg.key] ??= []).push((val as { score: number }).score);
      }
    }
  }

  const phaseScores: Record<string, number> = {};
  const nepqPhaseScores: NepqPhaseScore[] = PHASE_CONFIG.map(cfg => {
    const arr = phaseAccum[cfg.key];
    const score = arr && arr.length > 0
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : 5.0; // neutral default when no data
    phaseScores[cfg.key] = score;
    return { phase: cfg.label, key: cfg.key, score, color: cfg.color };
  });

  // Find weakest phase (only from phases with real data)
  const phasesWithData = PHASE_CONFIG.filter(c => (phaseAccum[c.key]?.length ?? 0) >= 2);
  const weakestCfg = phasesWithData.length > 0
    ? phasesWithData.reduce((min, c) =>
        phaseScores[c.key] < phaseScores[min.key] ? c : min
      )
    : null;

  // ── Compute aggregates ─────────────────────────────────────────────────────
  const avgTalkRatio = profile?.avg_talk_ratio != null
    ? Math.round(profile.avg_talk_ratio)
    : (() => {
        const samples = calls.filter(c => c.talk_ratio_agent != null);
        return samples.length > 0
          ? Math.round(samples.reduce((s, c) => s + (c.talk_ratio_agent as number), 0) / samples.length)
          : null;
      })();

  const avgScore = profile?.avg_overall_score != null
    ? profile.avg_overall_score
    : (() => {
        const scored = calls.filter(c => c.overall_score != null);
        return scored.length > 0
          ? scored.reduce((s, c) => s + (c.overall_score as number), 0) / scored.length
          : null;
      })();

  const closeRate = profile?.close_rate != null
    ? profile.close_rate
    : calls.filter(c => c.outcome === "closed").length / totalCalls;

  // ── Determine weak phases ─────────────────────────────────────────────────
  const weakPhases: string[] = (profile?.weak_nepq_phases as string[] ?? []).length > 0
    ? (profile!.weak_nepq_phases as string[])
    : phasesWithData.filter(c => phaseScores[c.key] < 6.5).map(c => c.key);

  // ── Generate drills ────────────────────────────────────────────────────────
  const drills = buildDrills(weakPhases, avgTalkRatio, closeRate, phaseScores);

  // ── Recent coaching moments ────────────────────────────────────────────────
  // Gather from call notes (post-analysis nextCallFocus) and flagged objections
  const recentMoments: CoachingMoment[] = [];

  for (const call of calls.slice(0, 15)) {
    // Primary: post-call coaching note stored as JSON notes field
    let issue: string | null = null;

    if (call.notes) {
      // notes may be a plain string or JSON with nextCallFocus / topIssue
      try {
        const parsed = typeof call.notes === "string" ? JSON.parse(call.notes) : call.notes;
        issue = parsed.nextCallFocus ?? parsed.topIssue ?? null;
      } catch {
        issue = typeof call.notes === "string" ? call.notes : null;
      }
    }

    // Fallback: first objection raised
    if (!issue) {
      const objections = (call.objections_raised as unknown[]) ?? [];
      if (objections.length > 0) {
        const first = objections[0];
        if (typeof first === "object" && first !== null) {
          issue = (first as Record<string, string>).type ?? (first as Record<string, string>).text ?? null;
        } else if (typeof first === "string") {
          issue = first;
        }
      }
    }

    if (!issue) continue;

    const dt = new Date(call.created_at as string);
    recentMoments.push({
      date: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      prospect: (call.prospect_name as string | null) ?? "Unknown",
      score: (call.overall_score as number | null) ?? 0,
      issue,
    });

    if (recentMoments.length >= 5) break;
  }

  // Generate AI coaching focus from actual call data
  let coachingFocus: string | null = null;
  if (totalCalls >= 1) {
    try {
      const weakLabel = weakestCfg?.label ?? "connection";
      const prompt = `You are a sales coach for high-ticket phone sales using NEPQ methodology.
Agent stats: ${totalCalls} calls, avg score ${avgScore != null ? Number(avgScore).toFixed(1) : "N/A"}/10, close rate ${closeRate != null ? Math.round(closeRate * 100) : "N/A"}%, avg talk ratio ${avgTalkRatio ?? "N/A"}%.
Weakest NEPQ phase: ${weakLabel}.
Write ONE punchy coaching focus sentence (under 25 words) telling this agent exactly what to work on next call. No fluff.`;
      const res = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        messages: [{ role: "user", content: prompt }],
      });
      const text = res.content[0].type === "text" ? res.content[0].text.trim() : null;
      if (text) coachingFocus = text.replace(/^["']|["']$/g, "");
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({
    totalCalls,
    nepqPhaseScores,
    weakestPhase: weakestCfg?.label ?? null,
    avgTalkRatio,
    avgScore,
    closeRate,
    drills,
    recentMoments,
    coachingFocus,
  } satisfies CoachingReport);
}
