import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { Sword, BarChart3, Brain, MessageSquare, Mic } from "lucide-react";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-12 overflow-hidden border-r border-zinc-800">
        <div className="absolute -top-32 -left-32 h-96 w-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

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
            Start coaching your team
            <br />
            after every single call.
          </h2>
          <p className="text-sm text-zinc-400 mb-10 leading-relaxed max-w-sm">
            Spear replaces ad-hoc call reviews with a systematic,
            AI-powered coaching report — delivered automatically, tied to
            exact moments in the transcript.
          </p>

          <div className="space-y-4">
            {[
              {
                icon: BarChart3,
                text: "NEPQ Phase Scoring — 7 phases, every call",
                color: "text-indigo-400",
              },
              {
                icon: Brain,
                text: "DISC Buyer Profiling — know your buyer type",
                color: "text-purple-400",
              },
              {
                icon: MessageSquare,
                text: "Objection Detection — catch what you missed",
                color: "text-red-400",
              },
              {
                icon: Mic,
                text: "Talk Ratio — are you talking too much?",
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
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-500">Avg Close Rate</span>
            <span className="text-xs text-emerald-400 font-semibold">
              +47% after 60 days
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
              style={{ width: "47%" }}
            />
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <Sword className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-bold text-white">Spear</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Create your account</h1>
            <p className="mt-1.5 text-sm text-zinc-400">
              Start coaching your team after every call.
            </p>
          </div>

          <form action={signup} className="space-y-4">
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
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {params.error && (
              <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3.5 py-2.5 text-sm text-red-300">
                {params.error}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-zinc-950 mt-2"
            >
              Create account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
