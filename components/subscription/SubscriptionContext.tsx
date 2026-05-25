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

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubscriptionState>(DEFAULT);

  useEffect(() => {
    fetch("/api/subscription")
      .then(r => r.json())
      .then(data => {
        const plan = (data.plan ?? "free") as Plan;
        setState({
          plan,
          status:           data.status           ?? "inactive",
          features:         data.features         ?? [],
          currentPeriodEnd: data.currentPeriodEnd ?? null,
          loading:          false,
          hasFeature:       (f: Feature) => planHasFeature(plan, f),
        });
      })
      .catch(() => setState(s => ({ ...s, loading: false })));
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useSubscription() {
  return useContext(Ctx);
}
