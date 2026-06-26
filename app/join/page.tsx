"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function JoinContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token  = params.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid invite link.");
      return;
    }
    acceptInvite(token);
  }, [token]);

  async function acceptInvite(t: string) {
    const supabase = createClient();

    // Must be logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Send to login, come back here after
      router.push(`/login?next=/join?token=${t}`);
      return;
    }

    // Find the pending invite
    const { data: invite, error } = await supabase
      .from("org_members")
      .select("id, org_id, invite_accepted")
      .eq("invite_token", t)
      .maybeSingle();

    if (error || !invite) {
      setStatus("error");
      setMessage("This invite link is invalid or has expired.");
      return;
    }

    if (invite.invite_accepted) {
      setStatus("success");
      setMessage("You're already on the team!");
      setTimeout(() => router.push("/dashboard"), 1500);
      return;
    }

    // Accept: link the user to the org
    const { error: updateErr } = await supabase
      .from("org_members")
      .update({
        user_id:         user.id,
        invite_accepted: true,
        joined_at:       new Date().toISOString(),
        invite_token:    null, // consume token
      })
      .eq("id", invite.id);

    if (updateErr) {
      setStatus("error");
      setMessage("Something went wrong accepting the invite. Please try again.");
      return;
    }

    setStatus("success");
    setMessage("You've joined the team! Redirecting to your dashboard...");
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0F172A",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{
        background: "#1E293B", border: "1px solid #334155",
        borderRadius: "16px", padding: "48px 40px",
        maxWidth: "420px", width: "100%", textAlign: "center",
      }}>
        {/* Logo */}
        <div style={{
          fontSize: "32px", fontWeight: 900, color: "#FFFFFF",
          letterSpacing: "-0.04em", marginBottom: "8px",
          fontFamily: "system-ui, sans-serif",
        }}>
          SPEAR
        </div>
        <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "40px" }}>
          AI Co-Pilot for Sales Teams
        </p>

        {status === "loading" && (
          <>
            <div style={{
              width: "40px", height: "40px", borderRadius: "50%",
              border: "3px solid #334155", borderTopColor: "#2563EB",
              animation: "spin 0.8s linear infinite", margin: "0 auto 20px",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "#94A3B8", fontSize: "14px" }}>Accepting your invite...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "rgba(20, 33, 61, 0.15)", border: "2px solid #14213D",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: "24px",
            }}>
              ✓
            </div>
            <p style={{ color: "#2C4A75", fontSize: "16px", fontWeight: 600 }}>
              {message}
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "rgba(220, 38, 38, 0.1)", border: "2px solid #DC2626",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: "24px",
            }}>
              ✕
            </div>
            <p style={{ color: "#F87171", fontSize: "15px", fontWeight: 600, marginBottom: "8px" }}>
              Invite Error
            </p>
            <p style={{ color: "#94A3B8", fontSize: "13px" }}>{message}</p>
            <a href="/login" style={{
              display: "inline-block", marginTop: "24px",
              padding: "10px 24px", background: "#2563EB", borderRadius: "8px",
              color: "#fff", fontSize: "14px", fontWeight: 600, textDecoration: "none",
            }}>
              Go to Login
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          minHeight: "100vh", background: "#0F172A",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "50%",
            border: "3px solid #334155", borderTopColor: "#2563EB",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
