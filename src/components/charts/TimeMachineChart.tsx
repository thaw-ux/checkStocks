"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeMachineResult } from "@/lib/types";

export function TimeMachineChart({
  result,
  theme,
}: {
  result: TimeMachineResult;
  theme: "dark" | "light";
}) {
  const { chartData, sampleKeys, yMin, yMax } = useMemo(() => {
    const sampleSubset = result.samplePaths.slice(0, 24);
    const keys = sampleSubset.map((p, i) => ({
      key: `p${i}`,
      outcome: p.outcome,
    }));

    let lo = Math.min(result.stop, result.entry);
    let hi = Math.max(result.target, result.entry);

    const rows = result.percentileBands.map((band, stepIdx) => {
      lo = Math.min(lo, band.p10);
      hi = Math.max(hi, band.p90);
      const row: Record<string, string | number> = {
        label: band.label,
        p10: band.p10,
        p50: band.p50,
        p90: band.p90,
      };
      sampleSubset.forEach((p, idx) => {
        const val = p.prices[stepIdx] ?? result.entry;
        row[`p${idx}`] = val;
        lo = Math.min(lo, val);
        hi = Math.max(hi, val);
      });
      return row;
    });

    const pad = Math.max(0.05, (hi - lo) * 0.08);
    return {
      chartData: rows,
      sampleKeys: keys,
      yMin: Number((lo - pad).toFixed(2)),
      yMax: Number((hi + pad).toFixed(2)),
    };
  }, [result]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
            เส้นทางราคาจำลอง {result.simulations.toLocaleString()} รอบ ({result.horizonLabel})
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            ประมวลผลด้วย Float64Array จากพฤติกรรมแท่งเทียนจริงในอดีต ({result.elapsedMs} ms)
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1 text-emerald-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> ถึงเป้าก่อน ({result.hitTargetPct}%)
          </span>
          <span className="inline-flex items-center gap-1 text-rose-500">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> ชน Stop ก่อน ({result.hitStopPct}%)
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-400" /> ไม่ถึงทั้งคู่ ({result.unresolvedPct}%)
          </span>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
            <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} width={52} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p90 = payload.find((x) => x.dataKey === "p90")?.value;
                const p50 = payload.find((x) => x.dataKey === "p50")?.value;
                const p10 = payload.find((x) => x.dataKey === "p10")?.value;
                return (
                  <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-xl">
                    <div className="font-bold text-sky-300 mb-1">ช่วง {label}</div>
                    <div>P90 (โซนบน): {String(p90)} บ.</div>
                    <div>P50 (ค่ากลาง): {String(p50)} บ.</div>
                    <div>P10 (โซนล่าง): {String(p10)} บ.</div>
                  </div>
                );
              }}
            />

            {/* Fan area P10-P90 */}
            <Area
              type="monotone"
              dataKey="p90"
              stroke="none"
              fill="#38bdf8"
              fillOpacity={0.08}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="p10"
              stroke="none"
              fill={theme === "dark" ? "#0b1120" : "#ffffff"}
              fillOpacity={1}
              isAnimationActive={false}
            />

            {/* Sample simulated trajectories */}
            {sampleKeys.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                dot={false}
                strokeWidth={1.15}
                strokeOpacity={0.45}
                stroke={
                  s.outcome === "target"
                    ? "#10b981"
                    : s.outcome === "stop"
                      ? "#f43f5e"
                      : "#94a3b8"
                }
                isAnimationActive={false}
              />
            ))}

            {/* Median P50 */}
            <Line
              type="monotone"
              dataKey="p50"
              dot={false}
              stroke="#38bdf8"
              strokeWidth={2.4}
              isAnimationActive={false}
            />

            {/* Target / Entry / Stop reference lines */}
            <ReferenceLine
              y={result.target}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="6 4"
              label={{
                value: `TARGET ${result.target.toFixed(2)}`,
                fill: "#10b981",
                fontSize: 11,
                position: "insideTopRight",
              }}
            />
            <ReferenceLine
              y={result.entry}
              stroke="#38bdf8"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              label={{
                value: `ENTRY ${result.entry.toFixed(2)}`,
                fill: "#38bdf8",
                fontSize: 11,
                position: "insideTopLeft",
              }}
            />
            <ReferenceLine
              y={result.stop}
              stroke="#f43f5e"
              strokeWidth={2}
              strokeDasharray="6 4"
              label={{
                value: `STOP ${result.stop.toFixed(2)}`,
                fill: "#f43f5e",
                fontSize: 11,
                position: "insideBottomRight",
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
