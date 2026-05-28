import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { filterCoachingCard, filterCoachingItems } from "@/lib/coaching/cardFilter";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireFeature } from "@/lib/subscription/server";
import { LIFE_INSURANCE_KNOWLEDGE } from "@/lib/coaching/lifeInsuranceKnowledge";

export const maxDuration = 300;

// Full Spear analysis format
interface SpearAnalysis {
  overallScore: number;
  nepqPhases: {
    connection: { score: number; note: string };
    situation: { score: number; note: string };
    problemAwareness: { score: number; note: string };
    consequence: { score: number; note: string };
    solutionAwareness: { score: number; note: string };
    qualifying: { score: number; note: string };
    close: { score: number; note: string };
  };
  discProfile: {
    type: "D" | "I" | "S" | "C";
    description: string;
    adjustments: string[];
  };
  talkRatio: {
    agentPct: number;
    prospectPct: number;
    status: "green" | "yellow" | "red";
  };
  objections: Array<{
    text: string;
    type: string;
    handling: string;
    suggestedResponse: string;
  }>;
  strengths: string[];
  improvements: Array<{
    what: string;
    why: string;
    instead: string;
  }>;
  mindsetNote: string;
  nextCallFocus: string;
  _ftcDisclosure?: string;
}

// Upload audio to AssemblyAI and poll until transcription completes
async function transcribeAudio(file: File): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not set");

  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: { authorization: apiKey },
    body: file,
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`AssemblyAI upload failed (${uploadRes.status}): ${body}`);
  }
  const { upload_url } = (await uploadRes.json()) as { upload_url: string };

  const transcriptRes = await fetch(
    "https://api.assemblyai.com/v2/transcript",
    {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speech_models: ["universal"], // fixed: was deprecated `speech_model` (singular)
        speaker_labels: true,
      }),
    }
  );
  if (!transcriptRes.ok) {
    const body = await transcriptRes.text();
    throw new Error(
      `AssemblyAI transcript request failed (${transcriptRes.status}): ${body}`
    );
  }
  const { id } = (await transcriptRes.json()) as { id: string };

  const pollingUrl = `https://api.assemblyai.com/v2/transcript/${id}`;
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(pollingUrl, {
      headers: { authorization: apiKey },
    });
    const data = (await pollRes.json()) as {
      status: string;
      text?: string;
      error?: string;
    };
    if (data.status === "completed") return data.text ?? "";
    if (data.status === "error")
      throw new Error(`Transcription failed: ${data.error}`);
  }
}

// Analyze transcript with Claude Sonnet and return full Spear coaching report
const FALLBACK_ANALYSIS: SpearAnalysis = {
  overallScore: 5,
  nepqPhases: {
    connection:        { score: 5, note: "Analysis unavailable — please try again." },
    situation:         { score: 5, note: "Analysis unavailable — please try again." },
    problemAwareness:  { score: 5, note: "Analysis unavailable — please try again." },
    consequence:       { score: 5, note: "Analysis unavailable — please try again." },
    solutionAwareness: { score: 5, note: "Analysis unavailable — please try again." },
    qualifying:        { score: 5, note: "Analysis unavailable — please try again." },
    close:             { score: 5, note: "Analysis unavailable — please try again." },
  },
  discProfile: { type: "S", description: "Could not determine buyer type.", adjustments: [] },
  talkRatio:   { agentPct: 50, prospectPct: 50, status: "yellow" },
  objections:  [],
  strengths:   ["Analysis unavailable — please try again."],
  improvements:[{ what: "N/A", why: "Analysis failed", instead: "Resubmit the call for analysis." }],
  mindsetNote: "Analysis unavailable.",
  nextCallFocus: "Resubmit for a full analysis.",
};

async function analyzeTranscript(transcript: string): Promise<SpearAnalysis> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are Spear, an elite AI sales coach specializing in life insurance phone sales. You are trained in NEPQ (Next Evolution of Persuasion Questions) methodology and DISC buyer psychology.

${LIFE_INSURANCE_KNOWLEDGE}

Using the life insurance knowledge above, analyze this sales call transcript and return ONLY a JSON object wrapped in \`\`\`json and \`\`\` tags. Be brutally honest and specific — reference exact moments from the transcript. Use your knowledge of life insurance objections, products, and NEPQ phases to give coaching that is specific to this industry.

\`\`\`json
{
  "overallScore": <integer 1-10>,
  "nepqPhases": {
    "connection": {"score": <integer 1-10>, "note": "<one specific coaching note tied to a moment in the call>"},
    "situation": {"score": <integer 1-10>, "note": "<one specific coaching note>"},
    "problemAwareness": {"score": <integer 1-10>, "note": "<one specific coaching note>"},
    "consequence": {"score": <integer 1-10>, "note": "<one specific coaching note>"},
    "solutionAwareness": {"score": <integer 1-10>, "note": "<one specific coaching note>"},
    "qualifying": {"score": <integer 1-10>, "note": "<one specific coaching note>"},
    "close": {"score": <integer 1-10>, "note": "<one specific coaching note>"}
  },
  "discProfile": {
    "type": "<D|I|S|C>",
    "description": "<one sentence on this buyer type and what drives them>",
    "adjustments": ["<specific adjustment 1>", "<specific adjustment 2>", "<specific adjustment 3>"]
  },
  "talkRatio": {
    "agentPct": <estimated integer 0-100 of agent's share of conversation>,
    "prospectPct": <100 minus agentPct>,
    "status": "<green if agentPct < 40, yellow if 40-50, red if > 50>"
  },
  "objections": [
    {
      "text": "<exact objection raised>",
      "type": "<price|spouse|timing|think_about_it|trust|other>",
      "handling": "<resolved|acknowledged|deflected|ignored>",
      "suggestedResponse": "<ideal NEPQ response the agent should have used>"
    }
  ],
  "strengths": ["<specific strength 1 with transcript reference>", "<strength 2>", "<strength 3>"],
  "improvements": [
    {"what": "<exactly what the agent said or did>", "why": "<why it hurt the sale>", "instead": "<exact language to use next time>"},
    {"what": "...", "why": "...", "instead": "..."},
    {"what": "...", "why": "...", "instead": "..."}
  ],
  "mindsetNote": "<one observation about the agent's belief, energy, or attitude — not technique. Not padded.>",
  "nextCallFocus": "<one specific skill to drill before the next call. One sentence. Not a list.>"
}
\`\`\``;

  const jsonSchema = `\`\`\`json
{
  "overallScore": <integer 1-10>,
  "nepqPhases": {
    "connection": {"score": <integer 1-10>, "note": "<specific coaching note tied to a moment in the call>"},
    "situation": {"score": <integer 1-10>, "note": "<specific coaching note>"},
    "problemAwareness": {"score": <integer 1-10>, "note": "<specific coaching note>"},
    "consequence": {"score": <integer 1-10>, "note": "<specific coaching note>"},
    "solutionAwareness": {"score": <integer 1-10>, "note": "<specific coaching note>"},
    "qualifying": {"score": <integer 1-10>, "note": "<specific coaching note>"},
    "close": {"score": <integer 1-10>, "note": "<specific coaching note>"}
  },
  "discProfile": {
    "type": "<D|I|S|C>",
    "description": "<one sentence on this buyer type and what drives them>",
    "adjustments": ["<life-insurance-specific adjustment 1>", "<adjustment 2>", "<adjustment 3>"]
  },
  "talkRatio": {
    "agentPct": <estimated integer 0-100>,
    "prospectPct": <100 minus agentPct>,
    "status": "<green if agentPct < 40, yellow if 40-50, red if > 50>"
  },
  "objections": [
    {
      "text": "<exact objection raised>",
      "type": "<price|spouse|timing|think_about_it|trust|existing_coverage|other>",
      "handling": "<resolved|acknowledged|deflected|ignored>",
      "suggestedResponse": "<ideal NEPQ response from the objection playbook>"
    }
  ],
  "strengths": ["<specific strength with transcript reference>", "<strength 2>", "<strength 3>"],
  "improvements": [
    {"what": "<exactly what the agent said or did>", "why": "<why it hurt the sale>", "instead": "<exact NEPQ language to use next time>"},
    {"what": "...", "why": "...", "instead": "..."},
    {"what": "...", "why": "...", "instead": "..."}
  ],
  "mindsetNote": "<one observation about the agent's energy, belief, or confidence — not technique>",
  "nextCallFocus": "<one specific NEPQ skill or life insurance technique to drill before the next call>"
}
\`\`\``;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: `Analyze this call transcript and return the JSON in the format below:\n\n${jsonSchema}\n\nTranscript:\n${transcript}` }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = blockMatch ? blockMatch[1].trim() : raw.trim();
    return JSON.parse(jsonStr) as SpearAnalysis;
  } catch {
    // Try extracting raw JSON object
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]) as SpearAnalysis; } catch { /* fall through */ }
    }
    return { ...FALLBACK_ANALYSIS };
  }
}

/** Apply regulatory filters and log any flagged outputs. */
async function applyFiltersAndLog(
  analysis: SpearAnalysis,
  sessionId: string,
  agentId?: string
): Promise<SpearAnalysis> {
  const allFlagged: Array<{ original: string; replaced: string; flagType: "regulatory" | "iul_language" }> = [];

  // Filter NEPQ phase notes
  for (const key of Object.keys(analysis.nepqPhases) as Array<keyof typeof analysis.nepqPhases>) {
    const result = filterCoachingCard(analysis.nepqPhases[key].note);
    if (result.isRegulatoryFlag && result.flagType) {
      allFlagged.push({ original: result.originalContent, replaced: result.content, flagType: result.flagType });
      analysis.nepqPhases[key] = { ...analysis.nepqPhases[key], note: result.content };
    }
  }

  // Filter objection suggested responses
  analysis.objections = analysis.objections.map((obj) => {
    const result = filterCoachingCard(obj.suggestedResponse);
    if (result.isRegulatoryFlag && result.flagType) {
      allFlagged.push({ original: result.originalContent, replaced: result.content, flagType: result.flagType });
      return { ...obj, suggestedResponse: result.content };
    }
    return obj;
  });

  // Filter strengths and improvements
  const { filtered: filteredStrengths, flagged: flaggedStrengths } = filterCoachingItems(analysis.strengths);
  allFlagged.push(...flaggedStrengths);
  analysis.strengths = filteredStrengths;

  const filteredImprovements = analysis.improvements.map((imp) => {
    const insteadResult = filterCoachingCard(imp.instead);
    if (insteadResult.isRegulatoryFlag && insteadResult.flagType) {
      allFlagged.push({ original: insteadResult.originalContent, replaced: insteadResult.content, flagType: insteadResult.flagType });
      return { ...imp, instead: insteadResult.content };
    }
    return imp;
  });
  analysis.improvements = filteredImprovements;

  // Filter next call focus
  const focusResult = filterCoachingCard(analysis.nextCallFocus);
  if (focusResult.isRegulatoryFlag && focusResult.flagType) {
    allFlagged.push({ original: focusResult.originalContent, replaced: focusResult.content, flagType: focusResult.flagType });
    analysis.nextCallFocus = focusResult.content;
  }

  // Log flagged events to DB (append-only, non-blocking)
  if (allFlagged.length > 0) {
    try {
      const supabase = await createClient();
      await supabase.from("flagged_coaching_events").insert(
        allFlagged.map((f) => ({
          agent_id: agentId ?? null,
          session_id: sessionId,
          flag_type: f.flagType,
          original_content: f.original,
          replaced_content: f.replaced,
        }))
      );
    } catch {
      // Non-fatal
    }
  }

  // FTC AI disclosure appended to every report
  analysis._ftcDisclosure =
    "This report was generated by artificial intelligence (Spear AI). It is intended for internal coaching use only and does not constitute legal, financial, or insurance advice.";

  return analysis;
}

export async function POST(req: NextRequest) {
  try {
    // Feature gate — call upload requires Agent plan or higher
    const allowed = await requireFeature("call_upload");
    if (!allowed) {
      return NextResponse.json({ error: "Your plan does not include call analysis. Upgrade to Agent or higher." }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("audio") as File | null;
    const sessionId = (formData.get("sessionId") as string | null) ?? `session-${Date.now()}`;
    const agentId = formData.get("agentId") as string | null ?? undefined;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const transcript = await transcribeAudio(file);
    let analysis = await analyzeTranscript(transcript);
    analysis = await applyFiltersAndLog(analysis, sessionId, agentId);

    // ── Save call session to DB (server-side, always runs) ──────────────────
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const db = createServiceClient(); // bypasses RLS
        const { error: saveError } = await db.from("call_sessions").insert({
          user_id:               user.id,
          duration_seconds:      0, // audio duration not available at this point
          transcript:            [{ text: transcript }],
          outcome:               "unknown",
          talk_ratio_agent:      analysis.talkRatio?.agentPct ?? null,
          talk_ratio_prospect:   analysis.talkRatio?.prospectPct ?? null,
          disc_profile_detected: analysis.discProfile?.type ?? null,
          nepq_phases_completed: analysis.nepqPhases
            ? Object.fromEntries(
                Object.entries(analysis.nepqPhases).map(([k, v]) => [k, { score: v.score, note: v.note }])
              )
            : {},
          objections_raised:     analysis.objections ?? [],
          overall_score:         analysis.overallScore ?? null,
          notes:                 JSON.stringify({
            nextCallFocus: analysis.nextCallFocus,
            mindsetNote:   analysis.mindsetNote,
          }),
        });

        if (saveError) {
          console.error("[analyze-call] save error:", saveError.message);
          // Try minimal insert as fallback
          await db.from("call_sessions").insert({
            user_id:          user.id,
            duration_seconds: 0,
            notes:            JSON.stringify({ nextCallFocus: analysis.nextCallFocus }),
          }).then(({ error }) => {
            if (error) console.error("[analyze-call] minimal save also failed:", error.message);
            else console.log("[analyze-call] minimal save succeeded for user", user.id);
          });
        } else {
          console.log("[analyze-call] call saved successfully for user", user.id);
        }
      } else {
        console.warn("[analyze-call] no authenticated user — skipping save");
      }
    } catch (saveErr) {
      // Non-fatal — still return the analysis even if save fails
      console.error("[analyze-call] save threw:", saveErr instanceof Error ? saveErr.message : saveErr);
    }
    // ── End save ────────────────────────────────────────────────────────────

    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
