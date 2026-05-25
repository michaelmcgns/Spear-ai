import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Maps plan name → Stripe price ID (server-side only)
function getPriceId(planName: string, annual: boolean): string | undefined {
  const key = annual ? `${planName}-annual` : planName;
  const map: Record<string, string | undefined> = {
    "Agent":            process.env.STRIPE_PRICE_AGENT,
    "Agent Pro":        process.env.STRIPE_PRICE_AGENT_PRO,
    "Team":             process.env.STRIPE_PRICE_TEAM,
    // Annual — falls back to monthly price IDs until annual prices are created in Stripe
    "Agent-annual":     process.env.STRIPE_PRICE_AGENT_ANNUAL     ?? process.env.STRIPE_PRICE_AGENT,
    "Agent Pro-annual": process.env.STRIPE_PRICE_AGENT_PRO_ANNUAL ?? process.env.STRIPE_PRICE_AGENT_PRO,
    "Team-annual":      process.env.STRIPE_PRICE_TEAM_ANNUAL      ?? process.env.STRIPE_PRICE_TEAM,
  };
  return map[key];
}

export async function POST(req: NextRequest) {
  let planName: string;
  let annual: boolean;
  try {
    ({ planName, annual } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const priceId = getPriceId(planName, annual);
  if (!priceId) {
    return NextResponse.json(
      { error: `No price configured for plan: ${planName}` },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard?welcome=true`,
    cancel_url:  `${baseUrl}/#pricing`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { planName, annual: annual ? "true" : "false" },
    },
    metadata: { planName, annual: annual ? "true" : "false" },
  });

  return NextResponse.json({ url: session.url });
}
