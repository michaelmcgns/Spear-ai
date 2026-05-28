import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { filterCoachingCard } from "@/lib/coaching/cardFilter";
import { LIFE_INSURANCE_KNOWLEDGE } from "@/lib/coaching/lifeInsuranceKnowledge";

interface AnalyzeBody {
  utterance:    string;
  speaker:      "agent" | "prospect";
  nepqPhase?:   string;
  discProfile?: string | null;
  agentId?:     string;
  recentLines?: { speaker: string; text: string }[];
  recentCardTypes?: string[]; // last 2 card types fired — for deduplication
}

interface CardPayload {
  type: "OBJECTION" | "NEPQ_MOVE" | "DISC_INSIGHT" | "CLOSE_SIGNAL";
  title: string;
  body: string;
  suggestedResponse?: string;
}

// Build agent-specific context from their profile (only if >= 3 calls)
async function buildAgentContext(_agentId: string): Promise<string> {
  try {
    // agent_profiles table is user profile data (name/agency/license), not performance data
    // Skip profile context until a dedicated performance table exists
    return "";

    const lines: string[] = ["\n\nAgent Profile (personalise coaching to this agent):"];
    if (profile.avg_talk_ratio != null)
      lines.push(`- Avg talk ratio: ${Math.round(profile.avg_talk_ratio)}% (target <40%)`);
    if (profile.avg_overall_score != null)
      lines.push(`- Avg call score: ${profile.avg_overall_score.toFixed(1)}/10`);
    if ((profile.weak_nepq_phases ?? []).length > 0)
      lines.push(`- Weak NEPQ phases: ${(profile.weak_nepq_phases as string[]).join(", ")}`);
    if (profile.coaching_focus)
      lines.push(`- Current coaching focus: ${profile.coaching_focus}`);

    return lines.join("\n");
  } catch {
    return "";
  }
}

const BASE_SYSTEM = `You are Spear — a real-time AI sales coach for life insurance phone sales. You coach agents live using NEPQ (Next Evolution of Persuasion Questions) methodology and DISC buyer psychology.

${LIFE_INSURANCE_KNOWLEDGE}

═══════════════════════════════════════════════════════════════
LIVE COACHING RULES
═══════════════════════════════════════════════════════════════

After each utterance you decide: fire a coaching card, or return null. Be highly selective — only fire when there is a clear, immediate, actionable moment. Return null for ~70% of utterances.

═══ WHEN TO FIRE EACH CARD TYPE ═══

OBJECTION — fire when the PROSPECT says:
• "I need to think about it" / "let me think about it" / "I'll think it over"
• "that's expensive" / "I can't afford" / "too much" / price resistance
• "I have to talk to my spouse / husband / wife / partner"
• "I already have coverage / insurance / something"
• "bad timing" / "call me back" / "not right now" / "maybe later"
• "I'm not sure" / "I don't know" / "I'm not interested"
→ Always include a suggestedResponse: exact words to say next.

NEPQ_MOVE — fire when:
• The AGENT just pitched a solution before understanding the problem
• The AGENT talked more than 2 sentences in a row without asking a question
• A natural NEPQ question is obvious but wasn't asked (e.g. "What happens to your family if…")
• The current NEPQ phase needs a specific question to advance
• The AGENT gave information when they should have asked a question
→ Always include a suggestedResponse: the exact question or phrase to say now.

DISC_INSIGHT — fire when you can confidently identify the prospect's buying style from their language:
• D (Dominant): "bottom line", "just tell me", "results", "quickly", "get to the point", decisive language
• I (Influencer): "exciting", "love that", "amazing", "together", "fun", enthusiasm
• S (Steady): "family", "just want to be safe", "comfortable", "careful", "not sure", "everyone else"
• C (Conscientious): "how exactly does that work", "can you explain", "data", "specifically", "verify", "numbers"
→ Fire ONCE per call maximum. No suggestedResponse needed.

CLOSE_SIGNAL — fire when the PROSPECT signals buying readiness:
• "when would this start" / "when does coverage begin"
• "what happens next" / "what's the next step"
• "that sounds fair" / "that sounds reasonable" / "that makes sense"
• "how do I get started" / "can I do that today" / "how do I sign up"
→ suggestedResponse: exact close or next-step language.

═══ DO NOT FIRE FOR ═══
• Greetings, small talk, "how are you"
• General back-and-forth questions
• Agent explaining product features (unless also pitching too hard)
• Anything that doesn't require immediate action
• Same card type if it was just fired for a similar reason (check recentCardTypes)

═══ OUTPUT FORMAT ═══
Respond with EITHER the single word null OR a JSON code block:

\`\`\`json
{
  "type": "OBJECTION" | "NEPQ_MOVE" | "DISC_INSIGHT" | "CLOSE_SIGNAL",
  "title": "3-5 words, punchy, specific",
  "body": "1-2 sentences. Direct instruction. Tell the agent exactly what to do, not what happened.",
  "suggestedResponse": "Exact words to say. Use for OBJECTION and NEPQ_MOVE. Omit for DISC_INSIGHT."
}
\`\`\``;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AnalyzeBody;
  const { utterance, speaker, nepqPhase, discProfile, agentId, recentLines = [], recentCardTypes = [] } = body;

  if (!utterance?.trim()) return NextResponse.json({ card: null });

  console.log(`[Spear] coaching/analyze → speaker=${speaker} phase=${nepqPhase} text="${utterance?.slice(0, 60)}"`);

  const agentContext = agentId ? await buildAgentContext(agentId) : "";
  const systemPrompt = agentContext ? `${BASE_SYSTEM}${agentContext}` : BASE_SYSTEM;

  // Build conversation context from recent lines (last 6 turns)
  const contextBlock = recentLines.length > 0
    ? "\n\nRecent conversation:\n" + recentLines
        .slice(-6)
        .map(l => `${l.speaker === "agent" ? "AGENT" : "PROSPECT"}: "${l.text}"`)
        .join("\n")
    : "";

  // Deduplication hint
  const dedupHint = recentCardTypes.length > 0
    ? `\n\nRecently fired cards: ${recentCardTypes.join(", ")} — avoid firing the same type again unless clearly warranted.`
    : "";

  const userPrompt = [
    `Current NEPQ phase: ${nepqPhase ?? "Connection"}`,
    `DISC detected so far: ${discProfile ?? "unknown"}`,
    contextBlock,
    dedupHint,
    `\nNEW UTTERANCE`,
    `Speaker: ${speaker.toUpperCase()}`,
    `"${utterance}"`,
    `\nShould a coaching card fire? Respond with the JSON block or the word null.`,
  ].join("\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = (message.content[0].type === "text" ? message.content[0].text : "").trim();
    console.log("[Spear] Claude Haiku response:", text.slice(0, 200));

    if (!text || text === "null" || text.toLowerCase().startsWith("null")) {
      return NextResponse.json({ card: null });
    }

    // Parse JSON — try code block first, then raw JSON
    let parsed: CardPayload | null = null;
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = blockMatch ? blockMatch[1].trim() : text.trim();

    try {
      parsed = JSON.parse(jsonStr) as CardPayload;
    } catch {
      // Try extracting just the JSON object if there's surrounding text
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { parsed = JSON.parse(objMatch[0]) as CardPayload; } catch { /* fall through */ }
      }
    }

    if (!parsed?.type || !parsed?.title || !parsed?.body) {
      console.log("[Spear] Could not parse card — returning null");
      return NextResponse.json({ card: null });
    }

    // Validate type
    const VALID_TYPES = ["OBJECTION", "NEPQ_MOVE", "DISC_INSIGHT", "CLOSE_SIGNAL"];
    if (!VALID_TYPES.includes(parsed.type)) return NextResponse.json({ card: null });

    // Apply regulatory content filter
    if (parsed.body) parsed.body = filterCoachingCard(parsed.body).content;
    if (parsed.suggestedResponse)
      parsed.suggestedResponse = filterCoachingCard(parsed.suggestedResponse).content;

    return NextResponse.json({ card: parsed });
  } catch (err) {
    console.error("[Spear] coaching/analyze threw:", err);
    return NextResponse.json({ card: null });
  }
}
