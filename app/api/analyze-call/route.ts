import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { filterCoachingCard, filterCoachingItems } from "@/lib/coaching/cardFilter";
import { createClient } from "@/lib/supabase/server";

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

// Analyze transcript with Groq and return full Spear coaching report
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
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: `You are Spear, an elite AI sales coach trained in NEPQ methodology. Analyze this sales call transcript and return ONLY a JSON object wrapped in \`\`\`json and \`\`\` tags. Be brutally honest and specific — reference exact moments from the transcript.

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
\`\`\``,
      },
      { role: "user", content: transcript },
    ],
  });

  const raw = completion.choices[0].message.content ?? "";
  try {
    const match = raw.match(/```json\n?([\s\S]*?)\n?```/);
    return JSON.parse(match ? match[1] : raw) as SpearAnalysis;
  } catch {
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

    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
