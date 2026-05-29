"use client";

import React, { useState } from "react";
import { ShieldCheck, AlertTriangle, X } from "lucide-react";
import type { ConsentRequirement } from "@/lib/compliance/consentStates";

interface Props {
  consentReq: ConsentRequirement;
  sessionId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConsentModal({ consentReq, sessionId, onConfirm, onCancel }: Props) {
  const [tcpaChecked, setTcpaChecked] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [logging, setLogging] = useState(false);

  const needsConsent = consentReq.required;
  const canConfirm = tcpaChecked && (!needsConsent || consentChecked);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setLogging(true);

    try {
      // Log consent confirmation to consent_log table
      if (needsConsent) {
        await fetch("/api/compliance/log-consent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prospectState: consentReq.state,
            sessionId,
            confirmedAt: new Date().toISOString(),
          }),
        });
      }
    } catch {
      // Non-blocking — proceed even if logging fails
    } finally {
      setLogging(false);
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 border border-indigo-500/25">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Pre-Call Compliance</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Required before AI analysis</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Recording consent disclosure */}
          {needsConsent && (
            <div className={`rounded-lg border p-3.5 space-y-2.5 ${
              consentReq.florida
                ? "border-amber-700/50 bg-amber-950/30"
                : "border-zinc-700 bg-zinc-800/50"
            }`}>
              {consentReq.stateUnknown ? (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-400">
                    Prospect state unknown — consent required
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-400">
                    {consentReq.state} — All-Party Consent State
                  </p>
                </div>
              )}

              <p className="text-xs text-zinc-300 leading-relaxed">
                This call may be recorded and analyzed by AI for coaching purposes.
                By continuing, you confirm the prospect consents to recording.
              </p>

              {consentReq.florida && (
                <p className="text-xs text-amber-300 leading-relaxed border-t border-amber-700/40 pt-2.5 mt-2">
                  <strong>Florida requires all-party consent.</strong> Do not proceed unless
                  the prospect has verbally agreed to recording on this call.
                </p>
              )}

              <label className="flex items-start gap-2.5 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded accent-indigo-500 shrink-0"
                />
                <span className="text-xs text-zinc-300 leading-relaxed">
                  I confirm the prospect has been informed of and consented to call recording and AI analysis.
                </span>
              </label>
            </div>
          )}

          {/* TCPA confirmation */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 mb-2.5">
              TCPA Compliance
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={tcpaChecked}
                onChange={(e) => setTcpaChecked(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded accent-indigo-500 shrink-0"
              />
              <span className="text-xs text-zinc-300 leading-relaxed">
                I confirm this lead has provided express written consent to be contacted and recorded.
              </span>
            </label>
          </div>

          {/* Session ID */}
          <p className="text-[9px] text-zinc-700 font-mono">Session: {sessionId}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 p-5 border-t border-zinc-800">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || logging}
            className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {logging ? "Logging…" : "Confirm & Start Analysis"}
          </button>
        </div>
      </div>
    </div>
  );
}
