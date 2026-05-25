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
}) {
  const db = createServiceClient();

  // Find Supabase user by email
  let userId: string | null = null;
  if (params.customerEmail) {
    const { data } = await db.auth.admin.listUsers();
    const match = data?.users?.find(u => u.email === params.customerEmail);
    userId = match?.id ?? null;
  }

  // Fallback: find by existing stripe_customer_id
  if (!userId) {
    const { data } = await db
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", params.stripeCustomerId)
      .single();
    userId = data?.user_id ?? null;
  }

  if (!userId) {
    console.warn("[Stripe webhook] No Supabase user found for", params.customerEmail, params.stripeCustomerId);
    return;
  }

  await db.from("subscriptions").upsert({
    user_id:                userId,
    stripe_customer_id:     params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubId,
    plan:                   params.plan,
    status:                 params.status,
    current_period_end:     params.periodEnd,
  }, { onConflict: "stripe_subscription_id" });

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
