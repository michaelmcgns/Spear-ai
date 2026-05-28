import { NextResponse } from "next/server";
import { getUserSubscription } from "@/lib/subscription/server";
import { PLANS, planHasFeature, type Feature } from "@/lib/subscription/plans";

export async function GET() {
  const sub = await getUserSubscription();
  const features = PLANS[sub.plan].features as Feature[];

  return NextResponse.json({
    plan:             sub.plan,
    status:           sub.status,
    features,
    currentPeriodEnd: sub.currentPeriodEnd,
  });
}
