"use client";

import { useRef, useState } from "react";
import { logout } from "@/app/auth/actions";

interface AnalysisResult {
  buyerPsychologyProfile: string;
  topObjections: string[];
  coachingRecommendations: string[];
  nepqScore: number;
}

export default function DashboardPage() {
  const stats = [
    { label: "Total Calls", value: "1,284", change: "+12.4%" },
    { label: "Avg Close Rate", value: "34.8%", change: "+2.1%" },
    { label: "Objections Caught", value: "416", change: "+18.9%" },
    { label: "Revenue Influenced", value: "$238,400", change: "+9.7%" },
  ];

  const navItems = [
    "Dashboard",
    "Calls",
    "Analytics",
    "Coaching",
    "Agents",
    "Settings",
  ];

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setResult(null);
    setError(null);
    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const response = await fetch("/api/analyze-call", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Analysis failed");
      }

      const data = (await response.json()) as AnalysisResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="hidden w-64 border-r border-zinc-800 bg-zinc-900/70 p-6 lg:block">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Navigation
            </p>
          </div>
          <nav className="space-y-2">
            {navItems.map((item, index) => (
              <button
                key={item}
                type="button"
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  index === 0
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex flex-1 flex-col p-6 md:p-10">
          <header className="mb-8 flex flex-col gap-2 border-b border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Spear
              </h1>
              <p className="mt-1 text-sm text-zinc-400 md:text-base">
                AI-Powered Closing Intelligence
              </p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Placeholder Data
              </p>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                >
                  Sign out
                </button>
              </form>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm"
              >
                <p className="text-sm text-zinc-400">{stat.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm text-emerald-400">{stat.change}</p>
              </article>
            ))}
          </section>

          <section className="flex flex-1 flex-col items-center justify-center py-12">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.mp4,.m4a,.wav"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isAnalyzing}
              className="rounded-xl border border-indigo-400/30 bg-indigo-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Upload Call Recording
            </button>

            {selectedFileName ? (
              <p className="mt-4 text-sm text-zinc-400">
                Selected: {selectedFileName}
              </p>
            ) : null}

            {isAnalyzing ? (
              <div className="mt-6 flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-indigo-400" />
                <span>
                  Transcribing and analyzing call — this may take a minute…
                </span>
              </div>
            ) : null}

            {error ? (
              <div className="mt-6 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {result ? (
              <div className="mt-8 w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    Call Analysis
                  </h2>
                  <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-sm font-medium text-indigo-300">
                    NEPQ Score: {result.nepqScore}/10
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <h3 className="text-sm font-semibold text-indigo-300">
                      Buyer Psychology Profile
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">
                      {result.buyerPsychologyProfile}
                    </p>
                  </article>

                  <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <h3 className="text-sm font-semibold text-indigo-300">
                      Top Objections Detected
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                      {result.topObjections.map((objection) => (
                        <li key={objection}>— {objection}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <h3 className="text-sm font-semibold text-indigo-300">
                      Coaching Recommendations
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                      {result.coachingRecommendations.map((rec) => (
                        <li key={rec}>— {rec}</li>
                      ))}
                    </ul>
                  </article>
                </div>
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}
