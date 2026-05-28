"use client";

import { useSearchParams } from "next/navigation";
import { forgotPassword } from "@/app/auth/actions";
import { useFormStatus } from "react-dom";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const CREAM = "#B8A878";
const GOLD  = "#C9A84C";
const BLUE  = "#2563EB";
const BG    = "#0B1221";
const CARD  = "#0D1527";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: "100%", padding: "13px",
        background: pending ? "#1A3A7A" : BLUE,
        color: "#fff", border: "none", borderRadius: "8px",
        fontWeight: 700, fontSize: "14px",
        letterSpacing: "0.04em", cursor: pending ? "not-allowed" : "pointer",
        transition: "background 0.2s",
        fontFamily: "var(--font-space), system-ui, sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      }}
    >
      {pending ? (
        <>
          <span style={{
            width: 13, height: 13, borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff",
            animation: "btn-spin 0.65s linear infinite", display: "inline-block",
          }} />
          Sending…
        </>
      ) : "Send Reset Link"}
    </button>
  );
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const error   = searchParams.get("error");
  const success = searchParams.get("success") === "1";
  const email   = searchParams.get("email") ?? "";

  if (success) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "var(--font-space), system-ui, sans-serif" }}>
        <div style={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
          }}>
            <CheckCircle2 size={28} color="#22C55E" />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: CREAM, marginBottom: "10px" }}>Check your email</h1>
          <p style={{ fontSize: "14px", color: "rgba(184,168,120,0.65)", lineHeight: 1.7, marginBottom: "8px" }}>
            We sent a password reset link to
          </p>
          <p style={{ fontSize: "15px", fontWeight: 700, color: GOLD, marginBottom: "32px" }}>{email || "your email"}</p>
          <p style={{ fontSize: "13px", color: "rgba(184,168,120,0.5)", lineHeight: 1.7, marginBottom: "28px" }}>
            Click the link in the email to set a new password. Check your spam folder if you don&apos;t see it within a minute.
          </p>
          <Link href="/login" style={{ color: GOLD, fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "var(--font-space), system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "380px" }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px", marginBottom: "40px" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "7px",
            background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: GOLD, fontWeight: 900, fontSize: "13px" }}>S</span>
          </div>
          <span style={{ color: CREAM, fontWeight: 800, fontSize: "15px", letterSpacing: "0.1em" }}>SPEAR</span>
        </Link>

        {/* Heading */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: CREAM, marginBottom: "8px" }}>Forgot password?</h1>
          <p style={{ fontSize: "14px", color: "rgba(184,168,120,0.6)", lineHeight: 1.65 }}>
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form action={forgotPassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
                width: "100%", padding: "11px 14px",
                borderRadius: "8px", border: "1px solid rgba(201,168,76,0.15)",
                background: CARD, color: CREAM, fontSize: "14px", outline: "none",
                transition: "border-color 0.2s",
                fontFamily: "var(--font-space), system-ui, sans-serif",
              }}
              onFocus={e  => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)")}
              onBlur={e   => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.15)")}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "8px",
              border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)",
              fontSize: "13px", color: "#FCA5A5",
            }}>
              {error}
            </div>
          )}

          <SubmitButton />
        </form>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "rgba(184,168,120,0.55)", textDecoration: "none" }}>
            <ArrowLeft size={13} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
