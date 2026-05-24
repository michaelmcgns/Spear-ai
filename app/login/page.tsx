import Link from "next/link";
import { login } from "@/app/auth/actions";
import { Sword, BarChart3, Brain, MessageSquare, Mic } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-12 overflow-hidden border-r border-zinc-800">
        {/* Ambient glow */}
        <div className="absolute -top-32 -left-32 h-96 w-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 h-64 w-64 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2.5 mb-16">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30">
              <Sword className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-base font-bold text-white">Spear</p>
              <p className="text-[10px] text-zinc-500 leading-tight">
                AI Sales Co-Pilot
              </p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            The last call coaching
            <br />
            tool your team will need.
          </h2>
          <p className="text-sm text-zinc-400 mb-10 leading-relaxed max-w-sm">
            NEPQ scoring. DISC profiling. Objection detection. Talk ratio
            analysis. After every call, automatically.
          </p>

          <div className="space-y-4">
            {[
              {
                icon: BarChart3,
                text: "NEPQ Phase Scoring across 7 phases",
                color: "text-indigo-400",
              },
              {
                icon: Brain,
                text: "DISC Buyer Profiling from language and tone",
                color: "text-purple-400",
              },
              {
                icon: MessageSquare,
                text: "Objection detection with ideal NEPQ responses",
                color: "text-red-400",
              },
              {
                icon: Mic,
                text: "Talk Ratio Analysis — stop pitching, start closing",
                color: "text-amber-400",
              },
            ].map(({ icon: Icon, text, color }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800 border border-zinc-700 shrink-0">
                  <Icon className={`h-3 w-3 ${color}`} />
                </div>
                <p className="text-sm text-zinc-300">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
          <p className="text-sm text-zinc-200 leading-relaxed italic mb-3">
            &ldquo;Spear took our team from a 28% close rate to 41% in 60 days.
            Every agent gets coached after every call now — not just the ones
            the manager has time to review.&rdquo;
          </p>
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-indigo-500/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
              M
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-200">
                Marcus T.
              </p>
              <p className="text-[10px] text-zinc-500">
                Agency Owner, Enhance Companies
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <Sword className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-bold text-white">Spear</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-1.5 text-sm text-zinc-400">
              Sign in to your account
            </p>
          </div>

          {process.env.NEXT_PUBLIC_BYPASS_AUTH === "true" && (
            <div className="mb-6 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <p className="text-xs text-amber-300">
                <span className="font-semibold">Demo mode active.</span>{" "}
                <Link
                  href="/dashboard"
                  className="underline hover:text-amber-200"
                >
                  Go directly to dashboard →
                </Link>
              </p>
            </div>
          )}

          <form action={login} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-300"
                >
                  Password
                </label>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {params.error && (
              <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3.5 py-2.5 text-sm text-red-300">
                {params.error}
              </div>
            )}
            {params.message && (
              <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3.5 py-2.5 text-sm text-emerald-300">
                {params.message}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-zinc-950 mt-2"
            >
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
