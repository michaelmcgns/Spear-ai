"use client";

import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/app/auth/actions";
import { useFormStatus } from "react-dom";
import { useState, Suspense } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

const CREAM = "#B8A878";
const GOLD  = "#C9A84C";
const BLUE  = "#2563EB";
const BG    = "#0B1221";
const CARD  = "#0D1527";

function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (pw.length >= 12)         score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak",   color: "#EF4444" };
  if (score <= 2) return { score, label: "Fair",   color: "#F59E0B" };
  if (score <= 3) return { score, label: "Good",   color: "#3B82F6" };
  return             { score, label: "Strong", color: "#22C55E" };
}

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
          Updating…
        </>
      ) : "Set New Password"}
    </button>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mismatch, setMismatch]       = useState(false);

  const strength = getStrength(password);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirm && password !== confirm) {
      e.preventDefault();
      setMismatch(true);
    } else {
      setMismatch(false);
    }
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

        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: CREAM, marginBottom: "8px" }}>Set new password</h1>
          <p style={{ fontSize: "14px", color: "rgba(184,168,120,0.6)", lineHeight: 1.65 }}>
            Choose a strong password for your Spear account.
          </p>
        </div>

        <form action={resetPassword} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

          {/* New password */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: CREAM, letterSpacing: "0.03em" }}>
              New password
            </label>
            <div style={{ position: "relative" }}>
              <input
                name="password"
                type={showPass ? "text" : "password"}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: "100%", padding: "11px 44px 11px 14px",
                  borderRadius: "8px", border: "1px solid rgba(201,168,76,0.15)",
                  background: CARD, color: CREAM, fontSize: "14px", outline: "none",
                  transition: "border-color 0.2s",
                  fontFamily: "var(--font-space), system-ui, sans-serif",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)")}
                onBlur={e  => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.15)")}
              />
              <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(184,168,120,0.45)", padding: 0, display: "flex" }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Strength meter */}
            {password.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", gap: "4px" }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: "2px", backgroundColor: i <= strength.score ? strength.color : "rgba(37,99,235,0.12)", transition: "background-color 0.3s" }} />
                  ))}
                </div>
                <p style={{ fontSize: "10px", color: strength.color, fontWeight: 600 }}>{strength.label} password</p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: CREAM, letterSpacing: "0.03em" }}>
              Confirm password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirm ? "text" : "password"}
                required
                placeholder="Repeat your password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setMismatch(false); }}
                style={{
                  width: "100%", padding: "11px 44px 11px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${mismatch ? "#EF4444" : "rgba(201,168,76,0.15)"}`,
                  background: CARD, color: CREAM, fontSize: "14px", outline: "none",
                  transition: "border-color 0.2s",
                  fontFamily: "var(--font-space), system-ui, sans-serif",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = mismatch ? "#EF4444" : "rgba(201,168,76,0.4)")}
                onBlur={e  => (e.currentTarget.style.borderColor = mismatch ? "#EF4444" : "rgba(201,168,76,0.15)")}
              />
              <button type="button" onClick={() => setShowConfirm(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(184,168,120,0.45)", padding: 0, display: "flex" }}>
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {mismatch && <p style={{ fontSize: "11px", color: "#EF4444" }}>Passwords don&apos;t match</p>}
          </div>

          {/* Server error */}
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
          <Link href="/login" style={{ fontSize: "13px", color: "rgba(184,168,120,0.5)", textDecoration: "none" }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
