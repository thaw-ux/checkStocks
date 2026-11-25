"use client";

import { Crosshair, Layers, Shield, Star, Target } from "lucide-react";
import { formatPrice } from "@/lib/markets";
import type { CurrencyCode, SupportResistanceLevel, SupportResistanceMap } from "@/lib/types";

interface Props {
  symbol: string;
  currency: CurrencyCode;
  srDaily: SupportResistanceMap;
  srWeekly: SupportResistanceMap;
  timeframe: "day" | "week";
  onTimeframeChange: (tf: "day" | "week") => void;
  onApplyLevel: (role: "entry" | "stop" | "target", price: number, label: string) => void;
}

function StrengthStars({ strength }: { strength: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400" title={`ความแข็งแกร่ง ${strength}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < strength ? "fill-amber-400 text-amber-400" : "text-slate-600/40"}`}
        />
      ))}
    </span>
  );
}

export function SupportResistancePanel({
  symbol,
  currency,
  srDaily,
  srWeekly,
  timeframe,
  onTimeframeChange,
  onApplyLevel,
}: Props) {
  const sr = timeframe === "week" ? srWeekly : srDaily;
  const s1 = sr.supports[0];
  const s2 = sr.supports[1];
  const r1 = sr.resistances[0];
  const r2 = sr.resistances[1];

  const orderedResistances = [...sr.resistances].reverse(); // R3 -> R2 -> R1 top-down

  const renderRow = (lvl: SupportResistanceLevel) => {
    const isSup = lvl.kind === "support";
    return (
      <tr
        key={lvl.label}
        className={`hover:bg-sky-500/5 transition ${
          isSup
            ? "border-l-2 border-l-emerald-500"
            : "border-l-2 border-l-rose-500"
        }`}
      >
        <td className="py-2.5 pl-3 pr-2 font-extrabold whitespace-nowrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${
              isSup
                ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                : "bg-rose-500/15 text-rose-500 border border-rose-500/30"
            }`}
          >
            {lvl.label}
          </span>
        </td>
        <td className="py-2.5 px-2 tabular-nums whitespace-nowrap">
          <div className="font-extrabold text-slate-900 dark:text-white">
            {formatPrice(lvl.price, currency)}
          </div>
          <div className="text-[10px] text-slate-500">
            โซน {lvl.zoneLow.toFixed(2)} – {lvl.zoneHigh.toFixed(2)}
          </div>
        </td>
        <td
          className={`py-2.5 px-2 text-right font-bold tabular-nums whitespace-nowrap ${
            isSup ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          {isSup ? `-${lvl.distancePct.toFixed(2)}%` : `+${lvl.distancePct.toFixed(2)}%`}
        </td>
        <td className="py-2.5 px-2 whitespace-nowrap">
          <StrengthStars strength={lvl.strength} />
        </td>
        <td className="py-2.5 px-2 text-center tabular-nums text-slate-500">
          {lvl.touches > 0 ? `${lvl.touches} ครั้ง` : "-"}
        </td>
        <td className="py-2.5 px-2">
          <div className="flex flex-wrap gap-1">
            {lvl.sources.map((src) => (
              <span
                key={src}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  src === "Volume POC"
                    ? "bg-amber-500/20 text-amber-500"
                    : src === "Role Flip"
                      ? "bg-purple-500/20 text-purple-400"
                      : src.startsWith("Fib")
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {src}
              </span>
            ))}
          </div>
        </td>
        <td className="py-2.5 pl-2 pr-3 text-right whitespace-nowrap">
          <div className="inline-flex items-center gap-1">
            {isSup ? (
              <>
                <button
                  type="button"
                  onClick={() => onApplyLevel("entry", lvl.price, lvl.label)}
                  className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500 hover:text-slate-950 text-sky-500 text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                  title="ตั้งเป็นจุดเข้าซื้อ (Entry) ใน Time Machine"
                >
                  <Crosshair className="h-3 w-3" /> Entry
                </button>
                <button
                  type="button"
                  onClick={() => onApplyLevel("stop", lvl.price, lvl.label)}
                  className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-500 text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                  title="ตั้งเป็นจุดตัดขาดทุน (Stop Loss) ใน Time Machine"
                >
                  <Shield className="h-3 w-3" /> Stop
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onApplyLevel("target", lvl.price, lvl.label)}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 hover:text-slate-950 text-emerald-500 text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                title="ตั้งเป็นเป้าหมายทำกำไร (Target) ใน Time Machine"
              >
                <Target className="h-3 w-3" /> ตั้งเป็น Target
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
      {/* Header + Day/Week switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-500" />
            Smart Confluence แนวรับ-แนวต้าน ({symbol}) · Swing Pivot + Volume POC + Fibonacci + EMA
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {sr.zoneLabelTh} · Volume POC (โซนวอลุ่มหนาแน่นสุด):{" "}
            <strong className="text-amber-500 tabular-nums">
              {formatPrice(sr.pocPrice, currency)}
            </strong>
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200/75 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onTimeframeChange("day")}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              timeframe === "day"
                ? "bg-sky-500 text-slate-950"
                : "text-slate-600 dark:text-slate-300 hover:text-white"
            }`}
          >
            Day (ระยะสั้น 1–6M)
          </button>
          <button
            type="button"
            onClick={() => onTimeframeChange("week")}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              timeframe === "week"
                ? "bg-sky-500 text-slate-950"
                : "text-slate-600 dark:text-slate-300 hover:text-white"
            }`}
          >
            Week (กลาง-ยาว 2Y)
          </button>
        </div>
      </div>

      {/* Price Zone Meter */}
      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between text-xs gap-2 tabular-nums">
          <div className="flex items-center gap-2">
            {s2 && (
              <span className="text-emerald-600/70 dark:text-emerald-400/70">
                S2 {s2.price.toFixed(2)}
              </span>
            )}
            {s1 && (
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                S1 {s1.price.toFixed(2)} (-{s1.distancePct.toFixed(1)}%)
              </span>
            )}
          </div>
          <div className="font-extrabold text-sky-500">
            ราคาปัจจุบัน {formatPrice(sr.price, currency)}
          </div>
          <div className="flex items-center gap-2">
            {r1 && (
              <span className="font-bold text-rose-500">
                R1 {r1.price.toFixed(2)} (+{r1.distancePct.toFixed(1)}%)
              </span>
            )}
            {r2 && (
              <span className="text-rose-500/70">R2 {r2.price.toFixed(2)}</span>
            )}
          </div>
        </div>

        <div className="relative h-3 rounded-full bg-gradient-to-r from-emerald-500/40 via-sky-500/25 to-rose-500/40 border border-slate-300/60 dark:border-slate-700">
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-sky-400 border-2 border-slate-950 shadow-lg shadow-sky-500/40 transition-all"
            style={{ left: `${Math.max(4, Math.min(96, sr.zonePositionPct))}%` }}
            title={`ตำแหน่งในกรอบ S1–R1: ${sr.zonePositionPct}%`}
          />
        </div>

        {/* Fibonacci strip */}
        {sr.fibLevels.length > 0 && (
          <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
            <span className="text-slate-500 font-semibold">
              Fibonacci ({sr.fibSwingLow.toFixed(2)} → {sr.fibSwingHigh.toFixed(2)}):
            </span>
            {sr.fibLevels.map((f) => (
              <span
                key={f.label}
                className={`px-2 py-0.5 rounded-md border ${
                  f.ratio === 0.382 || f.ratio === 0.5 || f.ratio === 0.618
                    ? "bg-indigo-500/15 border-indigo-500/35 text-indigo-600 dark:text-indigo-300 font-bold"
                    : "bg-slate-200/60 dark:bg-slate-800/70 border-slate-300/60 dark:border-slate-700 text-slate-500"
                }`}
              >
                {f.label}: {f.price.toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 6-Level Confluence Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <th className="py-2 pl-3 pr-2">ระดับ</th>
              <th className="py-2 px-2">ราคา / โซน</th>
              <th className="py-2 px-2 text-right">ห่างปัจจุบัน</th>
              <th className="py-2 px-2">ความแข็งแกร่ง</th>
              <th className="py-2 px-2 text-center">ทดสอบ</th>
              <th className="py-2 px-2">แหล่งสัญญาณ Confluence</th>
              <th className="py-2 pl-2 pr-3 text-right">ส่งเข้า Time Machine</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {orderedResistances.map(renderRow)}
            {/* Current price divider row */}
            <tr className="bg-sky-500/10 font-bold text-sky-600 dark:text-sky-300">
              <td className="py-2 pl-3 pr-2">NOW</td>
              <td className="py-2 px-2 tabular-nums" colSpan={2}>
                ราคาปัจจุบัน: {formatPrice(sr.price, currency)}
              </td>
              <td className="py-2 px-2 tabular-nums text-amber-500" colSpan={4}>
                Volume POC: {formatPrice(sr.pocPrice, currency)} · ตำแหน่งกรอบ S1–R1:{" "}
                {sr.zonePositionPct}%
              </td>
            </tr>
            {sr.supports.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
