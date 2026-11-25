"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calcEMA, calcMACD, calcRSI } from "@/lib/quant/indicators";
import { aggregateWeeklyBars } from "@/lib/quant/supportResistance";
import type { OhlcvBar, SupportResistanceMap } from "@/lib/types";

interface Props {
  symbol: string;
  bars: OhlcvBar[];
  entry?: number;
  stop?: number;
  target?: number;
  srDaily?: SupportResistanceMap;
  srWeekly?: SupportResistanceMap;
  srTimeframe?: "day" | "week";
  onChangeSrTimeframe?: (tf: "day" | "week") => void;
  theme: "dark" | "light";
  expanded?: boolean;
}

type RangeOpt = "1M" | "3M" | "6M" | "1Y" | "2Y";

export function LightweightCandlestickChart({
  symbol,
  bars,
  entry,
  stop,
  target,
  srDaily,
  srWeekly,
  srTimeframe = "day",
  onChangeSrTimeframe,
  theme,
  expanded = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<RangeOpt>("6M");
  const [showSrLines, setShowSrLines] = useState(true);
  const [showPoc, setShowPoc] = useState(true);
  const [showFib, setShowFib] = useState(false);
  const [showPlanLines, setShowPlanLines] = useState(true);
  const [showOscillators, setShowOscillators] = useState(false);

  const activeSr = srTimeframe === "week" ? srWeekly : srDaily;

  const slicedData = useMemo(() => {
    const baseBars = srTimeframe === "week" ? aggregateWeeklyBars(bars) : bars;
    const closes = baseBars.map((b) => b.close);
    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);
    const ema200 = calcEMA(closes, Math.min(200, Math.max(20, baseBars.length - 1)));
    const rsi14 = calcRSI(closes, 14);
    const macdObj = calcMACD(closes, 12, 26, 9);

    let lookback = baseBars.length;
    if (srTimeframe === "day") {
      lookback =
        range === "1M"
          ? 22
          : range === "3M"
            ? 65
            : range === "6M"
              ? 130
              : range === "1Y"
                ? 255
                : baseBars.length;
    } else {
      lookback =
        range === "1M"
          ? 12
          : range === "3M"
            ? 24
            : range === "6M"
              ? 40
              : range === "1Y"
                ? 60
                : baseBars.length;
    }
    const startIdx = Math.max(0, baseBars.length - lookback);

    return {
      bars: baseBars.slice(startIdx),
      ema20: ema20.slice(startIdx),
      ema50: ema50.slice(startIdx),
      ema200: ema200.slice(startIdx),
      rsi14: rsi14.slice(startIdx),
      macd: macdObj.macd.slice(startIdx),
      macdSignal: macdObj.signal.slice(startIdx),
      macdHist: macdObj.histogram.slice(startIdx),
    };
  }, [bars, range, srTimeframe]);

  const oscData = useMemo(() => {
    return slicedData.bars.map((b, i) => ({
      date: b.time.slice(5),
      rsi: slicedData.rsi14[i] !== null ? Number(slicedData.rsi14[i]!.toFixed(1)) : null,
      macd: slicedData.macd[i] !== null ? Number(slicedData.macd[i]!.toFixed(3)) : null,
      signal:
        slicedData.macdSignal[i] !== null ? Number(slicedData.macdSignal[i]!.toFixed(3)) : null,
      hist: slicedData.macdHist[i] !== null ? Number(slicedData.macdHist[i]!.toFixed(3)) : null,
    }));
  }, [slicedData]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || slicedData.bars.length === 0) return;

    const isDark = theme === "dark";
    const chart = createChart(el, {
      width: el.clientWidth,
      height: expanded ? 500 : 380,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#0b1120" : "#ffffff" },
        textColor: isDark ? "#94a3b8" : "#475569",
        fontFamily: "var(--font-ibm-thai), Inter, sans-serif",
      },
      grid: {
        vertLines: { color: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(226, 232, 240, 0.8)" },
        horzLines: { color: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(226, 232, 240, 0.8)" },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: isDark ? "#1e293b" : "#e2e8f0" },
      timeScale: { borderColor: isDark ? "#1e293b" : "#e2e8f0", timeVisible: false },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    candleSeries.setData(
      slicedData.bars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    volSeries.setData(
      slicedData.bars.map((b) => ({
        time: b.time as Time,
        value: b.volume,
        color: b.close >= b.open ? "rgba(16, 185, 129, 0.32)" : "rgba(244, 63, 94, 0.32)",
      }))
    );

    const addEma = (arr: (number | null)[], color: string, title: string) => {
      const pts = slicedData.bars
        .map((b, i) =>
          arr[i] !== null ? { time: b.time as Time, value: Number(arr[i]!.toFixed(2)) } : null
        )
        .filter((x): x is { time: Time; value: number } => x !== null);
      if (pts.length < 2) return;
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title,
      });
      line.setData(pts);
    };

    addEma(slicedData.ema20, "#38bdf8", "EMA20");
    addEma(slicedData.ema50, "#f59e0b", "EMA50");
    if (srTimeframe === "day") {
      addEma(slicedData.ema200, "#a855f7", "EMA200");
    }

    // Smart Confluence S1-S3 & R1-R3 lines
    if (showSrLines && activeSr) {
      activeSr.supports.forEach((lvl, idx) => {
        candleSeries.createPriceLine({
          price: lvl.price,
          color: idx === 0 ? "#10b981" : idx === 1 ? "rgba(16, 185, 129, 0.72)" : "rgba(16, 185, 129, 0.45)",
          lineWidth: idx === 0 ? 2 : 1,
          lineStyle: idx === 0 ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${lvl.label} (${"★".repeat(Math.min(3, lvl.strength))})`,
        });
      });
      activeSr.resistances.forEach((lvl, idx) => {
        candleSeries.createPriceLine({
          price: lvl.price,
          color: idx === 0 ? "#f43f5e" : idx === 1 ? "rgba(249, 115, 22, 0.8)" : "rgba(244, 63, 94, 0.45)",
          lineWidth: idx === 0 ? 2 : 1,
          lineStyle: idx === 0 ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${lvl.label} (${"★".repeat(Math.min(3, lvl.strength))})`,
        });
      });
    }

    // Volume Profile POC line
    if (showPoc && activeSr && activeSr.pocPrice > 0) {
      candleSeries.createPriceLine({
        price: activeSr.pocPrice,
        color: "#eab308",
        lineWidth: 2,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: "POC",
      });
    }

    // Key Fibonacci lines (38.2%, 50.0%, 61.8%)
    if (showFib && activeSr) {
      activeSr.fibLevels
        .filter((f) => f.ratio === 0.382 || f.ratio === 0.5 || f.ratio === 0.618)
        .forEach((f) => {
          candleSeries.createPriceLine({
            price: f.price,
            color: "#818cf8",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: f.label,
          });
        });
    }

    // Trade Plan Lines (Entry / Stop / Target)
    if (showPlanLines) {
      if (entry && entry > 0) {
        candleSeries.createPriceLine({
          price: entry,
          color: "#38bdf8",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "ENTRY",
        });
      }
      if (stop && stop > 0) {
        candleSeries.createPriceLine({
          price: stop,
          color: "#fb7185",
          lineWidth: 2,
          lineStyle: LineStyle.SparseDotted,
          axisLabelVisible: true,
          title: "STOP",
        });
      }
      if (target && target > 0) {
        candleSeries.createPriceLine({
          price: target,
          color: "#34d399",
          lineWidth: 2,
          lineStyle: LineStyle.SparseDotted,
          axisLabelVisible: true,
          title: "TARGET",
        });
      }
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.contentRect.width > 0) {
          chart.applyOptions({ width: e.contentRect.width });
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [
    slicedData,
    showSrLines,
    showPoc,
    showFib,
    showPlanLines,
    activeSr,
    entry,
    stop,
    target,
    theme,
    expanded,
    srTimeframe,
  ]);

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {onChangeSrTimeframe && (
            <div className="inline-flex rounded-lg bg-slate-200/75 dark:bg-slate-800 p-0.5 mr-1">
              <button
                type="button"
                onClick={() => onChangeSrTimeframe("day")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                  srTimeframe === "day"
                    ? "bg-sky-500 text-slate-950"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeSrTimeframe("week");
                  setRange("2Y");
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                  srTimeframe === "week"
                    ? "bg-sky-500 text-slate-950"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Week
              </button>
            </div>
          )}

          {(["1M", "3M", "6M", "1Y", "2Y"] as RangeOpt[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                range === r
                  ? "bg-sky-500 text-slate-950"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-emerald-600 dark:text-emerald-400 font-semibold">
            <input
              type="checkbox"
              checked={showSrLines}
              onChange={(e) => setShowSrLines(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span>แนวรับ-ต้าน (S1-S3/R1-R3)</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-amber-600 dark:text-amber-400 font-semibold">
            <input
              type="checkbox"
              checked={showPoc}
              onChange={(e) => setShowPoc(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>POC</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-indigo-500 font-semibold">
            <input
              type="checkbox"
              checked={showFib}
              onChange={(e) => setShowFib(e.target.checked)}
              className="accent-indigo-500 rounded"
            />
            <span>Fib</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showPlanLines}
              onChange={(e) => setShowPlanLines(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            <span>เส้นแผน</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showOscillators}
              onChange={(e) => setShowOscillators(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            <span>RSI / MACD</span>
          </label>
        </div>
      </div>

      {/* Main TradingView Candlestick Chart */}
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120]">
        <div className="px-3 py-1.5 border-b border-slate-200/70 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {symbol} · กราฟแท่งเทียน {srTimeframe === "week" ? "Weekly" : "Daily"} ({range})
          </span>
          <div className="flex items-center gap-2.5 text-[10px]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-400" /> EMA20
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> EMA50
            </span>
            {srTimeframe === "day" && (
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-purple-400" /> EMA200
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-400" /> POC
            </span>
          </div>
        </div>
        <div ref={containerRef} className="w-full" />
      </div>

      {/* Optional RSI & MACD Panes */}
      {showOscillators && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
              RSI (14) · โซน Overbought (70) / Oversold (30)
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={oscData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
                      borderColor: theme === "dark" ? "#334155" : "#cbd5e1",
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" />
                  <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="rsi" name="RSI(14)" stroke="#38bdf8" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
              MACD (12, 26, 9)
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={oscData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 10 }} width={38} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
                      borderColor: theme === "dark" ? "#334155" : "#cbd5e1",
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine y={0} stroke="#64748b" />
                  <Bar dataKey="hist" name="Histogram" fill="#38bdf8" opacity={0.45} />
                  <Line type="monotone" dataKey="macd" name="MACD" stroke="#10b981" dot={false} strokeWidth={1.8} />
                  <Line type="monotone" dataKey="signal" name="Signal" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
