import { createClient } from "@/lib/supabase/server";
import { planHasFeature, type Plan, type Feature } from "./plans";

export interface UserSubscription {
  plan:               Plan;
  status:             string;
  stripeCustomerId:   string | null;
  stripeSubId:        string | null;
  currentPeriodEnd:   string | null;
}

const FREE: UserSubscription = {
  plan: "free", status: "inactive",
  stripeCustomerId: null, stripeSubId: null, currentPeriodEnd: null,
};

export async function getUserSubscription(): Promise<UserSubscription> {
  // Dev bypass — give full team access so nothing is locked locally
  if (process.env.NEXT_PUBLIC_BYPASS_AUTH === "true") {
    return { plan: "team", status: "active", stripeCustomerId: null, stripeSubId: null, currentPeriodEnd: null };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return FREE;

    const { data } = await supabase
      .from("subscriptions")
      .select("plan, status, stripe_customer_id, stripe_subscription_id, current_period_end")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return FREE;

    return {
      plan:             (data.plan ?? "free")    as Plan,
      status:           data.status ?? "inactive",
      stripeCustomerId: data.stripe_customer_id  ?? null,
      stripeSubId:      data.stripe_subscription_id ?? null,
      currentPeriodEnd: (data as Record<string, unknown>).current_period_end as string ?? null,
    };
  } catch {
    return FREE;
  }
}

export async function getUserPlan(): Promise<Plan> {
  const sub = await getUserSubscription();
  return sub.plan;
}

export async function requireFeature(feature: Feature): Promise<boolean> {
  const plan = await getUserPlan();
  return planHasFeature(plan, feature);
}
