"use client";

import React, { useState } from "react";
import { Lock } from "lucide-react";
import { useSubscription } from "./SubscriptionContext";
import {
  type Feature, type Plan,
  FEATURE_LABELS, FEATURE_MIN_PLAN, PLANS, planHasFeature,
} from "@/lib/subscription/plans";

const CREAM = "#B8A878";
const GOLD  = "#C9A84C";
const BG    = "#0B1221";

// Features to highlight on the locked screen for each required plan
const PLAN_HIGHLIGHTS: Record<Plan, string[]> = {
  free:       [],
  agent:      ["Real-time coaching cards", "DISC buyer profiling", "NEPQ phase tracking", "Post-call coaching report"],
  agent_pro:  ["Weekly AI performance review", "Personalized drill plan", "Skill progression tracking", "Score trend charts"],
  team:       ["Manager dashboard — all agents", "Team NEPQ leaderboard", "Objection trend analysis", "Bulk call upload"],
  enterprise: ["Custom NEPQ rubrics", "White-label option", "Unlimited seats", "Dedicated success director"],
};

interface FeatureGateProps {
  feature:  Feature;
  children: React.ReactNode;
  /** Optional custom locked UI — defaults to full overlay */
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { plan, loading } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Show nothing while loading to avoid flash
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(201,168,76,0.2)", borderTopColor: GOLD, animation: "btn-spin 0.65s linear infinite" }} />
    </div>
  );

  if (planHasFeature(plan, feature)) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  const required    = FEATURE_MIN_PLAN[feature];
  const planMeta    = PLANS[required];
  const highlights  = PLAN_HIGHLIGHTS[required];

  async function handleUpgrade() {
    setCheckoutLoading(true);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planName: planMeta.label, annual: false }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div style={{ position: "relative", minHeight: 320 }}>
      {/* Blurred preview of children */}
      <div style={{ filter: "blur(4px)", opacity: 0.25, pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>

      {/* Lock overlay */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}>
        <div style={{
          background: "rgba(11,18,33,0.96)",
          border: "1px solid rgba(201,168,76,0.2)",
          borderRadius: "16px",
          padding: "36px 32px",
          maxWidth: 400, width: "100%",
          textAlign: "center",
          boxShadow: "0 0 60px rgba(0,0,0,0.6), 0 0 40px rgba(201,168,76,0.04)",
        }}>
          {/* Lock icon */}
          <div style={{
            width: 52, height: 52, borderRadius: "12px",
            background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <Lock size={22} color={GOLD} />
          </div>

          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, marginBottom: "8px" }}>
            {planMeta.label} Plan
          </p>
          <h3 style={{ fontSize: "20px", fontWeight: 800, color: CREAM, marginBottom: "8px", letterSpacing: "-0.02em" }}>
            {FEATURE_LABELS[feature]}
          </h3>
          <p style={{ fontSize: "13px", color: "rgba(184,168,120,0.6)", lineHeight: 1.65, marginBottom: "24px" }}>
            {planMeta.description}. Upgrade to unlock this and more.
          </p>

          {/* What you unlock */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px", textAlign: "left" }}>
            {highlights.map(h => (
              <div key={h} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: GOLD, fontSize: "12px", flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: "12px", color: "rgba(184,168,120,0.8)" }}>{h}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            style={{
              width: "100%", padding: "12px",
              background: checkoutLoading ? "rgba(201,168,76,0.4)" : GOLD,
              color: "#0a1628", border: "none", borderRadius: "8px",
              fontWeight: 800, fontSize: "13px", letterSpacing: "0.06em",
              cursor: checkoutLoading ? "not-allowed" : "pointer",
              fontFamily: "var(--font-space), system-ui, sans-serif",
              transition: "opacity 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            {checkoutLoading ? (
              <>
                <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(10,22,40,0.2)", borderTopColor: "#0a1628", animation: "btn-spin 0.65s linear infinite", display: "inline-block" }} />
                Loading…
              </>
            ) : `Upgrade to ${planMeta.label} — ${planMeta.price}`}
          </button>

          <p style={{ fontSize: "11px", color: "rgba(184,168,120,0.35)", marginTop: "12px" }}>
            Cancel anytime · No contracts
          </p>
        </div>
      </div>
    </div>
  );
}

/** Inline lock badge for sidebar nav items */
export function PlanBadge({ plan }: { plan: Plan }) {
  if (plan === "free") return null;
  return (
    <span style={{
      fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em",
      padding: "2px 6px", borderRadius: "4px",
      background: plan === "team" ? "rgba(37,99,235,0.3)" : "rgba(201,168,76,0.25)",
      color: plan === "team" ? "#FFFFFF" : "#FFFFFF",
      border: `1px solid ${plan === "team" ? "rgba(96,165,250,0.5)" : "rgba(201,168,76,0.5)"}`,
      textTransform: "uppercase" as const,
      marginLeft: "auto",
    }}>
      {PLANS[plan].label}
    </span>
  );
}
