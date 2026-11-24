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
import type { OhlcvBar } from "@/lib/types";

interface Props {
  symbol: string;
  bars: OhlcvBar[];
  entry?: number;
  stop?: number;
  target?: number;
  theme: "dark" | "light";
  expanded?: boolean;
}

type RangeOpt = "1M" | "3M" | "6M" | "1Y";

export function LightweightCandlestickChart({
  symbol,
  bars,
  entry,
  stop,
  target,
  theme,
  expanded = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<RangeOpt>("6M");
  const [showPlanLines, setShowPlanLines] = useState(true);
  const [showOscillators, setShowOscillators] = useState(false);

  const slicedData = useMemo(() => {
    const closes = bars.map((b) => b.close);
    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);
    const ema200 = calcEMA(closes, 200);
    const rsi14 = calcRSI(closes, 14);
    const macdObj = calcMACD(closes, 12, 26, 9);

    const lookback =
      range === "1M" ? 22 : range === "3M" ? 65 : range === "6M" ? 130 : bars.length;
    const startIdx = Math.max(0, bars.length - lookback);

    return {
      bars: bars.slice(startIdx),
      ema20: ema20.slice(startIdx),
      ema50: ema50.slice(startIdx),
      ema200: ema200.slice(startIdx),
      rsi14: rsi14.slice(startIdx),
      macd: macdObj.macd.slice(startIdx),
      macdSignal: macdObj.signal.slice(startIdx),
      macdHist: macdObj.histogram.slice(startIdx),
    };
  }, [bars, range]);

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
      height: expanded ? 480 : 360,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#0b1120" : "#ffffff" },
        textColor: isDark ? "#94a3b8" : "#475569",
        fontFamily: "var(--font-ibm-thai), Inter, sans-serif",
      },
      grid: {
        vertLines: { color: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(226, 232, 240, 0.8)" },
        horzLines: { color: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(226, 232, 240, 0.8)" },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: isDark ? "#1e293b" : "#e2e8f0",
      },
      timeScale: {
        borderColor: isDark ? "#1e293b" : "#e2e8f0",
        timeVisible: false,
      },
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

    // Volume histogram at bottom 22%
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
        color: b.close >= b.open ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)",
      }))
    );

    // EMA 20 / 50 / 200
    const addEma = (arr: (number | null)[], color: string, title: string) => {
      const pts = slicedData.bars
        .map((b, i) => (arr[i] !== null ? { time: b.time as Time, value: Number(arr[i]!.toFixed(2)) } : null))
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
    addEma(slicedData.ema200, "#a855f7", "EMA200");

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
          color: "#f43f5e",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "STOP",
        });
      }
      if (target && target > 0) {
        candleSeries.createPriceLine({
          price: target,
          color: "#10b981",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
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
  }, [slicedData, showPlanLines, entry, stop, target, theme, expanded]);

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {(["1M", "3M", "6M", "1Y"] as RangeOpt[]).map((r) => (
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
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-400" /> EMA20
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> EMA50
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-400" /> EMA200
            </span>
          </div>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showPlanLines}
              onChange={(e) => setShowPlanLines(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            <span>เส้นแผน ENTRY / STOP / TARGET</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showOscillators}
              onChange={(e) => setShowOscillators(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            <span>แสดง RSI / MACD</span>
          </label>
        </div>
      </div>

      {/* Main TradingView Candlestick Chart */}
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120]">
        <div className="px-3 py-1.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {symbol}.BK · กราฟแท่งเทียน TradingView ({range})
          </span>
          <span>ลากเพื่อเลื่อน · ซูมด้วยล้อเมาส์</span>
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
