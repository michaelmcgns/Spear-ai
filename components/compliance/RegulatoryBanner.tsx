import React from "react";
import { ShieldCheck } from "lucide-react";

export function RegulatoryBanner() {
  return (
    <div className="flex items-start gap-3 rounded-none border-b border-amber-900/40 bg-amber-950/20 px-4 py-2.5 text-[11px] text-amber-300/80 leading-relaxed">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400/60" />
      <span>
        <strong className="font-semibold text-amber-300">Spear provides coaching on sales process only.</strong>
        {" "}All product recommendations are the agent&apos;s independent professional judgment.
        {" "}Prospects are informed of recording per applicable state law.
        {" "}Spear uses AI to analyze call recordings.
      </span>
    </div>
  );
}
