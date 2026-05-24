"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";

export interface ComplianceState {
  recordingConsent: "green" | "yellow" | "red";
  tcpaConfirmed: "green" | "yellow" | "red";
  gdprRegion: "green" | "yellow" | "red";
  aiDisclosureActive: "green" | "yellow" | "red";
}

interface Props {
  state?: Partial<ComplianceState>;
}

const DEFAULT_STATE: ComplianceState = {
  recordingConsent: "yellow",
  tcpaConfirmed: "yellow",
  gdprRegion: "green",
  aiDisclosureActive: "green",
};

const STATUS_CONFIG = {
  green:  { label: "Active",   icon: ShieldCheck, cls: "text-emerald-400", dot: "bg-emerald-400" },
  yellow: { label: "Required", icon: ShieldAlert, cls: "text-amber-400",   dot: "bg-amber-400"   },
  red:    { label: "Missing",  icon: ShieldOff,   cls: "text-red-400",     dot: "bg-red-400"     },
};

const LABELS: Record<keyof ComplianceState, string> = {
  recordingConsent:  "Recording Consent",
  tcpaConfirmed:     "TCPA Confirmed",
  gdprRegion:        "GDPR Region",
  aiDisclosureActive:"AI Disclosure",
};

export function ComplianceStatus({ state }: Props) {
  const merged: ComplianceState = { ...DEFAULT_STATE, ...state };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
      <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2.5">Compliance</p>
      {(Object.keys(LABELS) as Array<keyof ComplianceState>).map((key) => {
        const status = merged[key];
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={key} className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">{LABELS[key]}</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
              <span className={`text-[10px] font-medium ${cfg.cls}`}>{cfg.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
