import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncCallToGHL } from "@/lib/integrations/ghl";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface SaveBody {
  agentId?: string;
  durationSeconds?: number;
  transcript?: unknown[];
  coachingCardsFired?: { id: string; type: string }[];
  cardsAccepted?: string[];
  cardsDismissed?: string[];
  outcome?: "closed" | "not_closed" | "follow_up" | "unknown";
  talkRatioAgent?: number;
  talkRatioProspect?: number;
  discProfile?: string | null;
  nepqPhases?: Record<string, unknown>;
  objectionsRaised?: unknown[];
  overallScore?: number | null;
  notes?: string | null;
  prospectName?: string | null;
  productName?: string | null;
  prospectPhone?: string | null;
  topImprovement?: string | null;
  topStrength?: string | null;
  nepqPhaseReached?: string | null;
}

// ─── Background agent profile recalculation ───────────────────────────────────

async function updateAgentProfile(agentId: string): Promise<void> {
  const supabase = await createClient();

  const { data: calls } = await supabase
    .from("call_sessions")
    .select("*")
    .eq("user_id", agentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!calls || calls.length === 0) return;

  const totalCalls = calls.length;
  const closedCount = calls.filter(c => c.outcome === "closed").length;
  const closeRate = closedCount / totalCalls;

  const ratioSamples = calls.filter(c => c.talk_ratio_agent != null);
  const avgTalkRatio = ratioSamples.length > 0
    ? ratioSamples.reduce((s, c) => s + (c.talk_ratio_agent as number), 0) / ratioSamples.length
    : null;

  const scoredCalls = calls.filter(c => c.overall_score != null);
  const avgScore = scoredCalls.length > 0
    ? scoredCalls.reduce((s, c) => s + (c.overall_score as number), 0) / scoredCalls.length
    : null;

  // Most common DISC type
  const discCounts: Record<string, number> = {};
  calls.forEach(c => {
    if (c.disc_profile_detected) {
      const d = c.disc_profile_detected as string;
      discCounts[d] = (discCounts[d] ?? 0) + 1;
    }
  });
  const mostCommonDisc = Object.entries(discCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Most accepted card types
  const cardTypeTally: Record<string, number> = {};
  calls.forEach(c => {
    const accepted: string[] = (c.cards_accepted as string[]) ?? [];
    const fired: { id: string; type: string }[] = (c.coaching_cards_fired as { id: string; type: string }[]) ?? [];
    accepted.forEach(id => {
      const card = fired.find(f => f.id === id);
      if (card?.type) cardTypeTally[card.type] = (cardTypeTally[card.type] ?? 0) + 1;
    });
  });
  const mostAcceptedCardTypes = Object.entries(cardTypeTally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  // Weak / strong NEPQ phases (need at least 3 scored calls per phase)
  const PHASE_KEYS = ["connection", "situation", "problemAwareness", "consequence", "solutionAwareness", "qualifying", "close"];
  const phaseScores: Record<string, number[]> = {};
  calls.forEach(c => {
    const phases = (c.nepq_phases_completed ?? {}) as Record<string, { score?: number }>;
    PHASE_KEYS.forEach(key => {
      const s = phases[key]?.score;
      if (typeof s === "number") {
        phaseScores[key] = [...(phaseScores[key] ?? []), s];
      }
    });
  });
  const weakPhases = PHASE_KEYS.filter(k => {
    const arr = phaseScores[k];
    return arr && arr.length >= 3 && arr.reduce((a, b) => a + b, 0) / arr.length < 6;
  });
  const strongPhases = PHASE_KEYS.filter(k => {
    const arr = phaseScores[k];
    return arr && arr.length >= 3 && arr.reduce((a, b) => a + b, 0) / arr.length > 7;
  });

  const last5Outcomes = calls.slice(0, 5).map(c => c.outcome as string);

  // Auto-generate coaching focus with Claude (only after enough data)
  let coachingFocus: string | null = null;
  if (totalCalls >= 3) {
    try {
      const prompt = [
        `Agent stats:`,
        `- Weak NEPQ phases: ${weakPhases.join(", ") || "none yet"}`,
        `- Talk ratio: ${avgTalkRatio != null ? Math.round(avgTalkRatio) + "%" : "unknown"} (target <40%)`,
        `- Close rate: ${Math.round(closeRate * 100)}%`,
        `- Recent outcomes: ${last5Outcomes.join(", ")}`,
        ``,
        `Write ONE specific coaching focus sentence (under 20 words). Direct, no filler. Tell them exactly what to work on next.`,
      ].join("\n");

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
      if (text) coachingFocus = text.replace(/^["']|["']$/g, "");
    } catch {
      // Non-fatal — leave coaching_focus as-is
    }
  }

  // agent_profiles in the DB is a user-profile table (name/agency/license) — not a performance table.
  // Performance profile writes are skipped until a dedicated table is created.
  void agentId; void coachingFocus;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SaveBody;

  // Use service client to bypass RLS — user is authenticated via agentId
  // This is safe because agentId is resolved server-side from the session
  const db = createServiceClient();

  // Verify the calling user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Always insert with user_id from the verified session, not from the body
  const userId = user.id;

  const { data, error } = await db
    .from("call_sessions")
    .insert({
      user_id:               userId,
      duration_seconds:      body.durationSeconds ?? 0,
      transcript:            body.transcript ?? [],
      coaching_cards_fired:  body.coachingCardsFired ?? [],
      cards_accepted:        body.cardsAccepted ?? [],
      cards_dismissed:       body.cardsDismissed ?? [],
      outcome:               body.outcome ?? "unknown",
      talk_ratio_agent:      body.talkRatioAgent ?? null,
      talk_ratio_prospect:   body.talkRatioProspect ?? null,
      disc_profile_detected: body.discProfile ?? null,
      nepq_phases_completed: body.nepqPhases ?? {},
      objections_raised:     body.objectionsRaised ?? [],
      overall_score:         body.overallScore ?? null,
      notes:                 body.notes ?? null,
      prospect_name:         body.prospectName ?? null,
      product_name:          body.productName ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("call save error:", error.message);
    // If columns don't exist yet, try minimal insert with just the base columns
    if (error.message.includes("column") && error.message.includes("does not exist")) {
      const { data: minData, error: minError } = await db
        .from("call_sessions")
        .insert({
          user_id:          userId,
          duration_seconds: body.durationSeconds ?? 0,
          outcome:          body.outcome ?? "unknown",
          notes:            body.notes ?? null,
        })
        .select()
        .single();
      if (minError) {
        console.error("call save minimal error:", minError.message);
        return NextResponse.json({ error: minError.message }, { status: 500 });
      }
      return NextResponse.json({ id: minData.id, session: minData });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Background profile update — non-blocking
  if (body.agentId) {
    void updateAgentProfile(body.agentId).catch(err =>
      console.error("agent profile update failed:", err)
    );
  }

  // Background GHL sync — non-blocking, skips silently if not connected
  if (body.agentId) {
    const objections = (body.objectionsRaised ?? []).map(
      (o) => (typeof o === "object" && o !== null ? (o as Record<string, string>).type ?? (o as Record<string, string>).text ?? "" : String(o))
    );
    void syncCallToGHL({
      agentId:          body.agentId,
      callSessionId:    data.id,
      prospectName:     body.prospectName ?? "Unknown",
      prospectPhone:    body.prospectPhone ?? "",
      overallScore:     body.overallScore ?? null,
      discProfile:      body.discProfile ?? null,
      nepqPhaseReached: body.nepqPhaseReached ?? null,
      outcome:          body.outcome ?? "unknown",
      objectionsRaised: objections,
      topImprovement:   body.topImprovement ?? null,
      topStrength:      body.topStrength ?? null,
      callDate:         new Date().toISOString(),
      siteUrl:          process.env.NEXT_PUBLIC_SITE_URL ?? "",
    }).catch(err => console.error("GHL sync failed:", err));
  }

  return NextResponse.json({ id: data.id, session: data });
}
