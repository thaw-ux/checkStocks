"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DimensionScore, IaaConsensusSummary, WeeklyBacktestPoint } from "@/lib/types";

export function IaaStackedBarChart({
  items,
  theme,
  onSelectSymbol,
}: {
  items: IaaConsensusSummary[];
  theme: "dark" | "light";
  onSelectSymbol?: (sym: string) => void;
}) {
  const top20 = items.slice(0, 20).map((i) => ({
    symbol: i.symbol,
    ซื้อ: i.buyCount,
    ถือ: i.holdCount,
    ขาย: i.sellCount,
  }));

  if (top20.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-3">
        เปรียบเทียบมติโบรกเกอร์ (TOP 20 ตามตัวกรองปัจจุบัน)
      </div>
      <div className="h-[460px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={top20}
            layout="vertical"
            margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
            onClick={(state) => {
              if (state?.activeLabel && onSelectSymbol) {
                onSelectSymbol(String(state.activeLabel));
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="symbol" width={68} tick={{ fontSize: 11, fontWeight: 600 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
                borderColor: theme === "dark" ? "#334155" : "#cbd5e1",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ซื้อ" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="ถือ" stackId="a" fill="#f59e0b" />
            <Bar dataKey="ขาย" stackId="a" fill="#f43f5e" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function Backtest12WChart({
  points,
  theme,
}: {
  points: WeeklyBacktestPoint[];
  theme: "dark" | "light";
}) {
  if (points.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
          <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={48} />
          <Tooltip
            formatter={(val) => [`${Number(val).toFixed(2)}%`]}
            contentStyle={{
              backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
              borderColor: theme === "dark" ? "#334155" : "#cbd5e1",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="cumulativePortfolioPct"
            name="พอร์ตจำลอง 360° สะสม (%)"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="cumulativeSetPct"
            name="SET Index สะสม (%)"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SandboxCurveChart({
  curve,
  theme,
}: {
  curve: { date: string; portfolioPct: number; setPct: number }[];
  theme: "dark" | "light";
}) {
  if (curve.length === 0) return null;
  const formatted = curve.map((c) => ({ ...c, shortDate: c.date.slice(5) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
          <XAxis dataKey="shortDate" tick={{ fontSize: 10 }} minTickGap={14} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={48} />
          <Tooltip
            formatter={(val) => [`${Number(val).toFixed(2)}%`]}
            contentStyle={{
              backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
              borderColor: theme === "dark" ? "#334155" : "#cbd5e1",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="portfolioPct"
            name="พอร์ต Sandbox (%)"
            stroke="#38bdf8"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="setPct"
            name="SET Index (%)"
            stroke="#f59e0b"
            strokeWidth={1.8}
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DimensionScoreBars({ scores }: { scores: DimensionScore }) {
  const rows = [
    { label: "IAA/พื้นฐาน", val: scores.fundamentalIaa, color: "bg-sky-500" },
    { label: "เทรนด์เทคนิค", val: scores.technicalTrend, color: "bg-emerald-500" },
    { label: "โมเมนตัม/วอลุ่ม", val: scores.momentumVolume, color: "bg-indigo-500" },
    { label: "Time Machine", val: scores.timeMachineEdge, color: "bg-amber-500" },
    { label: "คุมความเสี่ยง", val: scores.riskStability, color: "bg-teal-500" },
  ];

  return (
    <div className="grid grid-cols-5 gap-1.5 mt-2">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span className="truncate">{r.label}</span>
            <span className="font-semibold tabular-nums">{r.val}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${r.color}`}
              style={{ width: `${Math.min(100, (r.val / 20) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
