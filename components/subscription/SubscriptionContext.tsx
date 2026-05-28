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
    const params       = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const justPurchased = params?.get("welcome") === "true";
    const sessionId     = params?.get("session_id") ?? null;

    // Always do an initial fetch
    fetchSub()
      .then(s => setState(s))
      .catch(() => setState(s => ({ ...s, loading: false })));

    if (!justPurchased) return;

    // Primary path: verify the checkout session directly with Stripe.
    // This works immediately and doesn't depend on the webhook arriving first.
    if (sessionId) {
      fetch("/api/stripe/verify-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId }),
      })
        .then(r => r.ok ? fetchSub() : Promise.reject(r.status))
        .then(s => setState(s))
        .catch(err => console.warn("[SubscriptionContext] verify-session failed:", err));
    }

    // Fallback path: poll until the webhook write lands (max 30s / 10 attempts).
    // Catches edge cases where verify-session also fails (e.g. missing service role key).
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const s = await fetchSub();
        setState(s);
        if (s.plan !== "free" || attempts >= 10) clearInterval(interval);
      } catch {
        if (attempts >= 10) clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useSubscription() {
  return useContext(Ctx);
}
