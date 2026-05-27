import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { planFromPriceId } from "@/lib/subscription/plans";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Stripe API 2026-04-22.dahlia removed current_period_end from Subscription.
// Use billing_cycle_anchor as an approximation for the next renewal date.
function periodEnd(sub: Stripe.Subscription): string | null {
  const raw = (sub as unknown as Record<string, unknown>);
  if (typeof raw.current_period_end === "number") {
    return new Date((raw.current_period_end as number) * 1000).toISOString();
  }
  if (typeof sub.billing_cycle_anchor === "number") {
    return new Date(sub.billing_cycle_anchor * 1000).toISOString();
  }
  return null;
}

// In 2026-04-22.dahlia the subscription reference on an Invoice lives inside parent
function invoiceSubId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as Record<string, unknown>;
  if (typeof raw.subscription === "string") return raw.subscription as string;
  const parent = raw.parent as Record<string, unknown> | undefined;
  return (parent?.subscription_details as Record<string, unknown> | undefined)?.subscription as string | null ?? null;
}

async function upsertSubscription(params: {
  stripeCustomerId: string;
  stripeSubId:      string;
  plan:             string;
  status:           string;
  periodEnd:        string | null;
  customerEmail:    string | null;
  userId?:          string | null; // directly supplied from client_reference_id
}) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Stripe webhook] SUPABASE_SERVICE_ROLE_KEY not set — subscription write will fail RLS. Set it in Vercel env vars and .env.local.");
  }

  const db = createServiceClient();

  // Primary: use client_reference_id stamped at checkout (no admin API needed)
  let userId: string | null = params.userId ?? null;

  // Fallback 1: email lookup via admin API (requires service role key)
  if (!userId && params.customerEmail) {
    try {
      const { data } = await db.auth.admin.listUsers();
      const match = data?.users?.find(u => u.email === params.customerEmail);
      userId = match?.id ?? null;
      if (userId) console.log(`[Stripe webhook] User resolved via email: ${userId}`);
    } catch (err) {
      console.warn("[Stripe webhook] auth.admin.listUsers failed (likely missing service role key):", err);
    }
  }

  // Fallback 2: existing subscription record keyed by stripe_customer_id
  if (!userId) {
    const { data } = await db
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", params.stripeCustomerId)
      .single();
    userId = data?.user_id ?? null;
    if (userId) console.log(`[Stripe webhook] User resolved via stripe_customer_id: ${userId}`);
  }

  if (!userId) {
    console.error("[Stripe webhook] Cannot resolve user — no client_reference_id, email lookup failed, no existing record. email:", params.customerEmail, "customer:", params.stripeCustomerId);
    return;
  }

  const { error } = await db.from("subscriptions").upsert({
    user_id:                userId,
    stripe_customer_id:     params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubId,
    plan:                   params.plan,
    status:                 params.status,
    period_end:             params.periodEnd,
  }, { onConflict: "stripe_subscription_id" });

  if (error) {
    console.error("[Stripe webhook] Supabase upsert failed:", error);
    return;
  }

  console.log(`[Stripe] Provisioned ${userId} → ${params.plan} (${params.status})`);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  switch (event.type) {

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[Stripe webhook] checkout.session.completed — mode=${session.mode} client_reference_id=${session.client_reference_id} email=${session.customer_email}`);
      if (session.mode !== "subscription") break;

      const sub     = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = sub.items.data[0]?.price?.id ?? "";

      await upsertSubscription({
        stripeCustomerId: session.customer as string,
        stripeSubId:      sub.id,
        plan:             planFromPriceId(priceId),
        status:           sub.status,
        periodEnd:        periodEnd(sub),
        customerEmail:    session.customer_email,
        userId:           session.client_reference_id ?? null,
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub      = event.data.object as Stripe.Subscription;
      const priceId  = sub.items.data[0]?.price?.id ?? "";
      const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;

      await upsertSubscription({
        stripeCustomerId: sub.customer as string,
        stripeSubId:      sub.id,
        plan:             planFromPriceId(priceId),
        status:           sub.status,
        periodEnd:        periodEnd(sub),
        customerEmail:    customer.email ?? null,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const db  = createServiceClient();
      await db
        .from("subscriptions")
        .update({ plan: "free", status: "canceled" })
        .eq("stripe_subscription_id", sub.id);
      console.log("[Stripe] Subscription canceled:", sub.id);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId   = invoiceSubId(invoice);
      if (subId) {
        const db = createServiceClient();
        await db
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", subId);
      }
      console.log("[Stripe] Payment failed:", invoice.customer, invoice.customer_email);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
