import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { planFromPriceId } from "@/lib/subscription/plans";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /api/stripe/verify-session
 *
 * Called by the client immediately after a Stripe checkout redirect.
 * Retrieves the completed session directly from Stripe and upserts the
 * subscription into Supabase — so the user is unblocked even if the
 * webhook is slow or misconfigured.
 *
 * Body: { sessionId: string }
 */
export async function POST(req: NextRequest) {
  let sessionId: string;
  try {
    ({ sessionId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error("[verify-session] Failed to retrieve session:", err);
    return NextResponse.json({ error: "Could not retrieve session" }, { status: 400 });
  }

  // Only process completed subscription checkouts
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return NextResponse.json({ error: "Session not yet complete" }, { status: 202 });
  }
  if (session.mode !== "subscription") {
    return NextResponse.json({ error: "Not a subscription session" }, { status: 400 });
  }

  const subId = session.subscription as string;
  if (!subId) {
    return NextResponse.json({ error: "No subscription on session" }, { status: 400 });
  }

  const sub     = await stripe.subscriptions.retrieve(subId);
  const priceId = sub.items.data[0]?.price?.id ?? "";
  const plan    = planFromPriceId(priceId);

  // Resolve user — prefer client_reference_id stamped at checkout creation
  let userId: string | null = session.client_reference_id ?? null;

  const db = createServiceClient();

  // Fallback: email lookup via admin API
  if (!userId && session.customer_email) {
    try {
      const { data } = await db.auth.admin.listUsers();
      const match = data?.users?.find(u => u.email === session.customer_email);
      userId = match?.id ?? null;
    } catch {
      // Will fail without service role key — handled below
    }
  }

  if (!userId) {
    console.error("[verify-session] Cannot resolve user for session", sessionId);
    return NextResponse.json({ error: "Cannot resolve user" }, { status: 422 });
  }

  const { error } = await db.from("subscriptions").upsert({
    user_id:                userId,
    stripe_customer_id:     session.customer as string,
    stripe_subscription_id: sub.id,
    plan,
    status:                 sub.status,
    period_end:             null,
  }, { onConflict: "stripe_subscription_id" });

  if (error) {
    console.error("[verify-session] Supabase upsert failed:", error);
    return NextResponse.json({ error: "DB write failed" }, { status: 500 });
  }

  console.log(`[verify-session] Activated ${userId} → ${plan}`);
  return NextResponse.json({ plan, status: sub.status });
}
