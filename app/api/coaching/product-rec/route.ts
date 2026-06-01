import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { LIFE_INSURANCE_KNOWLEDGE } from "@/lib/coaching/lifeInsuranceKnowledge";

interface RecBody {
  recentLines:   { speaker: string; text: string }[];
  discProfile?:  string | null;
  nepqPhase?:    string;
  productFocus?: string; // e.g. "mortgage_protection", "final_expense", "term_life", "iul", "whole_life"
}

export interface ProductRec {
  product:     string;   // e.g. "20-Year Mortgage Protection Term"
  productType: string;   // "Term" | "Final Expense" | "IUL" | "Whole Life" | "GUL" | "Mortgage Protection"
  reasoning:   string;   // 1-2 sentences on fit
  carriers:    string[]; // 1-2 carrier names
  keyPitch:    string;   // exact 1-sentence pitch line
}

const FOCUS_CONTEXT: Record<string, string> = {
  mortgage_protection: `AGENCY FOCUS: Mortgage Protection. This agent sells mortgage protection as their primary product. Unless the prospect has clearly stated they have no mortgage or are renting, lean toward mortgage protection term life. Frame coverage in terms of keeping the family in their home if the income earner dies. Key anchor: "If something happened to you, your family keeps the house." Preferred carriers: North American, American Amicable, Mutual of Omaha.`,
  final_expense:       `AGENCY FOCUS: Final Expense. This agent specializes in final expense whole life. Unless the prospect is clearly young and healthy (under 50), default toward final expense whole life. Frame around burial costs, not burdening the family, legacy. Key anchor: "You don't want to leave your family with a $15,000 bill." Preferred carriers: Mutual of Omaha, Foresters, American Amicable.`,
  term_life:           `AGENCY FOCUS: Term Life. This agent sells term life insurance. Recommend 10, 20, or 30-year term based on age and family situation. Frame around income replacement during working years. Preferred carriers: Banner Life, Pacific Life, Protective Life.`,
  iul:                 `AGENCY FOCUS: IUL / Living Benefits. This agent sells indexed universal life with living benefit riders. Lead toward IUL when prospect mentions retirement, saving, or has budget for permanent coverage. Key anchor: "This policy pays you while you're alive if you get seriously ill." Preferred carriers: North American, Nationwide, Athene.`,
  whole_life:          `AGENCY FOCUS: Whole Life. This agent sells whole life insurance for permanent protection and cash value. Recommended for seniors, legacy planning, or prospects wanting guaranteed cash value growth. Preferred carriers: Mutual of Omaha, Foresters, Gerber Life.`,
};

function buildSystem(productFocus?: string): string {
  const focusBlock = productFocus && FOCUS_CONTEXT[productFocus]
    ? `\n\n═══════════════════════════════════════════════════════════════\n${FOCUS_CONTEXT[productFocus]}\n═══════════════════════════════════════════════════════════════`
    : "";

  return `You are Spear, an AI sales coach for life insurance. Based on the conversation so far, recommend the single best product match for this prospect.

${LIFE_INSURANCE_KNOWLEDGE}${focusBlock}

Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation:
{
  "product": "specific product name (e.g. 20-Year Mortgage Protection Term, Final Expense Whole Life, IUL with Living Benefits)",
  "productType": "Term" | "Final Expense" | "IUL" | "Whole Life" | "GUL" | "Mortgage Protection",
  "reasoning": "1-2 sentences max. Tie the recommendation to what the prospect said AND the agency focus.",
  "carriers": ["Carrier 1", "Carrier 2"],
  "keyPitch": "Exact 1-sentence pitch line tailored to this prospect's situation and buying style."
}

If there is insufficient context (fewer than 2 meaningful prospect responses), return exactly: null`;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { recentLines = [], discProfile, nepqPhase, productFocus } = (await req.json()) as RecBody;

  const prospectLines = recentLines.filter(l => l.speaker === "prospect");
  if (prospectLines.length < 2) return NextResponse.json({ rec: null });

  const context = recentLines
    .map(l => `${l.speaker === "agent" ? "AGENT" : "PROSPECT"}: "${l.text}"`)
    .join("\n");

  const userPrompt = [
    `DISC profile: ${discProfile ?? "unknown"}`,
    `NEPQ phase: ${nepqPhase ?? "Connection"}`,
    `Agency product focus: ${productFocus ?? "general"}`,
    ``,
    `Conversation:`,
    context,
    ``,
    `What product should the agent recommend to this prospect?`,
  ].join("\n");

  try {
    const message = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:     buildSystem(productFocus),
      messages:   [{ role: "user", content: userPrompt }],
    });

    const text = (message.content[0].type === "text" ? message.content[0].text : "").trim();

    if (!text || text === "null") return NextResponse.json({ rec: null });

    const objMatch = text.match(/\{[\s\S]*\}/);
    if (!objMatch) return NextResponse.json({ rec: null });

    let rec: ProductRec;
    try { rec = JSON.parse(objMatch[0]) as ProductRec; } catch { return NextResponse.json({ rec: null }); }

    if (!rec?.product || !rec?.productType || !rec?.keyPitch) return NextResponse.json({ rec: null });
    if (!Array.isArray(rec.carriers)) rec.carriers = [];

    return NextResponse.json({ rec });
  } catch (err) {
    console.error("[Spear] product-rec threw:", err);
    return NextResponse.json({ rec: null });
  }
}
