"use client";

import React, { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle2, XCircle, RefreshCw, Zap, ExternalLink, Copy } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectStatus = "idle" | "loading" | "success" | "error";
type DisconnectStatus = "idle" | "loading";

interface GHLState {
  connected: boolean;
  lastSync: string | null;
  locationId: string;
}

// ─── GHL Card ─────────────────────────────────────────────────────────────────

function GHLCard() {
  const [apiKey, setApiKey]       = useState("");
  const [locationId, setLocationId] = useState("");
  const [showKey, setShowKey]     = useState(false);
  const [status, setStatus]       = useState<ConnectStatus>("idle");
  const [errorMsg, setErrorMsg]   = useState("");
  const [disconnectStatus, setDisconnectStatus] = useState<DisconnectStatus>("idle");
  const [ghlState, setGhlState]   = useState<GHLState | null>(null);

  useEffect(() => {
    fetch("/api/integrations/ghl/status")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setGhlState(d); })
      .catch(() => {});
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/integrations/ghl/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, locationId }),
      });
      const json = await res.json();
      if (!res.ok) { setStatus("error"); setErrorMsg(json.error ?? "Connection failed"); return; }
      setStatus("success");
      setGhlState({ connected: true, lastSync: new Date().toISOString(), locationId });
      setApiKey("");
    } catch {
      setStatus("error");
      setErrorMsg("Network error — try again");
    }
  }

  async function handleDisconnect() {
    setDisconnectStatus("loading");
    await fetch("/api/integrations/ghl/disconnect", { method: "POST" });
    setGhlState(null);
    setDisconnectStatus("idle");
    setStatus("idle");
  }

  const isConnected = ghlState?.connected;

  return (
    <div style={{
      backgroundColor: "#080F1E",
      border: "1px solid rgba(37,99,235,0.18)",
      borderTop: isConnected ? "3px solid #22C55E" : "3px solid rgba(37,99,235,0.4)",
      borderRadius: "10px",
      padding: "32px",
      maxWidth: "600px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "8px",
            backgroundColor: "rgba(37,99,235,0.1)",
            border: "1px solid rgba(37,99,235,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px",
          }}>🔗</div>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#FDF6EC" }}>GoHighLevel</p>
            <p style={{ fontSize: "11px", color: "#6B7A8D", letterSpacing: "0.06em" }}>CRM Integration</p>
          </div>
        </div>

        {/* Status badge */}
        {isConnected ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            backgroundColor: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: "20px", padding: "4px 12px",
            fontSize: "11px", fontWeight: 700, color: "#22C55E",
          }}>
            <CheckCircle2 size={11} /> Connected
          </span>
        ) : (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: "20px", padding: "4px 12px",
            fontSize: "11px", fontWeight: 700, color: "#EF4444",
          }}>
            <XCircle size={11} /> Not Connected
          </span>
        )}
      </div>

      {isConnected ? (
        // ── Connected state ──────────────────────────────────────────────────
        <div>
          <div style={{
            backgroundColor: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.15)",
            borderRadius: "6px", padding: "14px 16px", marginBottom: "20px",
          }}>
            <p style={{ fontSize: "12px", color: "#22C55E", fontWeight: 600, marginBottom: "4px" }}>✓ Spear is syncing call data to GoHighLevel</p>
            {ghlState?.lastSync && (
              <p style={{ fontSize: "11px", color: "#6B7A8D" }}>
                Last synced: {new Date(ghlState.lastSync).toLocaleString()}
              </p>
            )}
            {ghlState?.locationId && (
              <p style={{ fontSize: "11px", color: "#6B7A8D", marginTop: "2px" }}>Location ID: {ghlState.locationId}</p>
            )}
          </div>

          <div style={{ marginBottom: "20px" }}>
            <p style={{ fontSize: "12px", color: "#FDF6EC", fontWeight: 600, marginBottom: "10px" }}>What syncs on every call:</p>
            <ul style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {[
                "NEPQ score, DISC profile, and call outcome",
                "Objections raised + top coaching improvement",
                "Activity note added to contact timeline",
                "Contact moved to pipeline stage based on outcome",
              ].map(item => (
                <li key={item} style={{ display: "flex", gap: "8px", fontSize: "12px", color: "#8B909A" }}>
                  <span style={{ color: "#22C55E" }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={disconnectStatus === "loading"}
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "6px", padding: "8px 20px",
              fontSize: "12px", fontWeight: 600, color: "#EF4444",
              cursor: "pointer", fontFamily: "var(--font-space)",
            }}
          >
            {disconnectStatus === "loading" ? "Disconnecting…" : "Disconnect GHL"}
          </button>
        </div>
      ) : (
        // ── Connect form ─────────────────────────────────────────────────────
        <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "13px", color: "#8B909A", lineHeight: 1.65 }}>
            After every call, Spear automatically updates the matching GHL contact with the NEPQ score, DISC profile, objections, and full coaching note — and moves them to the correct pipeline stage.
          </p>

          {/* API Key */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B7A8D", marginBottom: "6px" }}>
              GHL API Key
            </label>
            <div style={{ position: "relative" }}>
              <input
                required
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Bearer token from GHL"
                style={{
                  width: "100%", padding: "10px 40px 10px 12px",
                  backgroundColor: "rgba(5,10,20,0.8)",
                  border: "1px solid rgba(37,99,235,0.22)",
                  borderRadius: "6px", fontSize: "13px",
                  color: "#FDF6EC", fontFamily: "var(--font-space)", outline: "none",
                }}
              />
              <button type="button" onClick={() => setShowKey(v => !v)} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "#6B7A8D", padding: "2px",
              }}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Location ID */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B7A8D", marginBottom: "6px" }}>
              GHL Location ID
            </label>
            <input
              required
              type="text"
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              placeholder="e.g. abc123xyz"
              style={{
                width: "100%", padding: "10px 12px",
                backgroundColor: "rgba(5,10,20,0.8)",
                border: "1px solid rgba(37,99,235,0.22)",
                borderRadius: "6px", fontSize: "13px",
                color: "#FDF6EC", fontFamily: "var(--font-space)", outline: "none",
              }}
            />
          </div>

          {/* Error */}
          {status === "error" && (
            <p style={{ fontSize: "12px", color: "#EF4444", padding: "8px 12px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px" }}>
              {errorMsg}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "loading"}
            style={{
              backgroundColor: "#2563EB", color: "#FDF6EC", border: "none",
              padding: "11px 0", fontSize: "13px", fontWeight: 700,
              letterSpacing: "0.06em", cursor: status === "loading" ? "default" : "pointer",
              borderRadius: "6px", fontFamily: "var(--font-space)",
              opacity: status === "loading" ? 0.7 : 1,
            }}
          >
            {status === "loading" ? "Validating…" : "Connect GoHighLevel"}
          </button>

          {/* Help */}
          <p style={{ fontSize: "11px", color: "#6B7A8D", lineHeight: 1.65 }}>
            Find your API key in <strong style={{ color: "#8B909A" }}>GoHighLevel → Settings → Integrations → API Keys</strong>.
            Your Location ID is in the URL of your GHL sub-account.
          </p>
        </form>
      )}

      {/* Custom fields setup guide */}
      <details style={{ marginTop: "24px" }}>
        <summary style={{ fontSize: "11px", fontWeight: 700, color: "#6B7A8D", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", userSelect: "none" }}>
          GHL Custom Fields Setup ▸
        </summary>
        <div style={{ marginTop: "12px", padding: "14px", backgroundColor: "rgba(5,10,20,0.5)", borderRadius: "6px", border: "1px solid rgba(37,99,235,0.1)" }}>
          <p style={{ fontSize: "11px", color: "#8B909A", marginBottom: "10px", lineHeight: 1.6 }}>
            Create these custom fields in <strong style={{ color: "#FDF6EC" }}>GHL → Settings → Custom Fields → Contacts</strong>:
          </p>
          <ul style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {[
              "spear_call_score",
              "spear_disc_profile",
              "spear_nepq_phase_reached",
              "spear_call_outcome",
              "spear_objections_raised",
              "spear_top_improvement",
              "spear_last_call_date",
            ].map(field => (
              <li key={field} style={{ fontFamily: "monospace", fontSize: "11px", color: "#C9A84C", padding: "2px 0" }}>
                {field}
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* Webhook URL */}
      <div style={{ marginTop: "20px", padding: "14px", backgroundColor: "rgba(5,10,20,0.5)", borderRadius: "6px", border: "1px solid rgba(37,99,235,0.1)" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#6B7A8D", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Inbound Webhook URL</p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <code style={{ fontSize: "11px", color: "#C9A84C", flex: 1, wordBreak: "break-all" }}>
            {typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/ghl/webhook
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(
              `${window.location.origin}/api/integrations/ghl/webhook`
            )}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7A8D", padding: "2px" }}
          >
            <Copy size={13} />
          </button>
        </div>
        <p style={{ fontSize: "10px", color: "#6B7A8D", marginTop: "6px", lineHeight: 1.6 }}>
          Paste this into GHL → Settings → Integrations → Webhooks to enable bidirectional sync.
        </p>
      </div>
    </div>
  );
}

// ─── Zapier Card ──────────────────────────────────────────────────────────────

function ZapierCard() {
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    navigator.clipboard.writeText(`${window.location.origin}/api/integrations/zapier/webhook`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      backgroundColor: "#080F1E",
      border: "1px solid rgba(37,99,235,0.18)",
      borderTop: "3px solid rgba(255,110,39,0.6)",
      borderRadius: "10px",
      padding: "32px",
      maxWidth: "600px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "8px",
          backgroundColor: "rgba(255,110,39,0.08)",
          border: "1px solid rgba(255,110,39,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "18px",
        }}>⚡</div>
        <div>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#FDF6EC" }}>Zapier</p>
          <p style={{ fontSize: "11px", color: "#6B7A8D", letterSpacing: "0.06em" }}>Connect to 6,000+ apps</p>
        </div>
      </div>

      <p style={{ fontSize: "13px", color: "#8B909A", lineHeight: 1.7, marginBottom: "20px" }}>
        Don&apos;t use GoHighLevel? Connect Spear to any CRM, spreadsheet, or automation tool via Zapier — no code required.
      </p>

      <div style={{ marginBottom: "18px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#6B7A8D", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
          Spear sends on every call:
        </p>
        <ul style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {[
            "Call ID, date, and duration",
            "Overall NEPQ score (0–10)",
            "DISC profile detected",
            "Outcome (closed / not closed / follow up)",
            "Objections raised (list)",
            "Agent and prospect talk ratio",
            "Link to full Spear report",
          ].map(item => (
            <li key={item} style={{ display: "flex", gap: "8px", fontSize: "12px", color: "#8B909A" }}>
              <span style={{ color: "#C9A84C" }}>→</span> {item}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ padding: "14px", backgroundColor: "rgba(5,10,20,0.5)", borderRadius: "6px", border: "1px solid rgba(37,99,235,0.1)", marginBottom: "16px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#6B7A8D", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Your Zapier Webhook URL</p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <code style={{ fontSize: "11px", color: "#C9A84C", flex: 1, wordBreak: "break-all" }}>
            {typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/zapier/webhook
          </code>
          <button onClick={copyUrl} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#22C55E" : "#6B7A8D", padding: "2px" }}>
            {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      <a
        href="https://zapier.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          backgroundColor: "rgba(255,110,39,0.1)", border: "1px solid rgba(255,110,39,0.25)",
          borderRadius: "6px", padding: "9px 18px",
          fontSize: "12px", fontWeight: 700, color: "#FF6E27",
          textDecoration: "none",
        }}
      >
        <Zap size={13} /> Open Zapier <ExternalLink size={11} />
      </a>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "48px 32px", fontFamily: "var(--font-space)" }}>
      <div style={{ marginBottom: "40px" }}>
        <p style={{ fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: "#6B7A8D", fontWeight: 700, marginBottom: "8px" }}>
          Settings
        </p>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#FDF6EC", letterSpacing: "-0.02em", marginBottom: "8px" }}>
          Integrations
        </h1>
        <p style={{ fontSize: "14px", color: "#8B909A", lineHeight: 1.65 }}>
          Connect Spear to your CRM so every call automatically syncs coaching data, scores, and outcomes.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <GHLCard />
        <ZapierCard />
      </div>
    </div>
  );
}
