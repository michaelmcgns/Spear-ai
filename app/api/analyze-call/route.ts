import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

// Allow up to 5 minutes for transcription polling on Vercel
export const maxDuration = 300;

interface AnalysisResult {
  buyerPsychologyProfile: string;
  topObjections: string[];
  coachingRecommendations: string[];
  nepqScore: number;
}

// Upload audio to AssemblyAI and request a transcript, then poll until done
// Accepts File directly — File extends Blob which is valid BodyInit, avoiding ArrayBuffer issues in Node.js
async function transcribeAudio(file: File): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not set");

  // Step 1: Upload raw audio — omit content-type so fetch sets it correctly from the Blob
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

  // Step 2: Submit transcription job
  const transcriptRes = await fetch(
    "https://api.assemblyai.com/v2/transcript",
    {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ audio_url: upload_url, speech_models: ["universal-2"] }),
    }
  );
  if (!transcriptRes.ok) {
    const body = await transcriptRes.text();
    throw new Error(`AssemblyAI transcript request failed (${transcriptRes.status}): ${body}`);
  }
  const { id } = (await transcriptRes.json()) as { id: string };

  // Step 3: Poll until status is completed or error
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

// Send transcript to Groq (llama-3.1-8b-instant) and parse the structured JSON response
async function analyzeTranscript(transcript: string): Promise<AnalysisResult> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert sales coach trained in NEPQ methodology and Cialdini's 6 principles of influence. Analyze this sales call transcript and return JSON with: buyerPsychologyProfile (string), topObjections (array of 3 strings), coachingRecommendations (array of 3 strings), nepqScore (number 1-10).",
      },
      { role: "user", content: transcript },
    ],
  });

  const raw = completion.choices[0].message.content ?? "{}";
  return JSON.parse(raw) as AnalysisResult;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const transcript = await transcribeAudio(file);
    const analysis = await analyzeTranscript(transcript);

    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
