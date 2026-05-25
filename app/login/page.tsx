"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/auth/actions";
import { useFormStatus } from "react-dom";
import { useState, Suspense } from "react";
import { Eye, EyeOff, BarChart3, Brain, MessageSquare, Mic } from "lucide-react";

const CREAM = "#B8A878";
const GOLD  = "#C9A84C";
const BLUE  = "#2563EB";
const BG    = "#0B1221";
const CARD  = "#0D1527";

const features = [
  { icon: BarChart3, text: "NEPQ Phase Scoring across 7 phases" },
  { icon: Brain,     text: "DISC Buyer Profiling from language and tone" },
  { icon: MessageSquare, text: "Objection detection with NEPQ responses" },
  { icon: Mic,       text: "Talk Ratio Analysis — stop pitching, start closing" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: "100%",
        padding: "12px",
        borderRadius: "8px",
        background: pending ? "#1A3A7A" : BLUE,
        color: "#fff",
        fontWeight: 700,
        fontSize: "14px",
        letterSpacing: "0.03em",
        border: "none",
        cursor: pending ? "not-allowed" : "pointer",
        transition: "background 0.2s",
        marginTop: "8px",
      }}
    >
      {pending ? "Signing in…" : "Sign In"}
    </button>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const error   = searchParams.get("error");
  const message = searchParams.get("message");
  const [showPass, setShowPass] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: BG }}>
      {/* ── Left brand panel ── */}
      <div
        style={{
          display: "none",
          width: "50%",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          borderRight: `1px solid rgba(201,168,76,0.12)`,
          position: "relative",
          overflow: "hidden",
        }}
        className="lg-panel"
      >
        {/* ambient glows */}
        <div style={{
          position: "absolute", top: "-80px", left: "-80px",
          width: "320px", height: "320px",
          background: "rgba(37,99,235,0.06)", borderRadius: "50%",
          filter: "blur(60px)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "0", right: "0",
          width: "240px", height: "240px",
          background: "rgba(201,168,76,0.04)", borderRadius: "50%",
          filter: "blur(50px)", pointerEvents: "none",
        }} />

        <div style={{ position: "relative" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "56px" }}>
            <div style={{
              width: "36px", height: "36px",
              background: "rgba(201,168,76,0.12)",
              border: `1px solid rgba(201,168,76,0.25)`,
              borderRadius: "8px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: GOLD, fontWeight: 900, fontSize: "14px" }}>S</span>
            </div>
            <div>
              <p style={{ color: CREAM, fontWeight: 800, fontSize: "16px", letterSpacing: "0.12em" }}>SPEAR</p>
              <p style={{ color: "rgba(184,168,120,0.5)", fontSize: "10px", letterSpacing: "0.08em" }}>AI SALES CO-PILOT</p>
            </div>
          </div>

          <h2 style={{ fontSize: "30px", fontWeight: 700, color: CREAM, lineHeight: 1.3, marginBottom: "16px" }}>
            The last call coaching<br />tool your team will need.
          </h2>
          <p style={{ fontSize: "14px", color: "rgba(184,168,120,0.7)", marginBottom: "40px", lineHeight: 1.7, maxWidth: "340px" }}>
            NEPQ scoring. DISC profiling. Objection detection. Talk ratio analysis. After every call, automatically.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {features.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "6px",
                  background: "rgba(201,168,76,0.08)",
                  border: `1px solid rgba(201,168,76,0.15)`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={13} color={GOLD} />
                </div>
                <p style={{ fontSize: "13px", color: "rgba(184,168,120,0.8)", lineHeight: 1.5, paddingTop: "4px" }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div style={{
          position: "relative",
          borderRadius: "12px",
          border: `1px solid rgba(201,168,76,0.12)`,
          background: "rgba(13,21,39,0.8)",
          padding: "20px",
        }}>
          <div style={{ display: "flex", gap: "2px", marginBottom: "12px" }}>
            {[...Array(5)].map((_, i) => (
              <span key={i} style={{ color: GOLD, fontSize: "12px" }}>★</span>
            ))}
          </div>
          <p style={{ fontSize: "13px", color: CREAM, lineHeight: 1.7, fontStyle: "italic", marginBottom: "16px" }}>
            &ldquo;Spear took our team from a 28% close rate to 41% in 60 days.
            Every agent gets coached after every call now — not just the ones the manager has time to review.&rdquo;
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "50%",
              background: `rgba(201,168,76,0.15)`,
              border: `1px solid rgba(201,168,76,0.25)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: "13px", color: GOLD,
            }}>M</div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: CREAM }}>Marcus T.</p>
              <p style={{ fontSize: "11px", color: "rgba(184,168,120,0.5)" }}>Agency Owner, Enhance Companies</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: "380px" }}>
          {/* Mobile logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "40px" }}>
            <div style={{
              width: "32px", height: "32px",
              background: "rgba(201,168,76,0.12)",
              border: `1px solid rgba(201,168,76,0.2)`,
              borderRadius: "7px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: GOLD, fontWeight: 900, fontSize: "13px" }}>S</span>
            </div>
            <span style={{ color: CREAM, fontWeight: 800, fontSize: "15px", letterSpacing: "0.1em" }}>SPEAR</span>
          </div>

          <div style={{ marginBottom: "32px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: CREAM, marginBottom: "8px" }}>Welcome back</h1>
            <p style={{ fontSize: "14px", color: "rgba(184,168,120,0.6)" }}>Sign in to your account</p>
          </div>

          <form action={login} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: CREAM, marginBottom: "6px", letterSpacing: "0.03em" }}>
                Email address
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: `1px solid rgba(201,168,76,0.15)`,
                  background: CARD,
                  color: CREAM,
                  fontSize: "14px",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)")}
                onBlur={e  => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.15)")}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: CREAM, letterSpacing: "0.03em" }}>
                  Password
                </label>
                <Link href="/forgot-password" style={{ fontSize: "12px", color: GOLD, textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  name="password"
                  type={showPass ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 14px",
                    borderRadius: "8px",
                    border: `1px solid rgba(201,168,76,0.15)`,
                    background: CARD,
                    color: CREAM,
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)")}
                  onBlur={e  => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.15)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(184,168,120,0.5)", padding: "0",
                    display: "flex", alignItems: "center",
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error / message banners */}
            {error && (
              <div style={{
                borderRadius: "8px",
                border: "1px solid rgba(239,68,68,0.3)",
                background: "rgba(239,68,68,0.08)",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#FCA5A5",
              }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{
                borderRadius: "8px",
                border: "1px solid rgba(34,197,94,0.3)",
                background: "rgba(34,197,94,0.08)",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#86EFAC",
              }}>
                {message}
              </div>
            )}

            <SubmitButton />
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "24px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(201,168,76,0.1)" }} />
            <span style={{ fontSize: "12px", color: "rgba(184,168,120,0.4)" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(201,168,76,0.1)" }} />
          </div>

          <p style={{ textAlign: "center", fontSize: "13px", color: "rgba(184,168,120,0.6)" }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" style={{ color: GOLD, fontWeight: 600, textDecoration: "none" }}>
              Create one free →
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .lg-panel { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
