"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, CheckCircle2, ArrowRight, ArrowLeft, Zap, BarChart3, Brain, Shield, Users, User, Building2 } from "lucide-react";
import { signup } from "@/app/auth/actions";
import { useFormStatus } from "react-dom";

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const BG       = "#050A14";
const BG_CARD  = "#080F1E";
const CREAM    = "#B8A878";
const GOLD     = "#C9A84C";
const BLUE     = "#2563EB";
const DIVIDER  = "rgba(37,99,235,0.14)";
const EASE     = [0.16, 1, 0.3, 1] as const;

// ─── Password strength ────────────────────────────────────────────────────────

function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak",   color: "#EF4444" };
  if (score <= 2) return { score, label: "Fair",   color: "#F59E0B" };
  if (score <= 3) return { score, label: "Good",   color: "#3B82F6" };
  return             { score, label: "Strong", color: "#22C55E" };
}

// ─── Left panel cycling cards ─────────────────────────────────────────────────

const PROOF_ITEMS = [
  {
    quote: "Spear took our team from 28% to 41% close rate in 60 days.",
    name: "Marcus T.", role: "Agency Owner, Enhance Companies",
    stat: "+47%", statLabel: "Close rate lift",
  },
  {
    quote: "New agents are ramping in 3 weeks instead of 3 months. It's insane.",
    name: "Renee L.", role: "IMO Director, Southeast Region",
    stat: "3x", statLabel: "Faster ramp time",
  },
  {
    quote: "I finally know exactly what I did wrong on every call. No more guessing.",
    name: "Jordan M.", role: "Life Insurance Agent",
    stat: "87%", statLabel: "Avg coaching score",
  },
];

const FEATURES = [
  { icon: BarChart3, label: "NEPQ phase scoring — all 7 phases",      color: "#3B82F6" },
  { icon: Brain,     label: "DISC buyer profiling in real time",       color: "#A855F7" },
  { icon: Zap,       label: "Live objection detection + responses",    color: "#EF4444" },
  { icon: Shield,    label: "Chargeback risk flagged before it happens", color: GOLD },
];

function LeftPanel() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % PROOF_ITEMS.length); setVisible(true); }, 350);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const item = PROOF_ITEMS[idx];

  return (
    <div style={{
      position: "relative", display: "none",
      flexDirection: "column", justifyContent: "space-between",
      width: "45%", minHeight: "100vh", padding: "48px 44px",
      backgroundColor: BG_CARD,
      borderRight: `1px solid ${DIVIDER}`,
      overflow: "hidden",
    }} className="lg:flex">
      {/* Ambient glow */}
      <div style={{ position: "absolute", top: "-20%", left: "-20%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "0", right: "-10%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 65%)", pointerEvents: "none" }} />

      {/* Logo */}
      <div style={{ position: "relative" }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "56px" }}>
          <span style={{ fontSize: "22px", fontWeight: 800, color: CREAM, letterSpacing: "-0.5px", fontFamily: "var(--font-space)" }}>SPEAR</span>
          <span style={{ fontSize: "10px", color: GOLD, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, marginTop: "2px" }}>AI Co-Pilot</span>
        </Link>

        <h2 style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 700, color: CREAM, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: "16px" }}>
          Every call is a rep.<br />
          Start training smarter.
        </h2>
        <p style={{ fontSize: "14px", color: CREAM, lineHeight: 1.75, maxWidth: "340px", marginBottom: "40px", opacity: 0.7 }}>
          Spear analyzes your calls in real time — scoring NEPQ execution, profiling buyers, and coaching you on what to say next.
        </p>

        {/* Feature list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "48px" }}>
          {FEATURES.map(({ icon: Icon, label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 28, height: 28, borderRadius: "6px", backgroundColor: `${color}18`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={13} color={color} />
              </div>
              <span style={{ fontSize: "13px", color: CREAM, opacity: 0.85 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cycling social proof */}
      <div style={{ position: "relative", backgroundColor: BG, border: `1px solid ${DIVIDER}`, borderRadius: "10px", padding: "24px", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />

        <AnimatePresence mode="wait">
          {visible && (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <p style={{ fontSize: "32px", fontWeight: 800, color: GOLD, letterSpacing: "-0.02em", lineHeight: 1 }}>{item.stat}</p>
                  <p style={{ fontSize: "10px", color: CREAM, opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "2px" }}>{item.statLabel}</p>
                </div>
              </div>
              <p style={{ fontSize: "13px", color: CREAM, lineHeight: 1.7, fontStyle: "italic", marginBottom: "16px", opacity: 0.85 }}>
                &ldquo;{item.quote}&rdquo;
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#3B82F6" }}>
                  {item.name[0]}
                </div>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: CREAM }}>{item.name}</p>
                  <p style={{ fontSize: "10px", color: CREAM, opacity: 0.45 }}>{item.role}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dot indicators */}
        <div style={{ display: "flex", gap: "5px", marginTop: "18px" }}>
          {PROOF_ITEMS.map((_, i) => (
            <div key={i} style={{ height: 2, flex: i === idx ? 2 : 1, borderRadius: "2px", backgroundColor: i === idx ? GOLD : "rgba(255,255,255,0.12)", transition: "all 0.4s ease" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Submit button ────────────────────────────────────────────────────────────

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <motion.button
      type="submit"
      disabled={pending}
      whileHover={!pending ? { scale: 1.02, boxShadow: `0 0 28px rgba(37,99,235,0.4)` } : {}}
      whileTap={!pending ? { scale: 0.98 } : {}}
      style={{
        width: "100%", padding: "13px 0",
        backgroundColor: pending ? "rgba(37,99,235,0.5)" : BLUE,
        color: CREAM, border: "none", borderRadius: "8px",
        fontSize: "14px", fontWeight: 700, letterSpacing: "0.04em",
        cursor: pending ? "default" : "pointer",
        fontFamily: "var(--font-space)", display: "flex",
        alignItems: "center", justifyContent: "center", gap: "8px",
        transition: "background-color 0.2s",
      }}
    >
      {pending ? (
        <>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: CREAM }} />
          Creating account…
        </>
      ) : (
        <>{label} <ArrowRight size={15} /></>
      )}
    </motion.button>
  );
}

// ─── Input component ──────────────────────────────────────────────────────────

function Field({
  label, name, type = "text", placeholder, required = true,
  value, onChange, error, hint, children,
}: {
  label: string; name: string; type?: string; placeholder?: string;
  required?: boolean; value: string; onChange: (v: string) => void;
  error?: string; hint?: string; children?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: focused ? CREAM : "rgba(184,168,120,0.6)" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          name={name} type={type} required={required}
          placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", padding: "11px 14px",
            backgroundColor: "rgba(5,10,20,0.7)",
            border: `1px solid ${error ? "#EF4444" : focused ? "rgba(37,99,235,0.6)" : "rgba(37,99,235,0.2)"}`,
            borderRadius: "8px", fontSize: "14px", color: CREAM,
            fontFamily: "var(--font-space)", outline: "none",
            transition: "border-color 0.2s",
            paddingRight: children ? "44px" : "14px",
          }}
        />
        {children && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
            {children}
          </div>
        )}
      </div>
      {error && <p style={{ fontSize: "11px", color: "#EF4444" }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: "11px", color: "rgba(184,168,120,0.5)" }}>{hint}</p>}
    </div>
  );
}

// ─── Role selector ────────────────────────────────────────────────────────────

const ROLES = [
  { value: "agent",  label: "Life Insurance Agent",     icon: User,      desc: "I sell on the phone" },
  { value: "owner",  label: "Agency Owner",              icon: Building2, desc: "I manage a team of agents" },
  { value: "imo",    label: "IMO / Upline",              icon: Users,     desc: "I oversee multiple agencies" },
];

const TEAM_SIZES = ["Just me", "2–5 agents", "6–15 agents", "16–50 agents", "50+ agents"];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; email?: string }>;
}) {
  const [params, setParams] = useState<{ error?: string; success?: string; email?: string }>({});
  const [step, setStep] = useState(1);

  // Account fields
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);

  // Profile fields
  const [role, setRole]         = useState("");
  const [teamSize, setTeamSize] = useState("");

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    searchParams.then(setParams);
  }, [searchParams]);

  const strength = getStrength(password);
  const isSuccess = params.success === "1";

  function validateStep1(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim())           e.name     = "Full name is required";
    if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
    if (password.length < 6)   e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleStep1Next(ev: React.FormEvent) {
    ev.preventDefault();
    if (validateStep1()) setStep(2);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    backgroundColor: "rgba(5,10,20,0.7)",
    border: "1px solid rgba(37,99,235,0.2)",
    borderRadius: "8px", fontSize: "14px", color: CREAM,
    fontFamily: "var(--font-space)", outline: "none",
    transition: "border-color 0.2s",
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px", fontFamily: "var(--font-space)" }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
          style={{ width: "100%", maxWidth: "420px", textAlign: "center" }}>
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
            <CheckCircle2 size={32} color="#22C55E" />
          </motion.div>

          <h1 style={{ fontSize: "28px", fontWeight: 800, color: CREAM, letterSpacing: "-0.02em", marginBottom: "12px" }}>
            Check your email
          </h1>
          <p style={{ fontSize: "15px", color: CREAM, opacity: 0.65, lineHeight: 1.75, marginBottom: "8px" }}>
            We sent a confirmation link to
          </p>
          <p style={{ fontSize: "15px", fontWeight: 700, color: GOLD, marginBottom: "32px" }}>
            {params.email ?? "your email"}
          </p>
          <p style={{ fontSize: "13px", color: CREAM, opacity: 0.5, lineHeight: 1.7, marginBottom: "36px" }}>
            Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.
          </p>

          <Link href="/login" style={{ textDecoration: "none" }}>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              style={{ backgroundColor: BLUE, color: CREAM, border: "none", padding: "12px 40px", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-space)" }}>
              Go to Sign In
            </motion.button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG, display: "flex", fontFamily: "var(--font-space)" }}>
      <LeftPanel />

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>

          {/* Mobile logo */}
          <div className="lg:hidden" style={{ marginBottom: "40px" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: CREAM, letterSpacing: "-0.5px" }}>SPEAR</span>
            </Link>
          </div>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "32px" }}>
            {[1, 2].map(s => (
              <React.Fragment key={s}>
                <div style={{
                  width: s < step ? 24 : s === step ? 24 : 20,
                  height: s === step ? 6 : 4,
                  borderRadius: "4px",
                  backgroundColor: s < step ? "#22C55E" : s === step ? BLUE : "rgba(37,99,235,0.2)",
                  transition: "all 0.3s ease",
                }} />
              </React.Fragment>
            ))}
            <span style={{ fontSize: "11px", color: "rgba(184,168,120,0.5)", marginLeft: "6px", letterSpacing: "0.08em" }}>
              Step {step} of 2
            </span>
          </div>

          <AnimatePresence mode="wait">

            {/* ── STEP 1 — Account info ────────────────────────────────────── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3, ease: EASE }}>
                <h1 style={{ fontSize: "26px", fontWeight: 800, color: CREAM, letterSpacing: "-0.02em", marginBottom: "6px" }}>
                  Create your account
                </h1>
                <p style={{ fontSize: "14px", color: CREAM, opacity: 0.55, marginBottom: "32px", lineHeight: 1.6 }}>
                  Start coaching every call. No credit card required.
                </p>

                <form onSubmit={handleStep1Next} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {/* Name */}
                  <Field label="Full Name" name="name" placeholder="Jane Smith" value={name} onChange={setName} error={errors.name} />

                  {/* Email */}
                  <Field label="Email" name="email" type="email" placeholder="jane@agency.com" value={email} onChange={setEmail} error={errors.email} />

                  {/* Password */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(184,168,120,0.6)" }}>Password</label>
                    <div style={{ position: "relative" }}>
                      <input
                        name="password" type={showPw ? "text" : "password"} required minLength={6}
                        placeholder="Min. 6 characters" value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={{ ...inputStyle, paddingRight: "44px", borderColor: errors.password ? "#EF4444" : "rgba(37,99,235,0.2)" }}
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(184,168,120,0.5)", padding: "2px" }}>
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {errors.password && <p style={{ fontSize: "11px", color: "#EF4444" }}>{errors.password}</p>}

                    {/* Strength meter */}
                    {password.length > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {[1,2,3,4,5].map(i => (
                            <div key={i} style={{ flex: 1, height: 3, borderRadius: "2px", backgroundColor: i <= strength.score ? strength.color : "rgba(37,99,235,0.12)", transition: "background-color 0.3s" }} />
                          ))}
                        </div>
                        <p style={{ fontSize: "10px", color: strength.color, fontWeight: 600 }}>{strength.label} password</p>
                      </motion.div>
                    )}
                  </div>

                  {params.error && (
                    <div style={{ padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", fontSize: "13px", color: "#EF4444" }}>
                      {params.error}
                    </div>
                  )}

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02, boxShadow: `0 0 28px rgba(37,99,235,0.4)` }}
                    whileTap={{ scale: 0.98 }}
                    style={{ width: "100%", padding: "13px 0", backgroundColor: BLUE, color: CREAM, border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "var(--font-space)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px" }}
                  >
                    Continue <ArrowRight size={15} />
                  </motion.button>
                </form>

                <p style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: "rgba(184,168,120,0.5)" }}>
                  Already have an account?{" "}
                  <Link href="/login" style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
                </p>
              </motion.div>
            )}

            {/* ── STEP 2 — About you ───────────────────────────────────────── */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3, ease: EASE }}>
                <button onClick={() => setStep(1)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(184,168,120,0.5)", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginBottom: "24px", padding: 0 }}>
                  <ArrowLeft size={13} /> Back
                </button>

                <h1 style={{ fontSize: "26px", fontWeight: 800, color: CREAM, letterSpacing: "-0.02em", marginBottom: "6px" }}>
                  Tell us about you
                </h1>
                <p style={{ fontSize: "14px", color: CREAM, opacity: 0.55, marginBottom: "32px", lineHeight: 1.6 }}>
                  We&apos;ll personalize your Spear experience.
                </p>

                <form ref={formRef} action={signup} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {/* Hidden fields from step 1 */}
                  <input type="hidden" name="name"     value={name} />
                  <input type="hidden" name="email"    value={email} />
                  <input type="hidden" name="password" value={password} />
                  <input type="hidden" name="role"     value={role} />
                  <input type="hidden" name="teamSize" value={teamSize} />

                  {/* Role */}
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(184,168,120,0.6)", marginBottom: "10px" }}>I am a…</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {ROLES.map(({ value, label, icon: Icon, desc }) => (
                        <motion.button
                          key={value} type="button"
                          onClick={() => setRole(value)}
                          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                          style={{
                            display: "flex", alignItems: "center", gap: "14px",
                            padding: "13px 16px", borderRadius: "8px", border: "none",
                            cursor: "pointer", textAlign: "left",
                            backgroundColor: role === value ? "rgba(37,99,235,0.12)" : "rgba(5,10,20,0.6)",
                            outline: role === value ? `1.5px solid rgba(37,99,235,0.5)` : `1px solid rgba(37,99,235,0.12)`,
                            transition: "all 0.15s",
                            fontFamily: "var(--font-space)",
                          }}
                        >
                          <div style={{ width: 34, height: 34, borderRadius: "8px", backgroundColor: role === value ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon size={16} color={role === value ? "#3B82F6" : "rgba(184,168,120,0.4)"} />
                          </div>
                          <div>
                            <p style={{ fontSize: "13px", fontWeight: 700, color: CREAM, marginBottom: "2px" }}>{label}</p>
                            <p style={{ fontSize: "11px", color: "rgba(184,168,120,0.5)" }}>{desc}</p>
                          </div>
                          {role === value && (
                            <CheckCircle2 size={16} color="#3B82F6" style={{ marginLeft: "auto", flexShrink: 0 }} />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Team size */}
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(184,168,120,0.6)", marginBottom: "10px" }}>Team size</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {TEAM_SIZES.map(size => (
                        <button
                          key={size} type="button"
                          onClick={() => setTeamSize(size)}
                          style={{
                            padding: "8px 16px", borderRadius: "20px", border: "none",
                            cursor: "pointer", fontSize: "12px", fontWeight: 600,
                            fontFamily: "var(--font-space)",
                            backgroundColor: teamSize === size ? "rgba(37,99,235,0.15)" : "rgba(5,10,20,0.6)",
                            outline: teamSize === size ? `1.5px solid rgba(37,99,235,0.5)` : `1px solid rgba(37,99,235,0.12)`,
                            color: teamSize === size ? "#3B82F6" : "rgba(184,168,120,0.6)",
                            transition: "all 0.15s",
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <SubmitButton label="Create my account" />

                  <p style={{ fontSize: "11px", color: "rgba(184,168,120,0.35)", textAlign: "center", lineHeight: 1.65 }}>
                    By creating an account you agree to our Terms of Service and Privacy Policy.
                  </p>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
