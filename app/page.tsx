"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useInView, AnimatePresence, type Variants } from "framer-motion";

// ─── Palette ──────────────────────────────────────────────────────────────────

const BG        = "#050A14";
const BG_CARD   = "#080F1E";
const CREAM     = "#FDF6EC";
const CREAM_DIM = "#FDF6EC";
const BLUE      = "#2563EB";
const BLUE_LIGHT = "#3B82F6";
const GOLD      = "#C9A84C";
const WARM_GRAY = "#FDF6EC";
const DIVIDER   = "rgba(37,99,235,0.14)";

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE } },
};

const stagger: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const cardEnter: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

// ─── Scroll reveal ────────────────────────────────────────────────────────────

function Reveal({
  children, delay = 0, variants = fadeUp, className = "", style = {},
}: {
  children: React.ReactNode; delay?: number; variants?: Variants;
  className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const v = delay
    ? { ...variants, visible: { ...variants.visible, transition: { ...((variants.visible as { transition?: object }).transition ?? {}), delay } } }
    : variants;
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={v} className={className} style={style}>
      {children}
    </motion.div>
  );
}

function StaggerReveal({ children, className = "", style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={stagger} className={className} style={style}>
      {children}
    </motion.div>
  );
}

// ─── LiveCallCard ─────────────────────────────────────────────────────────────

const COACHING_CARDS = [
  {
    type: "OBJECTION DETECTED",
    typeColor: "#EF4444",
    quote: '"I need to think about it"',
    disc: "DISC Profile: S — Steady Buyer",
    fear: "Fear: Change.  Needs: Safety + Trust.",
    response: '"I totally get that — what specifically did you want to think through? Is it the coverage itself, the cost, or something else?"',
    phase: "NEPQ Phase: Consequence Questions ⚡",
    next: "Next move: Surface the cost of inaction",
  },
  {
    type: "PHASE ALERT",
    typeColor: "#F59E0B",
    quote: '"We already have coverage through work"',
    disc: "DISC Profile: D — Dominant Buyer",
    fear: "Fear: Losing control.  Needs: Logic + Data.",
    response: '"That\'s great — most employer plans cover 1–2× salary. If you passed away tonight, how long would that last your family?"',
    phase: "NEPQ Phase: Problem Awareness ⚡",
    next: "Next move: Quantify the gap",
  },
  {
    type: "OBJECTION DETECTED",
    typeColor: "#EF4444",
    quote: '"The price is too high"',
    disc: "DISC Profile: C — Conscientious Buyer",
    fear: "Fear: Making a mistake.  Needs: Proof + Details.",
    response: '"Compared to what? The premium is $4 a day — what\'s peace of mind for your family worth to you?"',
    phase: "NEPQ Phase: Qualifying ⚡",
    next: "Next move: Anchor to consequence",
  },
];

function LiveCallCard() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % COACHING_CARDS.length); setVisible(true); }, 420);
    }, 5200);
    return () => clearInterval(id);
  }, []);

  const card = COACHING_CARDS[idx];

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "400px" }}>
      {/* Glow halo */}
      <div style={{
        position: "absolute", inset: -2, borderRadius: "16px",
        background: `linear-gradient(135deg, rgba(37,99,235,0.35), rgba(201,168,76,0.15))`,
        filter: "blur(20px)", opacity: 0.8, pointerEvents: "none",
      }} />

      <div style={{
        position: "relative",
        backgroundColor: "rgba(8,15,30,0.92)",
        border: `1px solid rgba(37,99,235,0.45)`,
        borderRadius: "12px",
        padding: "22px",
        backdropFilter: "blur(24px)",
        boxShadow: `0 0 48px rgba(37,99,235,0.18), 0 24px 64px rgba(0,0,0,0.6)`,
      }}>
        {/* Card header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <span style={{ fontSize: "10px", letterSpacing: "0.18em", color: WARM_GRAY, textTransform: "uppercase" }}>Spear AI</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <motion.div
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22C55E", boxShadow: "0 0 8px #22C55E" }}
            />
            <span style={{ fontSize: "9px", letterSpacing: "0.22em", color: "#22C55E", textTransform: "uppercase", fontWeight: 700 }}>LIVE</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {visible && (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.38, ease: EASE }}
            >
              {/* Type badge */}
              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "10px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: card.typeColor, boxShadow: `0 0 6px ${card.typeColor}` }} />
                <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", color: card.typeColor, textTransform: "uppercase" }}>{card.type}</span>
              </div>

              {/* Quote */}
              <p style={{ fontSize: "15px", fontWeight: 600, color: CREAM, fontStyle: "italic", lineHeight: 1.4, marginBottom: "16px" }}>
                {card.quote}
              </p>

              <div style={{ height: 1, backgroundColor: DIVIDER, marginBottom: "14px" }} />

              {/* DISC */}
              <div style={{ marginBottom: "14px" }}>
                <p style={{ fontSize: "11px", color: CREAM_DIM, fontWeight: 600, marginBottom: "3px" }}>{card.disc}</p>
                <p style={{ fontSize: "11px", color: CREAM_DIM }}>{card.fear}</p>
              </div>

              {/* Suggested response */}
              <div style={{
                backgroundColor: "rgba(37,99,235,0.08)",
                border: `1px solid rgba(37,99,235,0.22)`,
                borderRadius: "8px", padding: "12px 14px", marginBottom: "14px",
              }}>
                <p style={{ fontSize: "9px", letterSpacing: "0.18em", color: CREAM_DIM, textTransform: "uppercase", fontWeight: 700, marginBottom: "7px" }}>
                  SUGGESTED RESPONSE
                </p>
                <p style={{ fontSize: "12px", color: CREAM, lineHeight: 1.65, fontStyle: "italic" }}>{card.response}</p>
              </div>

              {/* Phase + next */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <p style={{ fontSize: "11px", color: CREAM, fontWeight: 600 }}>{card.phase}</p>
                <p style={{ fontSize: "11px", color: WARM_GRAY, paddingLeft: "2px" }}>{card.next}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── How It Works Step ────────────────────────────────────────────────────────

function HowStep({ number, icon, title, body }: { number: string; icon: string; title: string; body: string }) {
  return (
    <motion.div variants={cardEnter} style={{ textAlign: "center", padding: "0 12px" }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        backgroundColor: "rgba(37,99,235,0.1)",
        border: `1px solid rgba(37,99,235,0.3)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "26px", margin: "0 auto 20px",
        boxShadow: `0 0 28px rgba(37,99,235,0.14)`,
      }}>
        {icon}
      </div>
      <p style={{ fontSize: "10px", letterSpacing: "0.25em", color: CREAM_DIM, textTransform: "uppercase", fontWeight: 600, marginBottom: "10px" }}>
        Step {number}
      </p>
      <p style={{ fontSize: "17px", fontWeight: 700, color: CREAM, marginBottom: "12px", lineHeight: 1.3 }}>{title}</p>
      <p style={{ fontSize: "13px", color: CREAM_DIM, lineHeight: 1.75 }}>{body}</p>
    </motion.div>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <motion.div
      variants={cardEnter}
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
      style={{
        padding: "28px 24px",
        backgroundColor: BG_CARD,
        border: `1px solid rgba(37,99,235,0.12)`,
        borderTop: `2px solid ${BLUE}`,
        borderRadius: "4px",
      }}
    >
      <div style={{ fontSize: "24px", marginBottom: "14px" }}>{icon}</div>
      <p style={{ fontSize: "15px", fontWeight: 700, color: CREAM, marginBottom: "10px", lineHeight: 1.3 }}>{title}</p>
      <p style={{ fontSize: "13px", color: CREAM_DIM, lineHeight: 1.75 }}>{description}</p>
    </motion.div>
  );
}

// ─── Pricing Card ─────────────────────────────────────────────────────────────

interface PricingTier {
  name: string;
  badge?: string;
  popular?: boolean;
  tagline: string;
  monthlyPrice: string;
  annualPrice: string;
  annualBilled: string;
  annualSavings: string;
  features: { text: string; inherit?: boolean }[];
  cta: string;
  ctaVariant: "outline" | "solid";
}

function PricingCard({ tier, annual, onCTA }: { tier: PricingTier; annual: boolean; onCTA: () => void }) {
  const isPopular = !!tier.popular;
  const isCustom = tier.monthlyPrice === "Custom";
  const price = annual ? tier.annualPrice : tier.monthlyPrice;

  return (
    <motion.div
      variants={cardEnter}
      style={{
        position: "relative",
        display: "flex", flexDirection: "column",
        padding: "32px 28px",
        backgroundColor: BG_CARD,
        border: isPopular ? `1px solid rgba(37,99,235,0.5)` : `1px solid rgba(37,99,235,0.12)`,
        borderRadius: "8px",
        boxShadow: isPopular ? `0 0 48px rgba(37,99,235,0.15), 0 20px 60px rgba(0,0,0,0.4)` : "none",
        transform: isPopular ? "scale(1.03)" : "scale(1)",
      }}
    >
      {/* Top accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", borderRadius: "8px 8px 0 0", backgroundColor: isPopular ? BLUE : `rgba(37,99,235,0.25)` }} />

      {/* Popular badge */}
      {isPopular && (
        <div style={{
          position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
          backgroundColor: GOLD, color: BG, fontSize: "9px", fontWeight: 800,
          letterSpacing: "0.18em", padding: "4px 14px", borderRadius: "20px",
          textTransform: "uppercase", whiteSpace: "nowrap",
        }}>
          ⭐ Most Popular
        </div>
      )}

      {/* Tier badge */}
      {tier.badge && (
        <div style={{
          display: "inline-block", marginBottom: "12px",
          backgroundColor: "rgba(37,99,235,0.1)", border: `1px solid rgba(37,99,235,0.2)`,
          borderRadius: "20px", padding: "3px 12px",
          fontSize: "10px", color: CREAM_DIM, letterSpacing: "0.1em",
        }}>
          {tier.badge}
        </div>
      )}

      {/* Name */}
      <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: WARM_GRAY, marginBottom: "6px" }}>
        {tier.name}
      </p>

      {/* Price block */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" }}>
        <AnimatePresence mode="wait">
          <motion.span
            key={price}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            style={{ fontFamily: "var(--font-space)", fontSize: "42px", fontWeight: 800, color: CREAM, lineHeight: 1, letterSpacing: "-0.03em" }}
          >
            {price}
          </motion.span>
        </AnimatePresence>
        {!isCustom && <span style={{ fontSize: "13px", color: WARM_GRAY }}>/mo</span>}
      </div>

      {/* Billing line + savings badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "22px", marginBottom: "16px" }}>
        {annual && !isCustom ? (
          <>
            <span style={{ fontSize: "11px", color: WARM_GRAY }}>Billed {tier.annualBilled}/yr</span>
            <AnimatePresence>
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{
                  fontSize: "9px", fontWeight: 800, letterSpacing: "0.1em",
                  color: "#16A34A", backgroundColor: "rgba(22,163,74,0.12)",
                  border: "1px solid rgba(22,163,74,0.3)",
                  borderRadius: "20px", padding: "2px 8px",
                }}
              >
                Save {tier.annualSavings}/yr
              </motion.span>
            </AnimatePresence>
          </>
        ) : !isCustom ? (
          <span style={{ fontSize: "11px", color: WARM_GRAY }}>per month, cancel anytime</span>
        ) : (
          <span style={{ fontSize: "11px", color: WARM_GRAY }}>Tailored to your team size</span>
        )}
      </div>

      {/* Tagline */}
      <p style={{ fontSize: "13px", color: CREAM_DIM, lineHeight: 1.6, marginBottom: "22px" }}>{tier.tagline}</p>

      <div style={{ height: 1, backgroundColor: `rgba(37,99,235,0.12)`, marginBottom: "22px" }} />

      {/* Features */}
      <ul style={{ display: "flex", flexDirection: "column", gap: "11px", flex: 1, marginBottom: "28px" }}>
        {tier.features.map((f, i) => (
          <li key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <span style={{ color: f.inherit ? WARM_GRAY : BLUE_LIGHT, flexShrink: 0, fontWeight: 700, marginTop: "1px", fontSize: "12px" }}>
              {f.inherit ? "↳" : "✓"}
            </span>
            <span style={{ fontSize: "12.5px", color: f.inherit ? WARM_GRAY : CREAM_DIM, lineHeight: 1.55, fontStyle: f.inherit ? "italic" : "normal" }}>
              {f.text}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <motion.button
        onClick={onCTA}
        whileHover={{ scale: 1.02, boxShadow: tier.ctaVariant === "solid" ? `0 0 28px rgba(37,99,235,0.4)` : `0 0 20px rgba(255,255,255,0.06)` }}
        whileTap={{ scale: 0.98 }}
        style={{
          width: "100%", padding: "13px 0", fontSize: "13px", fontWeight: 700,
          letterSpacing: "0.06em", cursor: "pointer", borderRadius: "6px",
          fontFamily: "var(--font-space)", border: "none",
          backgroundColor: tier.ctaVariant === "solid" ? BLUE : "transparent",
          color: CREAM,
          outline: tier.ctaVariant === "outline" ? `1px solid rgba(255,255,255,0.18)` : "none",
          transition: "background-color 0.2s",
        }}
      >
        {tier.cta}
      </motion.button>
    </motion.div>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

const COMPARISON_ROWS: { category: string; feature: string; agent: string | boolean; pro: string | boolean; team: string | boolean; enterprise: string | boolean }[] = [
  { category: "Live Coaching", feature: "Real-time coaching cards",           agent: true,        pro: true,         team: true,         enterprise: true },
  { category: "Live Coaching", feature: "Live objection detection",           agent: true,        pro: true,         team: true,         enterprise: true },
  { category: "Live Coaching", feature: "DISC buyer psychology profiling",    agent: true,        pro: true,         team: true,         enterprise: true },
  { category: "Live Coaching", feature: "NEPQ phase tracking (all 7 phases)", agent: true,        pro: true,         team: true,         enterprise: true },
  { category: "Live Coaching", feature: "Talk ratio monitor + alerts",        agent: true,        pro: true,         team: true,         enterprise: true },
  { category: "Post-Call",     feature: "Post-call coaching report",          agent: true,        pro: true,         team: true,         enterprise: true },
  { category: "Post-Call",     feature: "Full call transcription",            agent: true,        pro: true,         team: true,         enterprise: true },
  { category: "Post-Call",     feature: "Objection log with ideal responses", agent: true,        pro: true,         team: true,         enterprise: true },
  { category: "AI Learning",   feature: "Weekly AI performance review",       agent: false,       pro: true,         team: true,         enterprise: true },
  { category: "AI Learning",   feature: "Personalized drill plan",            agent: false,       pro: true,         team: true,         enterprise: true },
  { category: "AI Learning",   feature: "Skill progression tracking",         agent: false,       pro: true,         team: true,         enterprise: true },
  { category: "AI Learning",   feature: "Score trend charts",                 agent: false,       pro: true,         team: true,         enterprise: true },
  { category: "AI Learning",   feature: "Thumbs up/down to train AI",         agent: false,       pro: true,         team: true,         enterprise: true },
  { category: "AI Learning",   feature: "Agent learning profile",             agent: false,       pro: true,         team: true,         enterprise: true },
  { category: "Team",          feature: "Manager dashboard",                  agent: false,       pro: false,        team: true,         enterprise: true },
  { category: "Team",          feature: "Team NEPQ leaderboard",              agent: false,       pro: false,        team: true,         enterprise: true },
  { category: "Team",          feature: "Objection trend analysis",           agent: false,       pro: false,        team: true,         enterprise: true },
  { category: "Team",          feature: "Bulk call upload",                   agent: false,       pro: false,        team: true,         enterprise: true },
  { category: "Team",          feature: "Agent seats",                        agent: "1",         pro: "1",          team: "Up to 10",   enterprise: "Unlimited" },
  { category: "Enterprise",    feature: "Custom NEPQ rubrics",                agent: false,       pro: false,        team: false,        enterprise: true },
  { category: "Enterprise",    feature: "White-label option",                 agent: false,       pro: false,        team: false,        enterprise: true },
  { category: "Enterprise",    feature: "API access",                         agent: false,       pro: false,        team: false,        enterprise: true },
  { category: "Enterprise",    feature: "Custom CRM integrations",            agent: false,       pro: false,        team: false,        enterprise: true },
  { category: "Enterprise",    feature: "Dedicated success director",         agent: false,       pro: false,        team: false,        enterprise: true },
  { category: "Support",       feature: "Support",                            agent: "Email",     pro: "Priority",   team: "Slack",      enterprise: "Dedicated" },
];

function CellValue({ val }: { val: string | boolean }) {
  if (val === true)  return <span style={{ color: "#22C55E", fontSize: "15px", fontWeight: 700 }}>✓</span>;
  if (val === false) return <span style={{ color: "rgba(255,255,255,0.12)", fontSize: "15px" }}>—</span>;
  return <span style={{ fontSize: "11px", fontWeight: 600, color: CREAM_DIM }}>{val}</span>;
}

function ComparisonTable() {
  const [open, setOpen] = useState(false);
  const categories = Array.from(new Set(COMPARISON_ROWS.map(r => r.category)));
  const COL_HEADS = ["Agent", "Agent Pro", "Team", "Enterprise"];

  return (
    <div style={{ marginTop: "48px" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <motion.button
          onClick={() => setOpen(o => !o)}
          whileHover={{ backgroundColor: "rgba(37,99,235,0.08)" }}
          whileTap={{ scale: 0.98 }}
          style={{
            background: "none", border: `1px solid rgba(37,99,235,0.22)`,
            borderRadius: "6px", padding: "10px 28px",
            fontSize: "12px", fontWeight: 700, color: CREAM_DIM,
            letterSpacing: "0.1em", cursor: "pointer",
            fontFamily: "var(--font-space)", display: "inline-flex",
            alignItems: "center", gap: "8px", transition: "background-color 0.2s",
          }}
        >
          {open ? "Hide" : "Compare all features"}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }} style={{ display: "inline-block", fontSize: "10px" }}>▼</motion.span>
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                {/* Header */}
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", color: WARM_GRAY, fontWeight: 600, width: "34%", borderBottom: `1px solid rgba(37,99,235,0.12)` }}>Feature</th>
                    {COL_HEADS.map((h, i) => (
                      <th key={h} style={{
                        textAlign: "center", padding: "12px 8px",
                        fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em",
                        color: i === 1 ? BLUE_LIGHT : WARM_GRAY,
                        textTransform: "uppercase",
                        borderBottom: `1px solid rgba(37,99,235,0.12)`,
                        borderLeft: `1px solid rgba(37,99,235,0.06)`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <>
                      <tr key={`cat-${cat}`}>
                        <td colSpan={5} style={{ padding: "18px 16px 8px", fontSize: "9px", fontWeight: 800, letterSpacing: "0.22em", color: WARM_GRAY, textTransform: "uppercase" }}>{cat}</td>
                      </tr>
                      {COMPARISON_ROWS.filter(r => r.category === cat).map((row, ri) => (
                        <tr
                          key={`${cat}-${ri}`}
                          style={{ backgroundColor: ri % 2 === 0 ? "rgba(37,99,235,0.02)" : "transparent" }}
                        >
                          <td style={{ padding: "11px 16px", color: CREAM_DIM, borderBottom: `1px solid rgba(37,99,235,0.06)` }}>{row.feature}</td>
                          {([row.agent, row.pro, row.team, row.enterprise] as (string | boolean)[]).map((val, ci) => (
                            <td key={ci} style={{ textAlign: "center", padding: "11px 8px", borderBottom: `1px solid rgba(37,99,235,0.06)`, borderLeft: `1px solid rgba(37,99,235,0.06)`, backgroundColor: ci === 1 ? "rgba(37,99,235,0.04)" : "transparent" }}>
                              <CellValue val={val} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    number: "01", icon: "📞", title: "Your Call Starts",
    body: "Spear connects to your call. Whether you're selling IUL, term, or whole life — it's listening from the first word.",
  },
  {
    number: "02", icon: "🧠", title: "Spear Reads the Room",
    body: "It identifies your prospect's DISC personality, tracks your NEPQ phase, and catches every price, spouse, timing, and trust objection word for word.",
  },
  {
    number: "03", icon: "⚡", title: "You Get the Edge",
    body: "The right question, the right reframe, the right close appears on your screen instantly — before the moment passes.",
  },
];

const FEATURES = [
  {
    icon: "🚨", title: "Live Objection Detection",
    description: "Spear catches the four objections that kill 80% of life insurance sales — price, spouse, think about it, and timing — the moment they're spoken. You get the ideal NEPQ response before you even finish processing what they said.",
  },
  {
    icon: "🧠", title: "DISC Buyer Psychology",
    description: "Every prospect is profiled in real time. Whether your prospect is a skeptical C-type who needs numbers or a loyal S-type who needs safety and family protection, Spear adjusts its coaching to match how they think.",
  },
  {
    icon: "🎯", title: "NEPQ Phase Guidance",
    description: "Spear tracks all 7 NEPQ phases from connection through close. If you're pitching before they feel the problem, it tells you. If you're skipping consequence questions, it flags it.",
  },
  {
    icon: "⚡", title: "Real-Time Coaching Cards",
    description: "Suggested questions, reframes, and responses appear on your screen mid-call — timed to the conversation, not delivered after it's too late.",
  },
  {
    icon: "📊", title: "Talk Ratio Monitor",
    description: "A live indicator shows your agent-to-prospect talk ratio. If you're over 40%, Spear surfaces a prompt to stop talking and ask a question.",
  },
  {
    icon: "📋", title: "Post-Call Report",
    description: "After the call ends, Spear generates a full coaching report: NEPQ phase scores, DISC profile, objection log, talk ratio, top 3 strengths, top 3 improvements, and your one focus drill.",
  },
];

const PRICING: PricingTier[] = [
  {
    name: "Agent",
    tagline: "For the solo producer grinding to close more.",
    monthlyPrice: "$97",
    annualPrice: "$81",
    annualBilled: "$972",
    annualSavings: "$192",
    features: [
      { text: "Real-time coaching cards during live calls" },
      { text: "Live objection detection (price, spouse, timing, think-about-it)" },
      { text: "DISC buyer psychology profiling" },
      { text: "NEPQ phase tracking — all 7 phases" },
      { text: "Talk ratio monitor with live alerts" },
      { text: "Post-call coaching report (score, strengths, improvements)" },
      { text: "Full call transcription" },
      { text: "Objection log with ideal NEPQ responses" },
      { text: "1 user seat" },
      { text: "Email support" },
    ],
    cta: "Get Access",
    ctaVariant: "outline",
  },
  {
    name: "Agent Pro",
    popular: true,
    tagline: "For agents who want to compound their skills week over week.",
    monthlyPrice: "$197",
    annualPrice: "$164",
    annualBilled: "$1,968",
    annualSavings: "$396",
    features: [
      { text: "Everything in Agent", inherit: true },
      { text: "Weekly AI performance review" },
      { text: "Personalized drill plan based on your call data" },
      { text: "Skill progression tracking over time" },
      { text: "Coaching focus — auto-generated after every call" },
      { text: "Score trend charts (see yourself improving)" },
      { text: "Thumbs up/down on coaching cards to train the AI to you" },
      { text: "Agent learning profile — AI gets smarter the more you use it" },
      { text: "Priority support" },
    ],
    cta: "Get Access",
    ctaVariant: "solid",
  },
  {
    name: "Team",
    badge: "Up to 10 Agents",
    tagline: "For agency owners who need visibility across their whole team.",
    monthlyPrice: "$497",
    annualPrice: "$414",
    annualBilled: "$4,968",
    annualSavings: "$996",
    features: [
      { text: "Everything in Agent Pro — for every seat", inherit: true },
      { text: "Manager dashboard — see every agent's scores and trends" },
      { text: "Team NEPQ leaderboard" },
      { text: "Agent-by-agent performance breakdown" },
      { text: "Objection trend analysis across the team" },
      { text: "Know who needs coaching and on what — without listening to a single call" },
      { text: "Bulk call upload" },
      { text: "Onboarding support" },
      { text: "Dedicated Slack channel" },
      { text: "Up to 10 agent seats" },
    ],
    cta: "Get Access",
    ctaVariant: "outline",
  },
  {
    name: "Enterprise",
    tagline: "For IMOs and large agencies deploying at scale.",
    monthlyPrice: "Custom",
    annualPrice: "Custom",
    annualBilled: "",
    annualSavings: "",
    features: [
      { text: "Everything in Team — unlimited seats", inherit: true },
      { text: "Custom NEPQ rubrics for your methodology" },
      { text: "White-label option (your brand, Spear's engine)" },
      { text: "API access" },
      { text: "Custom integrations (CRM, dialer, LMS)" },
      { text: "Dedicated success director" },
      { text: "SLA + compliance support" },
    ],
    cta: "Talk to Us",
    ctaVariant: "outline",
  },
];

// ─── Waitlist Modal ───────────────────────────────────────────────────────────

const PLAN_OPTIONS = ["Agent", "Agent Pro", "Team", "Enterprise"] as const;
const TEAM_SIZE_OPTIONS = ["Just me", "2–5", "6–15", "16–50", "50+"] as const;

function WaitlistModal({ plan, onClose }: { plan: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(plan);
  const [teamSize, setTeamSize] = useState("Just me");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setSelectedPlan(plan); }, [plan]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      console.log("Waitlist submission:", { name, email, phone, plan: selectedPlan, teamSize });
      setLoading(false);
      setSubmitted(true);
    }, 600);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    backgroundColor: "rgba(5,10,20,0.7)",
    border: "1px solid rgba(37,99,235,0.22)",
    borderRadius: "6px", fontSize: "14px",
    color: CREAM, fontFamily: "var(--font-space)",
    outline: "none", transition: "border-color 0.2s",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "11px", fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase",
    color: WARM_GRAY, marginBottom: "6px",
  };

  return (
    <AnimatePresence>
      <motion.div
        key="waitlist-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          backgroundColor: "rgba(5,10,20,0.88)",
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}
      >
        <motion.div
          key="waitlist-card"
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.4, ease: EASE }}
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: "480px",
            backgroundColor: "#080F1E",
            border: `1px solid rgba(201,168,76,0.3)`,
            borderTop: `3px solid ${GOLD}`,
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: `0 0 80px rgba(201,168,76,0.1), 0 32px 96px rgba(0,0,0,0.7)`,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "28px 28px 0" }}>
            <div>
              <p style={{ fontSize: "22px", fontWeight: 800, color: CREAM, letterSpacing: "-0.02em", marginBottom: "8px" }}>
                Get Early Access to Spear
              </p>
              <p style={{ fontSize: "13px", color: CREAM_DIM, lineHeight: 1.65, maxWidth: "360px" }}>
                We&apos;re onboarding life insurance agents now. Drop your info and we&apos;ll reach out within 24 hours.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: WARM_GRAY, cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "0 0 0 12px", flexShrink: 0 }}
            >×</button>
          </div>

          <div style={{ padding: "24px 28px 28px" }}>
            {!submitted ? (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Full Name */}
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    required type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Jane Smith"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "rgba(201,168,76,0.5)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(37,99,235,0.22)")}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    required type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="jane@agency.com"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "rgba(201,168,76,0.5)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(37,99,235,0.22)")}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label style={{ ...labelStyle, display: "flex", gap: "6px", alignItems: "center" }}>
                    Phone
                    <span style={{ fontSize: "9px", color: WARM_GRAY, fontWeight: 400, letterSpacing: "0.08em", textTransform: "none" }}>optional</span>
                  </label>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "rgba(201,168,76,0.5)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(37,99,235,0.22)")}
                  />
                </div>

                {/* Plan */}
                <div>
                  <label style={labelStyle}>Which plan are you interested in?</label>
                  <select
                    value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                    onFocus={e => (e.target.style.borderColor = "rgba(201,168,76,0.5)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(37,99,235,0.22)")}
                  >
                    {PLAN_OPTIONS.map(p => <option key={p} value={p} style={{ backgroundColor: "#080F1E" }}>{p}</option>)}
                  </select>
                </div>

                {/* Team size */}
                <div>
                  <label style={labelStyle}>How many agents on your team?</label>
                  <select
                    value={teamSize} onChange={e => setTeamSize(e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                    onFocus={e => (e.target.style.borderColor = "rgba(201,168,76,0.5)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(37,99,235,0.22)")}
                  >
                    {TEAM_SIZE_OPTIONS.map(s => <option key={s} value={s} style={{ backgroundColor: "#080F1E" }}>{s}</option>)}
                  </select>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.02, boxShadow: `0 0 32px rgba(201,168,76,0.4)` } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  style={{
                    marginTop: "4px",
                    backgroundColor: GOLD, color: "#060D20", border: "none",
                    padding: "14px 0", fontSize: "14px", fontWeight: 800,
                    letterSpacing: "0.06em", cursor: loading ? "default" : "pointer",
                    borderRadius: "6px", fontFamily: "var(--font-space)",
                    opacity: loading ? 0.7 : 1, transition: "opacity 0.2s",
                  }}
                >
                  {loading ? "Submitting…" : "Join the Waitlist"}
                </motion.button>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                style={{ textAlign: "center", padding: "20px 0 8px" }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  backgroundColor: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "22px", margin: "0 auto 20px",
                }}>✓</div>
                <p style={{ fontSize: "20px", fontWeight: 800, color: CREAM, marginBottom: "10px" }}>
                  You&apos;re on the list.
                </p>
                <p style={{ fontSize: "14px", color: CREAM_DIM, lineHeight: 1.7, marginBottom: "24px" }}>
                  We&apos;ll be in touch within 24 hours.<br />
                  In the meantime — follow our progress.
                </p>
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    backgroundColor: "transparent", color: WARM_GRAY,
                    border: "1px solid rgba(255,255,255,0.12)",
                    padding: "10px 28px", fontSize: "13px", fontWeight: 600,
                    borderRadius: "6px", cursor: "pointer",
                    fontFamily: "var(--font-space)",
                  }}
                >
                  Close
                </motion.button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Demo Modal ───────────────────────────────────────────────────────────────

const DEMO_SCRIPT = [
  { speaker: "agent",   text: "Hey Sarah, thanks for jumping on. How's your evening going?", delay: 0 },
  { speaker: "prospect", text: "Good, good. So you mentioned something about life insurance? We do have some through my husband's work.", delay: 2800 },
  { speaker: "agent",   text: "That's great — a lot of families rely on that. Can I ask, do you know offhand how much coverage that actually is?", delay: 6000 },
  { speaker: "prospect", text: "Hmm, I think like... maybe a year's salary? I'm not totally sure.", delay: 9400 },
  { speaker: "agent",   text: "Most employer plans land around one to two times salary. What does your husband bring home each year roughly?", delay: 12600 },
  { speaker: "prospect", text: "Around $85,000. But honestly the price on any extra coverage just seems like a lot.", delay: 16200 },
  { speaker: "agent",   text: "I hear you. What specifically felt high — was it a number you saw before, or just the idea of another bill?", delay: 20000 },
  { speaker: "prospect", text: "Just another bill I guess. I need to think about it and talk to my husband.", delay: 24000 },
];

const DEMO_COACHING_EVENTS = [
  {
    triggerAfter: 3,
    type: "INSIGHT",
    typeColor: "#3B82F6",
    title: "Employer Coverage Gap Detected",
    body: "Prospect mentioned work coverage — likely underinsured. Ask for exact amount to surface the gap.",
    phase: "NEPQ Phase: Problem Awareness",
  },
  {
    triggerAfter: 5,
    type: "OBJECTION DETECTED",
    typeColor: "#EF4444",
    title: '"Price is too high"',
    body: '"Compared to what? At $4/day — what\'s peace of mind worth to your family?"',
    phase: "DISC: S-Type • Needs safety + certainty",
  },
  {
    triggerAfter: 7,
    type: "OBJECTION DETECTED",
    typeColor: "#EF4444",
    title: '"Need to think about it / spouse"',
    body: '"Totally — what specifically did you want to think through? Is it the coverage, the cost, or something else?"',
    phase: "NEPQ Phase: Consequence Questions ⚡",
  },
];

function DemoModal({ onClose }: { onClose: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [coachingIdx, setCoachingIdx] = useState<number | null>(null);
  const [coachingVisible, setCoachingVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startDemo = useCallback(() => {
    setStarted(true);
    setVisibleLines(0);
    setCoachingIdx(null);
    setCoachingVisible(false);
    setElapsed(0);

    DEMO_SCRIPT.forEach((line, i) => {
      setTimeout(() => setVisibleLines(v => Math.max(v, i + 1)), line.delay);
    });

    DEMO_COACHING_EVENTS.forEach((evt, i) => {
      const triggerLine = DEMO_SCRIPT[evt.triggerAfter];
      setTimeout(() => {
        setCoachingVisible(false);
        setTimeout(() => {
          setCoachingIdx(i);
          setCoachingVisible(true);
        }, 350);
      }, triggerLine.delay + 1200);
    });
  }, []);

  useEffect(() => {
    if (!started) return;
    timeRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timeRef.current) clearInterval(timeRef.current); };
  }, [started]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [visibleLines]);

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  const coaching = coachingIdx !== null ? DEMO_COACHING_EVENTS[coachingIdx] : null;

  return (
    <AnimatePresence>
      <motion.div
        key="demo-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          backgroundColor: "rgba(5,10,20,0.88)",
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}
      >
        <motion.div
          key="demo-modal"
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.45, ease: EASE }}
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: "920px",
            backgroundColor: "#080F1E",
            border: `1px solid rgba(37,99,235,0.35)`,
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: `0 0 80px rgba(37,99,235,0.22), 0 32px 96px rgba(0,0,0,0.7)`,
          }}
        >
          {/* Modal header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 22px",
            borderBottom: `1px solid rgba(37,99,235,0.15)`,
            backgroundColor: "rgba(37,99,235,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 800, color: CREAM, letterSpacing: "0.1em" }}>SPEAR</span>
              <span style={{ fontSize: "10px", color: WARM_GRAY, letterSpacing: "0.16em", textTransform: "uppercase" }}>Live Demo</span>
            </div>
            {started && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <motion.div
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#22C55E", boxShadow: "0 0 7px #22C55E" }}
                />
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#22C55E", letterSpacing: "0.18em" }}>LIVE  {mins}:{secs}</span>
              </div>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", color: WARM_GRAY, cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "2px 6px" }}>×</button>
          </div>

          {/* Main body */}
          {!started ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 40px", gap: "28px" }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", border: `2px solid rgba(37,99,235,0.4)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", backgroundColor: "rgba(37,99,235,0.08)" }}>
                ▶
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "22px", fontWeight: 700, color: CREAM, marginBottom: "10px" }}>Watch a Live Coaching Session</p>
                <p style={{ fontSize: "14px", color: CREAM_DIM, lineHeight: 1.7, maxWidth: "420px" }}>
                  See how Spear detects objections in real time, profiles buyer psychology, and surfaces exactly what to say — mid-call.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: `0 0 32px rgba(37,99,235,0.45)` }}
                whileTap={{ scale: 0.97 }}
                onClick={startDemo}
                style={{
                  backgroundColor: BLUE, color: CREAM, border: "none",
                  padding: "14px 44px", fontSize: "14px", fontWeight: 700,
                  letterSpacing: "0.06em", cursor: "pointer", borderRadius: "6px",
                  fontFamily: "var(--font-space)",
                }}
              >
                Start Demo
              </motion.button>
              <p style={{ fontSize: "11px", color: WARM_GRAY }}>Simulated call · ~30 seconds</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row" style={{ minHeight: "440px" }}>
              {/* Transcript panel */}
              <div style={{ flex: 1, borderRight: `1px solid rgba(37,99,235,0.12)`, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 18px", borderBottom: `1px solid rgba(37,99,235,0.1)` }}>
                  <p style={{ fontSize: "9px", letterSpacing: "0.22em", color: WARM_GRAY, textTransform: "uppercase", fontWeight: 700 }}>Live Transcript</p>
                </div>
                <div ref={transcriptRef} style={{ flex: 1, overflowY: "auto", padding: "20px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  {DEMO_SCRIPT.slice(0, visibleLines).map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      style={{ display: "flex", flexDirection: "column", alignItems: line.speaker === "agent" ? "flex-end" : "flex-start", gap: "4px" }}
                    >
                      <span style={{ fontSize: "9px", letterSpacing: "0.14em", color: WARM_GRAY, textTransform: "uppercase", fontWeight: 600 }}>
                        {line.speaker === "agent" ? "You" : "Sarah (Prospect)"}
                      </span>
                      <div style={{
                        maxWidth: "78%", padding: "10px 14px", borderRadius: "10px",
                        backgroundColor: line.speaker === "agent" ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.05)",
                        border: line.speaker === "agent" ? `1px solid rgba(37,99,235,0.25)` : `1px solid rgba(255,255,255,0.08)`,
                      }}>
                        <p style={{ fontSize: "13px", color: CREAM, lineHeight: 1.6 }}>{line.text}</p>
                      </div>
                    </motion.div>
                  ))}
                  {visibleLines < DEMO_SCRIPT.length && (
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ display: "flex", gap: "4px", paddingLeft: "4px" }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: WARM_GRAY }} />)}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Coaching panel */}
              <div style={{ width: "100%", maxWidth: "340px", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 18px", borderBottom: `1px solid rgba(37,99,235,0.1)` }}>
                  <p style={{ fontSize: "9px", letterSpacing: "0.22em", color: WARM_GRAY, textTransform: "uppercase", fontWeight: 700 }}>AI Coaching</p>
                </div>
                <div style={{ flex: 1, padding: "18px", display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
                  <AnimatePresence mode="wait">
                    {coaching && coachingVisible ? (
                      <motion.div
                        key={coachingIdx}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.4, ease: EASE }}
                        style={{
                          backgroundColor: "rgba(5,10,20,0.8)",
                          border: `1px solid ${coaching.typeColor}33`,
                          borderRadius: "10px", padding: "16px",
                          boxShadow: `0 0 28px ${coaching.typeColor}1A`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "10px" }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: coaching.typeColor, boxShadow: `0 0 6px ${coaching.typeColor}` }} />
                          <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.2em", color: coaching.typeColor, textTransform: "uppercase" }}>{coaching.type}</span>
                        </div>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: CREAM, marginBottom: "12px", lineHeight: 1.35 }}>{coaching.title}</p>
                        <div style={{
                          backgroundColor: "rgba(37,99,235,0.07)",
                          border: `1px solid rgba(37,99,235,0.2)`,
                          borderRadius: "7px", padding: "10px 12px", marginBottom: "12px",
                        }}>
                          <p style={{ fontSize: "9px", letterSpacing: "0.16em", color: CREAM_DIM, textTransform: "uppercase", fontWeight: 700, marginBottom: "6px" }}>SUGGESTED RESPONSE</p>
                          <p style={{ fontSize: "12px", color: CREAM, lineHeight: 1.65, fontStyle: "italic" }}>{coaching.body}</p>
                        </div>
                        <p style={{ fontSize: "10px", color: CREAM_DIM, fontWeight: 600 }}>{coaching.phase}</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="waiting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "14px", paddingTop: "40px" }}
                      >
                        <motion.div
                          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          style={{ width: 44, height: 44, borderRadius: "50%", border: `1px solid rgba(37,99,235,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}
                        >
                          🧠
                        </motion.div>
                        <p style={{ fontSize: "12px", color: WARM_GRAY, textAlign: "center", lineHeight: 1.6 }}>Listening for objections<br />and buyer signals…</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* DISC + score at bottom */}
                  {visibleLines >= 3 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      style={{ marginTop: "auto", paddingTop: "16px", borderTop: `1px solid rgba(37,99,235,0.1)` }}
                    >
                      <p style={{ fontSize: "9px", letterSpacing: "0.18em", color: WARM_GRAY, textTransform: "uppercase", fontWeight: 700, marginBottom: "10px" }}>Buyer Profile</p>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {[["DISC: S-Type", "#3B82F6"], ["Emotional Buyer", "#C9A84C"], ["Family Motivated", "#22C55E"]].map(([label, color]) => (
                          <span key={label} style={{
                            fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em",
                            padding: "3px 9px", borderRadius: "20px",
                            backgroundColor: `${color}18`, border: `1px solid ${color}44`, color,
                          }}>{label}</span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            padding: "12px 22px",
            borderTop: `1px solid rgba(37,99,235,0.1)`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            backgroundColor: "rgba(37,99,235,0.03)",
          }}>
            <p style={{ fontSize: "10px", color: WARM_GRAY }}>This is a simulated demo — real calls work identically.</p>
            <Link href="/dashboard" onClick={onClose}>
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: `0 0 20px rgba(37,99,235,0.35)` }}
                whileTap={{ scale: 0.97 }}
                style={{
                  backgroundColor: BLUE, color: CREAM, border: "none",
                  padding: "8px 22px", fontSize: "11px", fontWeight: 700,
                  letterSpacing: "0.08em", cursor: "pointer", borderRadius: "4px",
                  fontFamily: "var(--font-space)",
                }}
              >
                Get Access →
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [annual, setAnnual] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [waitlistPlan, setWaitlistPlan] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setDemoOpen(false); setWaitlistPlan(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ backgroundColor: BG, color: CREAM, fontFamily: "var(--font-space)" }}>

      {/* ── DEMO MODAL ───────────────────────────────────── */}
      {demoOpen && <DemoModal onClose={() => setDemoOpen(false)} />}

      {/* ── WAITLIST MODAL ───────────────────────────────── */}
      {waitlistPlan !== null && (
        <WaitlistModal plan={waitlistPlan} onClose={() => setWaitlistPlan(null)} />
      )}

      {/* ── NAV ─────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          backgroundColor: "rgba(5,10,20,0.94)",
          borderBottom: DIVIDER,
          backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px" }}>
          <span style={{ fontSize: "22px", fontWeight: 800, color: CREAM, letterSpacing: "-0.5px" }}>SPEAR</span>
          <div className="hidden md:flex" style={{ alignItems: "center", gap: "36px" }}>
            {[["#how-it-works", "How It Works"], ["#features", "Features"], ["#pricing", "Pricing"]].map(([href, label]) => (
              <a key={href} href={href}
                style={{ fontSize: "11px", letterSpacing: "0.18em", color: WARM_GRAY, textTransform: "uppercase", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = CREAM)}
                onMouseLeave={e => (e.currentTarget.style.color = WARM_GRAY)}>
                {label}
              </a>
            ))}
            <Link href="/login" style={{ fontSize: "11px", letterSpacing: "0.18em", color: WARM_GRAY, textTransform: "uppercase", textDecoration: "none" }}>Sign In</Link>
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: `0 0 20px rgba(37,99,235,0.35)` }}
                whileTap={{ scale: 0.97 }}
                style={{
                  backgroundColor: BLUE, color: CREAM, border: "none",
                  padding: "8px 20px", fontSize: "11px", letterSpacing: "0.1em",
                  fontWeight: 700, cursor: "pointer", borderRadius: "4px",
                  fontFamily: "var(--font-space)",
                }}
              >
                Dashboard
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="hero-watermark" style={{
        position: "relative", minHeight: "100vh",
        display: "flex", alignItems: "center", paddingTop: "64px",
        backgroundColor: BG, overflow: "hidden",
      }}>
        {/* Blue radial glow */}
        <div style={{
          position: "absolute", top: "15%", left: "5%",
          width: "700px", height: "700px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 68%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 10, maxWidth: "1200px", margin: "0 auto", padding: "80px 32px", width: "100%" }}>
          <div className="flex flex-col lg:flex-row" style={{ alignItems: "center", gap: "60px" }}>

            {/* Left */}
            <div style={{ flex: 1, maxWidth: "580px" }}>
              {/* Live badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.7 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  backgroundColor: "rgba(37,99,235,0.1)",
                  border: `1px solid rgba(37,99,235,0.28)`,
                  borderRadius: "20px", padding: "5px 14px", marginBottom: "28px",
                }}
              >
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#22C55E", boxShadow: "0 0 6px #22C55E" }}
                />
                <span style={{ fontSize: "11px", color: CREAM_DIM, letterSpacing: "0.12em", fontWeight: 700 }}>BUILT FOR LIFE INSURANCE AGENTS</span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38, duration: 1, ease: EASE }}
                style={{
                  fontFamily: "var(--font-space)", fontSize: "clamp(36px, 5vw, 68px)",
                  fontWeight: 700, lineHeight: 1.04, color: CREAM,
                  marginBottom: "24px", letterSpacing: "-0.03em",
                }}
              >
                Your AI Coach.
                <br />
                <span style={{ color: CREAM }}>Live.</span> On Every Call.
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.9, ease: EASE }}
                style={{ fontSize: "16px", color: CREAM_DIM, lineHeight: 1.8, marginBottom: "40px", maxWidth: "500px" }}
              >
                Spear listens to your life insurance calls in real time, detects objections the moment they&apos;re spoken, reads your prospect&apos;s buyer psychology, and tells you exactly what to say to guide them to a close — automatically.
              </motion.p>

              {/* CTA buttons */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8, ease: EASE }}
                style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "36px" }}
              >
                <Link href="/dashboard">
                  <motion.button
                    whileHover={{ scale: 1.03, boxShadow: `0 0 36px rgba(37,99,235,0.45)` }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      backgroundColor: BLUE, color: CREAM, border: "none",
                      padding: "15px 34px", fontSize: "14px", fontWeight: 700,
                      letterSpacing: "0.04em", cursor: "pointer", borderRadius: "6px",
                      fontFamily: "var(--font-space)",
                    }}
                  >
                    Get Access
                  </motion.button>
                </Link>
                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: "rgba(37,99,235,0.07)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDemoOpen(true)}
                  style={{
                    backgroundColor: "transparent", color: CREAM,
                    border: `1px solid rgba(255,255,255,0.2)`,
                    padding: "15px 34px", fontSize: "14px", fontWeight: 600,
                    letterSpacing: "0.04em", cursor: "pointer", borderRadius: "6px",
                    fontFamily: "var(--font-space)", transition: "background-color 0.2s",
                  }}
                >
                  Watch It Work
                </motion.button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 1.05, duration: 0.7 }}
                style={{ fontSize: "11px", color: WARM_GRAY, letterSpacing: "0.06em" }}
              >
                Limited spots &nbsp;·&nbsp; Life insurance agents only
              </motion.p>
            </div>

            {/* Right: Live call card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55, duration: 1.1, ease: EASE }}
              style={{ flex: "0 0 auto", display: "flex", justifyContent: "center", width: "100%" }}
              className="lg:w-auto"
            >
              <LiveCallCard />
            </motion.div>
          </div>
        </div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 1 }}
          style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}
        >
          <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
            <span style={{ fontSize: "9px", letterSpacing: "0.28em", color: WARM_GRAY, textTransform: "uppercase" }}>Scroll</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "100px 32px", backgroundColor: BG_CARD, borderTop: `1px solid ${DIVIDER}` }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "72px" }}>
              <p style={{ fontSize: "10px", letterSpacing: "0.3em", color: CREAM_DIM, textTransform: "uppercase", fontWeight: 700, marginBottom: "16px" }}>How It Works</p>
              <h2 style={{ fontFamily: "var(--font-space)", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700, color: CREAM, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                Three steps from dial<br />to dominance.
              </h2>
            </div>
          </Reveal>

          <StaggerReveal className="grid sm:grid-cols-3 gap-12">
            {HOW_STEPS.map(step => <HowStep key={step.number} {...step} />)}
          </StaggerReveal>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section id="features" style={{ padding: "100px 32px", backgroundColor: BG }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "72px" }}>
              <p style={{ fontSize: "10px", letterSpacing: "0.3em", color: CREAM_DIM, textTransform: "uppercase", fontWeight: 700, marginBottom: "16px" }}>Core Features</p>
              <h2 style={{ fontFamily: "var(--font-space)", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700, color: CREAM, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                Everything you need.<br />Nothing you don&apos;t.
              </h2>
            </div>
          </Reveal>

          <StaggerReveal className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
          </StaggerReveal>
        </div>
      </section>

      {/* ── CHARGEBACK REDUCTION ─────────────────────────── */}
      <section style={{ padding: "100px 32px", backgroundColor: BG_CARD, borderTop: `1px solid ${DIVIDER}` }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

          {/* Header */}
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <p style={{ fontSize: "10px", letterSpacing: "0.3em", color: CREAM_DIM, textTransform: "uppercase", fontWeight: 700, marginBottom: "16px" }}>
                For Agency Owners &amp; IMOs
              </p>
              <h2 style={{ fontFamily: "var(--font-space)", fontSize: "clamp(26px, 4vw, 48px)", fontWeight: 700, color: CREAM, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "20px" }}>
                Chargebacks Are Killing Your Income.<br />Spear Fixes the Root Cause.
              </h2>
              <p style={{ fontSize: "16px", color: CREAM_DIM, lineHeight: 1.8, maxWidth: "640px", margin: "0 auto" }}>
                Most chargebacks don&apos;t happen because the product was wrong. They happen because the agent oversold, rushed the close, or never truly qualified the buyer. Spear coaches agents to sell the right way — so clients stay paid up.
              </p>
            </div>
          </Reveal>

          {/* Stat cards */}
          <StaggerReveal className="grid sm:grid-cols-3 gap-5" style={{ marginBottom: "64px" }}>
            {[
              { stat: "68%",   icon: "⚠️", label: "of chargebacks tied to poor needs analysis in the first call" },
              { stat: "2.3x",  icon: "📉", label: "higher lapse rate when agents skip consequence questions" },
              { stat: "40%+",  icon: "🛡️", label: "chargeback reduction reported when NEPQ is executed correctly" },
            ].map(({ stat, icon, label }) => (
              <motion.div
                key={stat}
                variants={cardEnter}
                style={{
                  backgroundColor: BG,
                  border: `1px solid rgba(201,168,76,0.18)`,
                  borderTop: `3px solid ${GOLD}`,
                  borderRadius: "8px",
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "14px" }}>{icon}</div>
                <p style={{ fontFamily: "var(--font-space)", fontSize: "clamp(36px, 5vw, 52px)", fontWeight: 800, color: GOLD, lineHeight: 1, letterSpacing: "-0.02em", marginBottom: "14px" }}>
                  {stat}
                </p>
                <p style={{ fontSize: "13px", color: CREAM_DIM, lineHeight: 1.65 }}>{label}</p>
              </motion.div>
            ))}
          </StaggerReveal>

          {/* Two-column breakdown */}
          <div className="grid sm:grid-cols-2 gap-6" style={{ marginBottom: "48px" }}>
            <Reveal delay={0.1}>
              <div style={{ backgroundColor: BG, border: `1px solid rgba(239,68,68,0.18)`, borderTop: `2px solid rgba(239,68,68,0.5)`, borderRadius: "6px", padding: "32px 28px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#EF4444", marginBottom: "24px" }}>
                  Why chargebacks happen
                </p>
                <ul style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {[
                    "Agent pitches before the prospect is emotionally bought in",
                    "Coverage amount isn't tied to a real consequence the prospect identified",
                    "Spouse or decision-maker was never brought into the process",
                    "Agent talked too much, prospect felt sold — not guided",
                    "No follow-up framework after the close",
                  ].map(item => (
                    <li key={item} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ color: "#EF4444", flexShrink: 0, fontWeight: 700, marginTop: "2px", fontSize: "13px" }}>✗</span>
                      <span style={{ fontSize: "14px", color: CREAM_DIM, lineHeight: 1.65 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div style={{ backgroundColor: BG, border: `1px solid rgba(201,168,76,0.2)`, borderTop: `2px solid ${GOLD}`, borderRadius: "6px", padding: "32px 28px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: GOLD, marginBottom: "24px" }}>
                  How Spear prevents them
                </p>
                <ul style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {[
                    "Spear flags when agents pitch before Phase 5 — before emotional buy-in exists",
                    "Objection detection catches \"I need to talk to my spouse\" before it becomes a cancelled policy",
                    "Talk ratio alerts stop agents from over-talking prospects into a yes they don't mean",
                    "Post-call scores show exactly which calls are high chargeback risk",
                    "Every close is grounded in the prospect's own words — not the agent's pitch",
                  ].map(item => (
                    <li key={item} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ color: GOLD, flexShrink: 0, fontWeight: 700, marginTop: "2px", fontSize: "13px" }}>✓</span>
                      <span style={{ fontSize: "14px", color: CREAM_DIM, lineHeight: 1.65 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* CTA */}
          <Reveal delay={0.3}>
            <div style={{ textAlign: "center" }}>
              <a href="#pricing" style={{ textDecoration: "none" }}>
                <motion.span
                  whileHover={{ x: 4 }}
                  style={{ fontSize: "15px", fontWeight: 700, color: GOLD, cursor: "pointer", letterSpacing: "0.02em", display: "inline-block" }}
                >
                  See how Spear reduces chargebacks →
                </motion.span>
              </a>
            </div>
          </Reveal>

        </div>
      </section>

      {/* ── AGENT RETENTION ──────────────────────────────── */}
      <section style={{ padding: "100px 32px", backgroundColor: BG, borderTop: `1px solid ${DIVIDER}` }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

          {/* Header */}
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <p style={{ fontSize: "10px", letterSpacing: "0.3em", color: CREAM_DIM, textTransform: "uppercase", fontWeight: 700, marginBottom: "16px" }}>
                Agent Retention
              </p>
              <h2 style={{ fontFamily: "var(--font-space)", fontSize: "clamp(26px, 4vw, 48px)", fontWeight: 700, color: CREAM, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "20px" }}>
                80% of New Agents Quit in Year One.<br />Give Them a Reason to Stay.
              </h2>
              <p style={{ fontSize: "16px", color: CREAM_DIM, lineHeight: 1.8, maxWidth: "640px", margin: "0 auto" }}>
                The number one reason new agents wash out isn&apos;t work ethic — it&apos;s that nobody tells them what they&apos;re doing wrong before it&apos;s too late. Spear gives every agent the coaching they need to survive the learning curve and build momentum.
              </p>
            </div>
          </Reveal>

          {/* Stat + bullets row */}
          <div className="flex flex-col md:flex-row gap-12" style={{ marginBottom: "64px", alignItems: "stretch" }}>

            {/* Large stat */}
            <Reveal delay={0.1} style={{ flex: "0 0 auto" }}>
              <div style={{
                backgroundColor: BG_CARD,
                border: `1px solid rgba(201,168,76,0.2)`,
                borderTop: `3px solid ${GOLD}`,
                borderRadius: "8px",
                padding: "40px 36px",
                textAlign: "center",
                minWidth: "260px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}>
                <p style={{ fontFamily: "var(--font-space)", fontSize: "clamp(52px, 8vw, 80px)", fontWeight: 800, color: GOLD, lineHeight: 1, letterSpacing: "-0.03em", marginBottom: "16px" }}>
                  $18,000
                </p>
                <p style={{ fontSize: "14px", color: CREAM_DIM, lineHeight: 1.65, marginBottom: "16px" }}>
                  Average cost to recruit, onboard,<br />and lose a single agent in year one
                </p>
                <p style={{ fontSize: "10px", color: WARM_GRAY, letterSpacing: "0.06em", lineHeight: 1.6 }}>
                  Industry estimate based on recruiting,<br />training, and lost production costs
                </p>
              </div>
            </Reveal>

            {/* Bullet list */}
            <Reveal delay={0.2} style={{ flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: "20px" }}>
                {[
                  "New agents get scored on every call from day one — not just the ones their manager happens to hear",
                  "Spear identifies struggling agents early — before they quit or get released",
                  "Personalized drill plans give new agents a clear path to improve, not just generic training",
                  "Agents who can see themselves getting better week over week stay in the business",
                  "One tool replaces hours of manual call reviews for agency owners",
                ].map(item => (
                  <div key={item} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: "2px",
                      backgroundColor: "rgba(201,168,76,0.12)",
                      border: `1px solid rgba(201,168,76,0.3)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "9px", color: GOLD, fontWeight: 800,
                    }}>✓</div>
                    <p style={{ fontSize: "15px", color: CREAM_DIM, lineHeight: 1.7 }}>{item}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Without / With contrast block */}
          <div className="grid sm:grid-cols-2 gap-5" style={{ marginBottom: "52px" }}>
            <Reveal delay={0.1}>
              <div style={{ backgroundColor: BG_CARD, border: `1px solid rgba(239,68,68,0.15)`, borderRadius: "6px", padding: "28px 24px" }}>
                <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "#EF4444", marginBottom: "20px" }}>
                  Without Spear
                </p>
                <ul style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {[
                    "New agent finishes a bad call, doesn't know why they lost it",
                    "Manager can't review every call — coaching is random",
                    "Agent hits a wall after 60 days, starts doubting themselves",
                    "Agent quits. You start recruiting again.",
                  ].map(item => (
                    <li key={item} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <span style={{ color: "#EF4444", flexShrink: 0, fontSize: "13px", marginTop: "2px" }}>—</span>
                      <span style={{ fontSize: "13px", color: CREAM_DIM, lineHeight: 1.65 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div style={{ backgroundColor: BG_CARD, border: `1px solid rgba(37,99,235,0.2)`, borderTop: `2px solid ${BLUE}`, borderRadius: "6px", padding: "28px 24px" }}>
                <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: BLUE_LIGHT, marginBottom: "20px" }}>
                  With Spear
                </p>
                <ul style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {[
                    "Every call gets scored automatically",
                    "Agent sees exactly what to fix before the next call",
                    "Improvement is visible — confidence builds week over week",
                    "Agent survives the learning curve and starts closing consistently",
                  ].map(item => (
                    <li key={item} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <span style={{ color: BLUE_LIGHT, flexShrink: 0, fontWeight: 700, fontSize: "13px", marginTop: "2px" }}>✓</span>
                      <span style={{ fontSize: "13px", color: CREAM_DIM, lineHeight: 1.65 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* CTA */}
          <Reveal delay={0.3}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "18px", fontWeight: 700, color: CREAM, marginBottom: "24px", letterSpacing: "-0.01em" }}>
                Keep your agents. Close more deals.
              </p>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: `0 0 40px rgba(201,168,76,0.4)` }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const el = document.getElementById("pricing");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                style={{
                  backgroundColor: GOLD, color: "#060D20", border: "none",
                  padding: "15px 44px", fontSize: "15px", fontWeight: 800,
                  letterSpacing: "0.05em", cursor: "pointer", borderRadius: "6px",
                  fontFamily: "var(--font-space)",
                }}
              >
                Get Early Access
              </motion.button>
            </div>
          </Reveal>

        </div>
      </section>

      {/* ── SOCIAL PROOF STRIP ───────────────────────────── */}
      <section id="pricing" style={{ padding: "80px 32px", backgroundColor: BG_CARD, borderTop: `1px solid ${DIVIDER}`, borderBottom: `1px solid ${DIVIDER}` }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <Reveal>
            <div className="grid sm:grid-cols-3 gap-10" style={{ textAlign: "center", marginBottom: "28px" }}>
              {[
                { stat: "416", suffix: "", label: "Objections Caught This Month" },
                { stat: "34.8", suffix: "%", label: "Avg Close Rate" },
                { stat: "$238,400", suffix: "", label: "Revenue Influenced" },
              ].map(({ stat, suffix, label }) => (
                <div key={label}>
                  <p style={{ fontFamily: "var(--font-space)", fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 800, color: CREAM, marginBottom: "8px", letterSpacing: "-0.02em" }}>
                    {stat}{suffix}
                  </p>
                  <p style={{ fontSize: "13px", color: CREAM, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</p>
                </div>
              ))}
            </div>
            <p style={{ textAlign: "center", fontSize: "11px", color: WARM_GRAY, lineHeight: 1.7 }}>
              Based on Spear demo data — your results will vary based on call volume and execution.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── WHO IT'S FOR ─────────────────────────────────── */}
      <section style={{ padding: "100px 32px", backgroundColor: BG }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <Reveal>
            <h2 style={{
              fontFamily: "var(--font-space)", fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 700, color: CREAM, lineHeight: 1.1, letterSpacing: "-0.02em",
              textAlign: "center", marginBottom: "64px",
            }}>
              Built for agents who are<br />
              <span style={{ color: CREAM }}>serious about closing.</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-6">
            <Reveal delay={0.1}>
              <div style={{
                backgroundColor: BG_CARD,
                border: `1px solid rgba(37,99,235,0.2)`,
                borderTop: `2px solid rgba(37,99,235,0.5)`,
                padding: "36px 32px", borderRadius: "4px",
              }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: CREAM, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "28px" }}>
                  You&apos;re a fit if...
                </p>
                <ul style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {[
                    "You sell life insurance — IUL, term, whole life, or final expense",
                    "You've been trained in NEPQ but aren't sure if you're executing it on every call",
                    "You finish calls and don't know why you lost the deal",
                    "Your manager can't listen to every call and you're coaching yourself in the dark",
                    "You want to close more without working more hours",
                  ].map(item => (
                    <li key={item} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ color: CREAM_DIM, flexShrink: 0, fontWeight: 700, marginTop: "1px" }}>→</span>
                      <span style={{ fontSize: "14px", color: CREAM_DIM, lineHeight: 1.65 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div style={{
                backgroundColor: BG_CARD,
                border: `1px solid rgba(201,168,76,0.2)`,
                borderTop: `2px solid ${GOLD}`,
                padding: "36px 32px", borderRadius: "4px",
              }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: CREAM, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "28px" }}>
                  What changes:
                </p>
                <ul style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {[
                    "You stop losing deals to the 4 objections that kill 80% of life insurance sales",
                    "Every call gets scored — you know exactly what to fix before the next one",
                    "Your NEPQ execution goes from inconsistent to automatic",
                    "New agents ramp in weeks instead of months",
                    "Your close rate compounds — every call makes you better than the last",
                  ].map(item => (
                    <li key={item} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ color: CREAM, flexShrink: 0, fontWeight: 700, marginTop: "1px" }}>✓</span>
                      <span style={{ fontSize: "14px", color: CREAM_DIM, lineHeight: 1.65 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "100px 32px", backgroundColor: BG }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

          {/* Header */}
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "56px" }}>
              <p style={{ fontSize: "10px", letterSpacing: "0.3em", color: WARM_GRAY, textTransform: "uppercase", fontWeight: 700, marginBottom: "14px" }}>
                Pricing
              </p>
              <h2 style={{
                fontFamily: "var(--font-space)", fontSize: "clamp(28px, 4vw, 48px)",
                fontWeight: 700, color: CREAM, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "16px",
              }}>
                Simple pricing. Serious ROI.
              </h2>
              <p style={{ fontSize: "15px", color: WARM_GRAY, lineHeight: 1.7, maxWidth: "480px", margin: "0 auto 36px" }}>
                One closed deal pays for months of Spear. Pick the plan that fits your operation.
              </p>

              {/* Billing toggle */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", backgroundColor: BG_CARD, border: `1px solid rgba(37,99,235,0.2)`, borderRadius: "40px", padding: "5px 6px" }}>
                {(["Monthly", "Annual"] as const).map(label => {
                  const isActive = label === "Annual" ? annual : !annual;
                  return (
                    <button
                      key={label}
                      onClick={() => setAnnual(label === "Annual")}
                      style={{
                        padding: "8px 22px", borderRadius: "30px", border: "none",
                        fontSize: "13px", fontWeight: 600, cursor: "pointer",
                        fontFamily: "var(--font-space)", letterSpacing: "0.04em",
                        backgroundColor: isActive ? BLUE : "transparent",
                        color: isActive ? CREAM : WARM_GRAY,
                        transition: "all 0.2s",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                {annual && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em",
                      color: BG, backgroundColor: GOLD,
                      borderRadius: "20px", padding: "3px 10px", marginRight: "4px",
                    }}
                  >
                    SAVE 17%
                  </motion.span>
                )}
              </div>
            </div>
          </Reveal>

          {/* Cards */}
          <StaggerReveal className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5" style={{ alignItems: "start" }}>
            {PRICING.map(tier => (
              <PricingCard
                key={tier.name}
                tier={tier}
                annual={annual}
                onCTA={
                  tier.cta === "Talk to Us"
                    ? () => { window.location.href = "mailto:Mj3mcginnis@gmail.com?subject=Spear Enterprise Inquiry"; }
                    : () => setWaitlistPlan(tier.name)
                }
              />
            ))}
          </StaggerReveal>

          {/* Comparison table */}
          <Reveal delay={0.2}>
            <ComparisonTable />
          </Reveal>

          <Reveal delay={0.3}>
            <p style={{ textAlign: "center", fontSize: "11px", color: WARM_GRAY, marginTop: "32px", lineHeight: 1.7 }}>
              All plans billed in USD. Cancel anytime. Enterprise pricing based on seat count and contract term.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────── */}
      <section style={{
        padding: "110px 32px",
        background: `linear-gradient(135deg, #060D20 0%, #0B1A3E 50%, #060D20 100%)`,
        borderTop: `1px solid rgba(37,99,235,0.18)`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "900px", height: "500px",
          background: "radial-gradient(ellipse, rgba(37,99,235,0.1) 0%, transparent 68%)",
          pointerEvents: "none",
        }} />
        <Reveal>
          <div style={{ position: "relative", zIndex: 10, maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
            <h2 style={{
              fontFamily: "var(--font-space)", fontSize: "clamp(28px, 5vw, 56px)",
              fontWeight: 800, color: CREAM, lineHeight: 1.04,
              marginBottom: "20px", letterSpacing: "-0.03em",
            }}>
              Every call is a rep.<br />Start training smarter.
            </h2>
            <p style={{ fontSize: "16px", color: CREAM_DIM, lineHeight: 1.75, marginBottom: "44px" }}>
              The AI co-pilot built exclusively for life insurance agents.
            </p>
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: `0 0 56px rgba(201,168,76,0.45)` }}
                whileTap={{ scale: 0.97 }}
                style={{
                  backgroundColor: GOLD, color: "#060D20", border: "none",
                  padding: "18px 52px", fontSize: "16px", fontWeight: 800,
                  letterSpacing: "0.06em", cursor: "pointer", borderRadius: "6px",
                  fontFamily: "var(--font-space)",
                }}
              >
                Get Started Free
              </motion.button>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer style={{ backgroundColor: BG, borderTop: `1px solid rgba(37,99,235,0.1)`, padding: "40px 32px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "18px", fontWeight: 800, color: CREAM, letterSpacing: "-0.5px" }}>SPEAR</span>
              <span style={{ fontSize: "10px", color: WARM_GRAY, letterSpacing: "0.15em", textTransform: "uppercase" }}>AI Sales Co-Pilot — Built exclusively for life insurance agents</span>
            </div>
            <div style={{ display: "flex", gap: "28px" }}>
              <Link href="/dashboard" style={{ fontSize: "11px", color: WARM_GRAY, textDecoration: "none", letterSpacing: "0.12em", textTransform: "uppercase" }}>Dashboard</Link>
              <Link href="/login" style={{ fontSize: "11px", color: WARM_GRAY, textDecoration: "none", letterSpacing: "0.12em", textTransform: "uppercase" }}>Sign In</Link>
            </div>
          </div>
          <div style={{ height: 1, backgroundColor: `rgba(37,99,235,0.08)` }} />
          <p style={{ fontSize: "10px", color: WARM_GRAY, letterSpacing: "0.1em" }}>© 2026 Spear. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
