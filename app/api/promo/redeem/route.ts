/**
 * POST /api/promo/redeem
 * Validates a promo code and grants the user a free subscription.
 *
 * To add/change promo codes, edit the PROMO_CODES object below.
 * Each code maps to { plan, label, durationDays }.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const PROMO_CODES: Record<string, { plan: string; label: string; durationDays: number }> = {
  // Add your promo codes here — key is the code (case-insensitive)
  "SPEAR30":   { plan: "agent",     label: "Agent (30-day free trial)", durationDays: 30 },
  "SPEARFREE": { plan: "agent",     label: "Agent (free access)",       durationDays: 365 },
  "SPEARPRO":  { plan: "agent_pro", label: "Agent Pro (30-day trial)",  durationDays: 30 },
  "SPEARTEAM": { plan: "team",      label: "Team (30-day trial)",       durationDays: 30 },
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const { code } = await req.json() as { code?: string };
  if (!code?.trim()) return NextResponse.json({ error: "Enter a promo code." }, { status: 400 });

  const promo = PROMO_CODES[code.trim().toUpperCase()];
  if (!promo) return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });

  const db = createServiceClient();

  // Check if already redeemed — one promo per user
  const { data: existing } = await db
    .from("subscriptions")
    .select("id, plan")
    .eq("user_id", user.id)
    .eq("promo_code", code.trim().toUpperCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You've already redeemed this code." }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + promo.durationDays * 24 * 60 * 60 * 1000);

  // Upsert — if user has an existing sub from a promo, replace it
  const { error } = await db.from("subscriptions").upsert({
    user_id:    user.id,
    plan:       promo.plan,
    status:     "active",
    promo_code: code.trim().toUpperCase(),
    current_period_end: expiresAt.toISOString(),
    stripe_customer_id:      null,
    stripe_subscription_id:  null,
    updated_at: now.toISOString(),
  }, { onConflict: "user_id" });

  if (error) {
    console.error("[promo/redeem] DB error:", error.message);
    return NextResponse.json({ error: "Failed to apply promo. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan: promo.plan, label: promo.label, durationDays: promo.durationDays });
}
