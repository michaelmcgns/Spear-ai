"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { planHasFeature, type Plan, type Feature } from "@/lib/subscription/plans";

interface SubscriptionState {
  plan:             Plan;
  status:           string;
  features:         Feature[];
  currentPeriodEnd: string | null;
  loading:          boolean;
  hasFeature:       (f: Feature) => boolean;
}

const DEFAULT: SubscriptionState = {
  plan: "free", status: "inactive", features: [],
  currentPeriodEnd: null, loading: true,
  hasFeature: () => false,
};

const Ctx = createContext<SubscriptionState>(DEFAULT);

async function fetchSub(): Promise<SubscriptionState> {
  const data = await fetch("/api/subscription").then(r => r.json());
  const plan = (data.plan ?? "free") as Plan;
  return {
    plan,
    status:           data.status           ?? "inactive",
    features:         data.features         ?? [],
    currentPeriodEnd: data.currentPeriodEnd ?? null,
    loading:          false,
    hasFeature:       (f: Feature) => planHasFeature(plan, f),
  };
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubscriptionState>(DEFAULT);

  useEffect(() => {
    // Check if we just returned from a Stripe checkout
    const justPurchased = typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("welcome") === "true";

    fetchSub()
      .then(s => setState(s))
      .catch(() => setState(s => ({ ...s, loading: false })));

    // Webhook fires async after redirect — poll until plan upgrades (max 12s)
    if (justPurchased) {
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const s = await fetchSub();
          setState(s);
          if (s.plan !== "free" || attempts >= 6) clearInterval(interval);
        } catch {
          if (attempts >= 6) clearInterval(interval);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useSubscription() {
  return useContext(Ctx);
}
