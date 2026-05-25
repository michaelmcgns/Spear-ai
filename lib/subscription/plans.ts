export type Plan = "free" | "agent" | "agent_pro" | "team" | "enterprise";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive";

export type Feature =
  // Agent ($97) — core coaching
  | "live_call"
  | "call_upload"
  | "post_call_report"
  | "call_history"
  | "analytics"
  | "coaching_hub"
  // Agent Pro ($197) — AI learning layer
  | "weekly_review"
  | "drill_plan"
  | "skill_progression"
  | "score_trends"
  | "ai_feedback"
  | "learning_profile"
  | "ghl_integration"
  // Team ($497) — manager visibility
  | "agents_tab"
  | "manager_dashboard"
  | "team_leaderboard"
  | "objection_trends"
  | "bulk_upload"
  | "zapier_integration"
  // Enterprise — custom
  | "custom_rubrics"
  | "white_label"
  | "api_access";

export interface PlanMeta {
  label:       string;
  price:       string;
  priceId:     string;
  description: string;
  features:    Feature[];
}

// Cumulative — each plan includes all features from plans below it
const AGENT_FEATURES: Feature[] = [
  "live_call", "call_upload", "post_call_report",
  "call_history", "analytics", "coaching_hub",
];

const AGENT_PRO_FEATURES: Feature[] = [
  ...AGENT_FEATURES,
  "weekly_review", "drill_plan", "skill_progression",
  "score_trends", "ai_feedback", "learning_profile",
  "ghl_integration",
];

const TEAM_FEATURES: Feature[] = [
  ...AGENT_PRO_FEATURES,
  "agents_tab", "manager_dashboard", "team_leaderboard",
  "objection_trends", "bulk_upload", "zapier_integration",
];

const ENTERPRISE_FEATURES: Feature[] = [
  ...TEAM_FEATURES,
  "custom_rubrics", "white_label", "api_access",
];

export const PLANS: Record<Plan, PlanMeta> = {
  free: {
    label:       "Free",
    price:       "$0",
    priceId:     "",
    description: "No active subscription",
    features:    [],
  },
  agent: {
    label:       "Agent",
    price:       "$97/mo",
    priceId:     process.env.STRIPE_PRICE_AGENT ?? "",
    description: "Core coaching for solo producers",
    features:    AGENT_FEATURES,
  },
  agent_pro: {
    label:       "Agent Pro",
    price:       "$197/mo",
    priceId:     process.env.STRIPE_PRICE_AGENT_PRO ?? "",
    description: "AI learning layer for compounding skills",
    features:    AGENT_PRO_FEATURES,
  },
  team: {
    label:       "Team",
    price:       "$497/mo",
    priceId:     process.env.STRIPE_PRICE_TEAM ?? "",
    description: "Manager visibility across the whole team",
    features:    TEAM_FEATURES,
  },
  enterprise: {
    label:       "Enterprise",
    price:       "Custom",
    priceId:     "",
    description: "Custom rubrics, white-label, unlimited seats",
    features:    ENTERPRISE_FEATURES,
  },
};

// What each locked feature displays as an upgrade reason
export const FEATURE_LABELS: Record<Feature, string> = {
  live_call:          "Live Call Coaching",
  call_upload:        "Call Upload & Analysis",
  post_call_report:   "Post-Call Coaching Report",
  call_history:       "Call History",
  analytics:          "Performance Analytics",
  coaching_hub:       "Coaching Hub",
  weekly_review:      "Weekly AI Performance Review",
  drill_plan:         "Personalized Drill Plan",
  skill_progression:  "Skill Progression Tracking",
  score_trends:       "Score Trend Charts",
  ai_feedback:        "Thumbs Up/Down AI Training",
  learning_profile:   "Agent Learning Profile",
  ghl_integration:    "GoHighLevel CRM Integration",
  agents_tab:         "Agents Dashboard",
  manager_dashboard:  "Manager Dashboard",
  team_leaderboard:   "Team NEPQ Leaderboard",
  objection_trends:   "Objection Trend Analysis",
  bulk_upload:        "Bulk Call Upload",
  zapier_integration: "Zapier Integration",
  custom_rubrics:     "Custom NEPQ Rubrics",
  white_label:        "White-Label Option",
  api_access:         "API Access",
};

// Minimum plan required for each feature
export const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  live_call:          "agent",
  call_upload:        "agent",
  post_call_report:   "agent",
  call_history:       "agent",
  analytics:          "agent",
  coaching_hub:       "agent",
  weekly_review:      "agent_pro",
  drill_plan:         "agent_pro",
  skill_progression:  "agent_pro",
  score_trends:       "agent_pro",
  ai_feedback:        "agent_pro",
  learning_profile:   "agent_pro",
  ghl_integration:    "agent_pro",
  agents_tab:         "team",
  manager_dashboard:  "team",
  team_leaderboard:   "team",
  objection_trends:   "team",
  bulk_upload:        "team",
  zapier_integration: "team",
  custom_rubrics:     "enterprise",
  white_label:        "enterprise",
  api_access:         "enterprise",
};

const PLAN_ORDER: Plan[] = ["free", "agent", "agent_pro", "team", "enterprise"];

export function planHasFeature(plan: Plan, feature: Feature): boolean {
  return PLANS[plan].features.includes(feature);
}

export function planRank(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan);
}

// Map Stripe price ID → plan name
export function planFromPriceId(priceId: string): Plan {
  const map: Record<string, Plan> = {
    [process.env.STRIPE_PRICE_AGENT      ?? ""]: "agent",
    [process.env.STRIPE_PRICE_AGENT_PRO  ?? ""]: "agent_pro",
    [process.env.STRIPE_PRICE_AGENT_ANNUAL     ?? ""]: "agent",
    [process.env.STRIPE_PRICE_AGENT_PRO_ANNUAL ?? ""]: "agent_pro",
    [process.env.STRIPE_PRICE_TEAM       ?? ""]: "team",
    [process.env.STRIPE_PRICE_TEAM_ANNUAL      ?? ""]: "team",
  };
  return map[priceId] ?? "free";
}
