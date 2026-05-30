/**
 * POST /api/coaching/practice-feedback
 *
 * Agent types their practice response to a drill question → returns specific
 * AI coaching feedback on what's good, what's weak, and the ideal version.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, response, phase, drillTitle } = await req.json() as {
    question: string;
    response: string;
    phase: string;
    drillTitle: string;
  };

  if (!question?.trim() || !response?.trim()) {
    return NextResponse.json({ error: "question and response are required" }, { status: 400 });
  }

  const prompt = `You are Spear, an elite NEPQ sales coach for life insurance phone sales.

An agent is practicing the "${drillTitle}" drill (${phase} phase).

The NEPQ prompt they were practicing:
"${question}"

The agent's practice response:
"${response}"

Give concise, direct coaching feedback. Be brutally honest. Use this format:

\`\`\`json
{
  "score": <integer 1-10>,
  "what_worked": "<1 sentence — what was good, if anything. Be specific.>",
  "what_missed": "<1 sentence — the main thing missing or weak. Be specific.>",
  "ideal_response": "<The exact words you'd want them to say. Full sentence, ready to use on a real call.>"
}
\`\`\`

If the response is blank, off-topic, or clearly not a real attempt, score it 0 and tell them to try again.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = blockMatch ? blockMatch[1].trim() : text.trim();

    const parsed = JSON.parse(jsonStr) as {
      score: number;
      what_worked: string;
      what_missed: string;
      ideal_response: string;
    };

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[practice-feedback] error:", err);
    return NextResponse.json({ error: "Failed to generate feedback" }, { status: 500 });
  }
}
