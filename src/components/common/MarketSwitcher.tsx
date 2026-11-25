"use client";

import { MARKET_CONFIGS } from "@/lib/markets";
import type { MarketId } from "@/lib/types";

const ORDER: MarketId[] = ["SP500", "NASDAQ100", "HK", "CHINA", "DR"];

export function MarketSwitcher({
  value,
  onChange,
  compact = false,
}: {
  value: MarketId;
  onChange: (market: MarketId) => void;
  compact?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-200/75 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-800 p-1">
      {ORDER.map((id) => {
        const cfg = MARKET_CONFIGS[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
              active
                ? "bg-gradient-to-r from-sky-500 to-emerald-500 text-slate-950 shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800"
            }`}
          >
            <span>{cfg.flag}</span>
            <span>{compact ? cfg.shortLabel : cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
