import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

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

  // Stamp the user's Supabase ID so the webhook can link the purchase without
  // relying on email lookup (which requires service role key).
  let userId: string | undefined;
  let customerEmail: string | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
    customerEmail = user?.email ?? undefined;
  } catch {
    // Best-effort — checkout still works; webhook falls back to email lookup
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard?welcome=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${baseUrl}/#pricing`,
    allow_promotion_codes: true,
    ...(customerEmail && { customer_email: customerEmail }),
    ...(userId        && { client_reference_id: userId }),
    subscription_data: {
      metadata: { planName, annual: annual ? "true" : "false" },
    },
    metadata: { planName, annual: annual ? "true" : "false" },
  });

  return NextResponse.json({ url: session.url });
}
