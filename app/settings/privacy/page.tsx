"use client";

import React, { useState } from "react";
import {
  Shield, Download, Trash2, ToggleLeft, ToggleRight,
  FileText, Mic, BarChart2, MapPin, Monitor, CheckCircle2,
} from "lucide-react";
import Link from "next/link";

const DATA_COLLECTED = [
  { icon: Mic,       label: "Call Recordings",     description: "Audio files you upload for analysis. Deleted after your retention period (30 days EU, 1 year US)." },
  { icon: FileText,  label: "Call Transcripts",     description: "Text transcriptions of your calls with speaker labels." },
  { icon: BarChart2, label: "NEPQ Scores & Reports",description: "Coaching reports, phase scores, objection logs, and DISC profiles generated from your calls." },
  { icon: MapPin,    label: "Location & Region",    description: "Country code used to apply GDPR and applicable state consent rules." },
  { icon: Monitor,   label: "Device & Session Info",description: "Browser type, IP address, and session tokens for authentication and security." },
];

export default function PrivacyCenterPage() {
  const [analyticsOptOut, setAnalyticsOptOut] = useState(false);
  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "done">("idle");
  const [deleteState, setDeleteState]   = useState<"idle" | "confirm" | "loading" | "done">("idle");
  const [deletionRequestState, setDeletionRequestState] = useState<"idle" | "loading" | "done">("idle");

  const handleDownload = async () => {
    setDownloadState("loading");
    try {
      const res = await fetch("/api/compliance/export-data");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spear-data-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadState("done");
    } catch {
      setDownloadState("idle");
      alert("Export failed — please try again or contact support.");
    }
  };

  const handleDeleteRequest = async () => {
    setDeletionRequestState("loading");
    try {
      await fetch("/api/compliance/request-deletion", { method: "POST" });
      setDeletionRequestState("done");
    } catch {
      setDeletionRequestState("idle");
    }
  };

  const handleOptOutToggle = async () => {
    const next = !analyticsOptOut;
    setAnalyticsOptOut(next);
    await fetch("/api/compliance/opt-out-analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optedOut: next }),
    }).catch(() => null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Shield className="h-5 w-5 text-indigo-400 shrink-0" />
          <div>
            <h1 className="text-base font-semibold">Privacy Center</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Manage your data — CCPA &amp; GDPR compliant</p>
          </div>
          <Link
            href="/dashboard"
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {/* Data collected */}
        <section>
          <h2 className="text-sm font-semibold text-white mb-4">Data Spear Collects</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
            {DATA_COLLECTED.map(({ icon: Icon, label, description }) => (
              <div key={label} className="flex items-start gap-3 px-5 py-4">
                <Icon className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Download my data */}
        <section>
          <h2 className="text-sm font-semibold text-white mb-2">Download My Data</h2>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Export a JSON file of all data Spear holds about your account — transcripts, scores, profile, and session records.
          </p>
          {downloadState === "done" ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Export downloaded.
            </div>
          ) : (
            <button
              onClick={handleDownload}
              disabled={downloadState === "loading"}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {downloadState === "loading" ? "Preparing export…" : "Download My Data"}
            </button>
          )}
        </section>

        {/* Analytics opt-out */}
        <section>
          <h2 className="text-sm font-semibold text-white mb-2">Analytics &amp; Data Sharing</h2>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Opt out of having your data included in aggregate reporting or product analytics.
            Your coaching reports will not be affected.
          </p>
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-zinc-200">Opt out of analytics</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {analyticsOptOut ? "Your data is excluded from aggregate analytics." : "Your data is included in aggregate analytics."}
              </p>
            </div>
            <button onClick={handleOptOutToggle} className="text-zinc-400 hover:text-zinc-200 transition-colors ml-4">
              {analyticsOptOut
                ? <ToggleRight className="h-6 w-6 text-indigo-400" />
                : <ToggleLeft className="h-6 w-6" />}
            </button>
          </div>
        </section>

        {/* GDPR data deletion request */}
        <section>
          <h2 className="text-sm font-semibold text-white mb-2">Right to Deletion (GDPR)</h2>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Request full deletion of your personal data. Under GDPR Article 17, all data will be purged within 72 hours of your request.
          </p>
          {deletionRequestState === "done" ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Deletion request received. Data will be purged within 72 hours.
            </div>
          ) : (
            <button
              onClick={handleDeleteRequest}
              disabled={deletionRequestState === "loading"}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {deletionRequestState === "loading" ? "Submitting…" : "Request Data Deletion (GDPR)"}
            </button>
          )}
        </section>

        {/* Delete account (CCPA hard delete) */}
        <section>
          <h2 className="text-sm font-semibold text-white mb-2">Delete My Account &amp; Data</h2>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Permanently delete your account and all associated data. This initiates a soft delete
            immediately, with hard deletion completed within 45 days. This action cannot be undone.
          </p>

          {deleteState === "done" ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Account scheduled for deletion. You will receive a confirmation email.
            </div>
          ) : deleteState === "confirm" ? (
            <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-4 space-y-3">
              <p className="text-sm text-red-300 font-medium">Are you sure?</p>
              <p className="text-xs text-red-400/80 leading-relaxed">
                This will delete all call recordings, transcripts, reports, and your account. Hard deletion
                completes within 45 days per CCPA.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteState("idle")}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeleteState("loading");
                    await fetch("/api/compliance/delete-account", { method: "POST" }).catch(() => null);
                    setDeleteState("done");
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
                >
                  Yes, delete my account
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDeleteState("confirm")}
              disabled={deleteState === "loading"}
              className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/20 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/40 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete My Account &amp; Data
            </button>
          )}
        </section>

        {/* Footer disclosure */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            Spear uses AI to analyze call recordings. All AI-generated content is for internal coaching
            purposes only and does not constitute legal, financial, or insurance advice. For privacy
            inquiries contact <span className="text-zinc-400">privacy@spear.ai</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
