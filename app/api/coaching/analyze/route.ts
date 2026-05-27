import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { filterCoachingCard } from "@/lib/coaching/cardFilter";

interface AnalyzeBody {
  utterance: string;
  speaker: "agent" | "prospect";
  nepqPhase?: string;
  discProfile?: string | null;
  agentId?: string;
}

interface CardPayload {
  type: "OBJECTION" | "NEPQ_MOVE" | "DISC_INSIGHT" | "CLOSE_SIGNAL";
  title: string;
  body: string;
  suggestedResponse?: string;
}

// Build agent-specific context from their profile (only if >= 3 calls)
async function buildAgentContext(agentId: string): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("agent_id", agentId)
      .single();

    if (!profile || profile.total_calls < 3) return "";

    const lines: string[] = ["\nAgent Profile (personalise your coaching to this agent):"];
    if (profile.avg_talk_ratio != null)
      lines.push(`- Avg talk ratio: ${Math.round(profile.avg_talk_ratio)}% (target <40%)`);
    if (profile.avg_overall_score != null)
      lines.push(`- Avg call score: ${profile.avg_overall_score.toFixed(1)}/10`);
    if ((profile.weak_nepq_phases ?? []).length > 0)
      lines.push(`- Weak NEPQ phases: ${(profile.weak_nepq_phases as string[]).join(", ")}`);
    if ((profile.most_missed_objections ?? []).length > 0)
      lines.push(`- Commonly missed objections: ${(profile.most_missed_objections as string[]).join(", ")}`);
    if (profile.coaching_focus)
      lines.push(`- Current coaching focus: ${profile.coaching_focus}`);

    return lines.join("\n");
  } catch {
    return "";
  }
}

const BASE_SYSTEM = `You are Spear, a real-time AI sales coach trained in NEPQ methodology and DISC psychology.

An agent is on a live sales call. After each utterance you decide whether to fire a coaching card.
Be selective — only fire when there is a clear, immediate, actionable moment. Most utterances should return null.

Card types:
- OBJECTION: prospect shows resistance, hesitation, or a delay tactic ("need to think", "too expensive", "talk to my spouse")
- NEPQ_MOVE: agent should ask a specific NEPQ question right now to advance the phase
- DISC_INSIGHT: you can confidently identify the prospect's DISC type from their language pattern
- CLOSE_SIGNAL: prospect signals buying readiness ("when would this start", "what's next", "that sounds fair")

Respond with ONLY a JSON object wrapped in \`\`\`json and \`\`\` tags, or the single word null.

\`\`\`json
{
  "type": "OBJECTION" | "NEPQ_MOVE" | "DISC_INSIGHT" | "CLOSE_SIGNAL",
  "title": "5 words max — punchy",
  "body": "1-2 sentences. Direct coaching instruction, not a question.",
  "suggestedResponse": "Exact words the agent should say right now. Include for OBJECTION and NEPQ_MOVE. Omit for DISC_INSIGHT."
}
\`\`\``;

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    console.error("[Spear] GROQ_API_KEY is not set — coaching disabled");
    return NextResponse.json({ card: null });
  }

  const body = (await req.json()) as AnalyzeBody;
  const { utterance, speaker, nepqPhase, discProfile, agentId } = body;
  console.log(`[Spear] coaching/analyze → speaker=${speaker} phase=${nepqPhase} text="${utterance?.slice(0, 60)}"`);

  if (!utterance?.trim()) return NextResponse.json({ card: null });

  const agentContext = agentId ? await buildAgentContext(agentId) : "";
  const systemPrompt = agentContext ? `${BASE_SYSTEM}${agentContext}` : BASE_SYSTEM;

  const userPrompt = [
    `Speaker: ${speaker}`,
    `NEPQ phase: ${nepqPhase ?? "Connection"}`,
    `DISC detected: ${discProfile ?? "unknown"}`,
    `Utterance: "${utterance}"`,
  ].join("\n");

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 320,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    console.log("[Spear] Groq raw response:", text.slice(0, 200));
    if (!text || text === "null") return NextResponse.json({ card: null });

    const match = text.match(/```json\n?([\s\S]*?)\n?```/);
    const parsed = JSON.parse(match ? match[1] : text) as CardPayload;

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
