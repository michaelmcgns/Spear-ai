"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function RedeemForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Auto-apply if code is in the URL
  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
      redeem(urlCode.toUpperCase());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function redeem(codeToRedeem?: string) {
    const finalCode = (codeToRedeem ?? code).trim().toUpperCase();
    if (!finalCode) return;
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: finalCode }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; label?: string; durationDays?: number };
      if (data.ok) {
        setStatus("success");
        setMessage(`${data.label} activated! Redirecting to your dashboard...`);
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Invalid code.");
        setLoading(false);
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a1628",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "var(--font-space), system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        {/* Logo */}
        <p style={{ fontSize: "22px", fontWeight: 800, color: "#B8A878", letterSpacing: "-0.5px", marginBottom: "8px" }}>
          SPEAR
        </p>
        <p style={{ fontSize: "11px", color: "rgba(184,168,120,0.5)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "48px" }}>
          AI Sales Co-Pilot
        </p>

        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(184,168,120,0.15)",
          borderRadius: "16px",
          padding: "40px 32px",
        }}>
          {status === "success" ? (
            <div>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>✓</div>
              <p style={{ fontSize: "18px", fontWeight: 700, color: "#B8A878", marginBottom: "8px" }}>You&apos;re in.</p>
              <p style={{ fontSize: "13px", color: "rgba(184,168,120,0.6)", lineHeight: 1.6 }}>{message}</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: "20px", fontWeight: 700, color: "#e8d5b0", marginBottom: "8px" }}>
                Activate Your Access
              </p>
              <p style={{ fontSize: "13px", color: "rgba(184,168,120,0.55)", lineHeight: 1.65, marginBottom: "32px" }}>
                Enter your promo code below to unlock Spear free.
              </p>

              {loading && !message ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "rgba(184,168,120,0.6)", fontSize: "13px" }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(184,168,120,0.2)", borderTopColor: "#B8A878", animation: "spin 0.65s linear infinite", display: "inline-block" }} />
                  Activating...
                </div>
              ) : (
                <>
                  <input
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setStatus("idle"); }}
                    onKeyDown={e => e.key === "Enter" && redeem()}
                    placeholder="Enter code"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      border: status === "error" ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(184,168,120,0.2)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#e8d5b0",
                      fontSize: "16px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textAlign: "center",
                      outline: "none",
                      marginBottom: "12px",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />

                  {status === "error" && (
                    <p style={{ fontSize: "12px", color: "#EF4444", marginBottom: "12px" }}>{message}</p>
                  )}

                  <button
                    onClick={() => redeem()}
                    disabled={loading || !code.trim()}
                    style={{
                      width: "100%",
                      padding: "13px",
                      borderRadius: "8px",
                      border: "none",
                      background: loading || !code.trim() ? "rgba(201,168,76,0.3)" : "#C9A84C",
                      color: "#0a1628",
                      fontWeight: 800,
                      fontSize: "13px",
                      letterSpacing: "0.06em",
                      cursor: loading || !code.trim() ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Activate
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <p style={{ marginTop: "24px", fontSize: "12px", color: "rgba(184,168,120,0.35)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "rgba(184,168,120,0.6)", textDecoration: "underline" }}>Sign in</Link>
          {" · "}
          <Link href="/signup" style={{ color: "rgba(184,168,120,0.6)", textDecoration: "underline" }}>Create account</Link>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function RedeemPage() {
  return (
    <Suspense>
      <RedeemForm />
    </Suspense>
  );
}
