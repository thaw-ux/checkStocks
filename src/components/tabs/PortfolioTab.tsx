"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookmarkPlus,
  Briefcase,
  CheckCircle2,
  Download,
  FlaskConical,
  LineChart,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Backtest12WChart,
  DimensionScoreBars,
  SandboxCurveChart,
} from "@/components/charts/AnalyticsCharts";
import { SentimentBadge, SkeletonCard } from "@/components/common/UiPrimitives";
import type { WeeklyPortfolioPayload } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

type SubMode = "weekly" | "backtest" | "paper";

interface SandboxResult {
  initialCapital: number;
  finalValue: number;
  totalReturnPct: number;
  setReturnPct: number;
  alphaPct: number;
  maxDrawdownPct: number;
  curve: { date: string; portfolioPct: number; setPct: number; portfolioValue: number }[];
}

export function PortfolioTab() {
  const {
    jumpToStock,
    jumpToTimeMachine,
    paperTrades,
    addPaperTrade,
    closePaperTrade,
    deletePaperTrade,
    exportPaperTradesJson,
    importPaperTradesJson,
    theme,
    isCardView,
    showToast,
  } = useAppStore();

  const [subMode, setSubMode] = useState<SubMode>("weekly");
  const [baseCapital, setBaseCapital] = useState(100_000);
  const [weeklyData, setWeeklyData] = useState<WeeklyPortfolioPayload | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState("");

  // Sandbox backtest state
  const [sandboxRows, setSandboxRows] = useState([
    { symbol: "PTT", weightPct: 25 },
    { symbol: "CPALL", weightPct: 25 },
    { symbol: "BDMS", weightPct: 25 },
    { symbol: "ADVANC", weightPct: 25 },
  ]);
  const [sandboxDays, setSandboxDays] = useState(60);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);
  const [sandboxError, setSandboxError] = useState("");

  // Paper Trade state
  const [liveQuotes, setLiveQuotes] = useState<
    Record<string, { price: number | null; changePct: number | null }>
  >({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [ptSymbol, setPtSymbol] = useState("");
  const [ptEntry, setPtEntry] = useState("");
  const [ptShares, setPtShares] = useState("1000");
  const [ptStop, setPtStop] = useState("");
  const [ptTarget, setPtTarget] = useState("");
  const [ptStrategy, setPtStrategy] = useState("Swing SET50");
  const [ptNote, setPtNote] = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);

  const loadWeekly = useCallback(
    async (refresh = false) => {
      setWeeklyLoading(true);
      setWeeklyError("");
      try {
        const res = await fetch(
          `/api/portfolio/weekly?capital=${baseCapital}${refresh ? "&refresh=1" : ""}`
        );
        const json = (await res.json()) as WeeklyPortfolioPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "โหลดพอร์ตจำลองรายสัปดาห์ไม่สำเร็จ");
        setWeeklyData(json);
      } catch (err) {
        setWeeklyError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      } finally {
        setWeeklyLoading(false);
      }
    },
    [baseCapital]
  );

  useEffect(() => {
    void loadWeekly(false);
  }, [loadWeekly]);

  // Fetch live quotes for open paper trades
  const refreshPaperQuotes = useCallback(async () => {
    const syms = Array.from(new Set(paperTrades.map((t) => t.symbol)));
    if (syms.length === 0) return;
    setQuotesLoading(true);
    try {
      const res = await fetch(`/api/portfolio/quotes?symbols=${encodeURIComponent(syms.join(","))}`);
      const json = (await res.json()) as {
        quotes?: Record<string, { price: number | null; changePct: number | null }>;
      };
      if (json.quotes) setLiveQuotes(json.quotes);
    } finally {
      setQuotesLoading(false);
    }
  }, [paperTrades]);

  useEffect(() => {
    if (subMode === "paper" && paperTrades.length > 0) {
      void refreshPaperQuotes();
    }
  }, [subMode, paperTrades.length, refreshPaperQuotes]);

  async function handleRunSandbox() {
    setSandboxLoading(true);
    setSandboxError("");
    try {
      const res = await fetch("/api/portfolio/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdings: sandboxRows,
          lookbackDays: sandboxDays,
          initialCapital: baseCapital,
        }),
      });
      const json = (await res.json()) as { result?: SandboxResult; error?: string };
      if (!res.ok || !json.result) throw new Error(json.error || "รัน Sandbox ไม่สำเร็จ");
      setSandboxResult(json.result);
    } catch (err) {
      setSandboxError(err instanceof Error ? err.message : "รัน Sandbox ไม่สำเร็จ");
    } finally {
      setSandboxLoading(false);
    }
  }

  function handleAddPaperTrade(e: React.FormEvent) {
    e.preventDefault();
    const sym = ptSymbol.trim().toUpperCase().replace(/\.BK$/i, "");
    const entry = Number(ptEntry);
    const sharesRaw = Math.max(100, Math.floor((Number(ptShares) || 100) / 100) * 100);
    const stop = Number(ptStop) || Number((entry * 0.95).toFixed(2));
    const target = Number(ptTarget) || Number((entry * 1.1).toFixed(2));
    if (!sym || !Number.isFinite(entry) || entry <= 0) {
      showToast("กรุณากรอกชื่อหุ้นและราคาเข้าซื้อให้ถูกต้อง");
      return;
    }
    addPaperTrade({
      symbol: sym,
      status: "open",
      entryPrice: entry,
      shares: sharesRaw,
      stopLoss: stop,
      targetPrice: target,
      entryDate: new Date().toISOString().slice(0, 10),
      strategy: ptStrategy.trim() || "Swing",
      note: ptNote.trim(),
    });
    setPtSymbol("");
    setPtEntry("");
    setPtStop("");
    setPtTarget("");
    setPtNote("");
  }

  function handleExportJson() {
    const json = exportPaperTradesJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `set360-paper-trade-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("ดาวน์โหลดไฟล์สำรอง Paper Trade (.json) แล้ว");
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importPaperTradesJson(String(reader.result || ""));
      if (!res.ok) showToast(res.error || "นำเข้าไฟล์ไม่สำเร็จ");
    };
    reader.readAsText(file);
    if (importFileRef.current) importFileRef.current.value = "";
  }

  const paperStats = useMemo(() => {
    let openCost = 0;
    let unrealizedBaht = 0;
    let realizedBaht = 0;
    let closedWins = 0;
    let closedCount = 0;

    for (const t of paperTrades) {
      if (t.status === "open") {
        openCost += t.entryPrice * t.shares;
        const cur = liveQuotes[t.symbol]?.price ?? t.entryPrice;
        unrealizedBaht += (cur - t.entryPrice) * t.shares;
      } else if (t.exitPrice !== undefined) {
        closedCount++;
        const pnl = (t.exitPrice - t.entryPrice) * t.shares;
        realizedBaht += pnl;
        if (pnl > 0) closedWins++;
      }
    }

    const unrealizedPct = openCost > 0 ? (unrealizedBaht / openCost) * 100 : 0;
    const winRatePct = closedCount > 0 ? (closedWins / closedCount) * 100 : 0;
    return {
      openCount: paperTrades.filter((t) => t.status === "open").length,
      closedCount,
      openCost,
      unrealizedBaht,
      unrealizedPct,
      realizedBaht,
      winRatePct,
    };
  }, [paperTrades, liveQuotes]);

  return (
    <div className="space-y-5">
      {/* Sub-mode switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-800 p-1 gap-1">
          {(
            [
              ["weekly", "พอร์ตจำลองรายสัปดาห์ 360° (5 มิติ)", Briefcase],
              ["backtest", "Backtest 12 สัปดาห์ & Sandbox", LineChart],
              ["paper", `สมุดจด Paper Trade ส่วนตัว (${paperTrades.length})`, BookmarkPlus],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubMode(id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                subMode === id
                  ? "bg-sky-500 text-slate-950 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {subMode === "weekly" && (
          <div className="flex items-center gap-2">
            <select
              value={baseCapital}
              onChange={(e) => setBaseCapital(Number(e.target.value))}
              className="rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold outline-none"
            >
              <option value={100000}>เงินตั้งต้น 100,000 บ.</option>
              <option value={300000}>เงินตั้งต้น 300,000 บ.</option>
              <option value={500000}>เงินตั้งต้น 500,000 บ.</option>
              <option value={1000000}>เงินตั้งต้น 1,000,000 บ.</option>
            </select>
            <button
              type="button"
              onClick={() => void loadWeekly(true)}
              disabled={weeklyLoading}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-sky-400 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${weeklyLoading ? "animate-spin" : ""}`} />
              คำนวณใหม่
            </button>
          </div>
        )}
      </div>

      {/* SUB-MODE 1: WEEKLY 360 MODEL PORTFOLIO */}
      {subMode === "weekly" && (
        <>
          {weeklyError && (
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 text-xs text-rose-400">
              {weeklyError}
            </div>
          )}

          {weeklyLoading && !weeklyData ? (
            <div className="space-y-4">
              <SkeletonCard lines={2} />
              <SkeletonCard lines={6} />
            </div>
          ) : weeklyData ? (
            <div className="space-y-4">
              {/* Emergency Alerts Banner */}
              {weeklyData.emergencyAlerts.length > 0 && (
                <div className="rounded-2xl border border-rose-500/45 bg-rose-500/10 p-4 space-y-2">
                  <div className="text-xs font-extrabold text-rose-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    ระบบเตือนปรับแผนฉุกเฉิน ({weeklyData.emergencyAlerts.length} รายการ)
                  </div>
                  {weeklyData.emergencyAlerts.map((a, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-slate-950/60 border border-rose-500/25 px-3.5 py-2.5 text-xs"
                    >
                      <div className="font-bold text-rose-300">{a.title}</div>
                      <div className="text-slate-300 mt-0.5">{a.actionTh}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Weekly KPI Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
                  <div className="text-[11px] text-slate-500">
                    พอร์ต 360° ({weeklyData.weekLabel})
                  </div>
                  <div
                    className={`text-2xl font-extrabold tabular-nums mt-1 ${
                      weeklyData.totalPnlPct >= 0 ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {weeklyData.totalPnlPct >= 0 ? "+" : ""}
                    {weeklyData.totalPnlPct.toFixed(2)}%
                  </div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    {weeklyData.totalPnlBaht >= 0 ? "+" : ""}
                    {weeklyData.totalPnlBaht.toLocaleString()} บ.
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
                  <div className="text-[11px] text-slate-500">เทียบดัชนี SET สัปดาห์นี้</div>
                  <div
                    className={`text-2xl font-extrabold tabular-nums mt-1 ${
                      weeklyData.setWeekReturnPct >= 0 ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {weeklyData.setWeekReturnPct >= 0 ? "+" : ""}
                    {weeklyData.setWeekReturnPct.toFixed(2)}%
                  </div>
                  <div className="text-xs text-slate-400">ณ วันที่ {weeklyData.asOfDate}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
                  <div className="text-[11px] text-slate-500">ส่วนต่างชนะตลาด (Alpha)</div>
                  <div
                    className={`text-2xl font-extrabold tabular-nums mt-1 ${
                      weeklyData.alphaPct >= 0 ? "text-sky-500" : "text-amber-500"
                    }`}
                  >
                    {weeklyData.alphaPct >= 0 ? "+" : ""}
                    {weeklyData.alphaPct.toFixed(2)}%
                  </div>
                  <div className="text-xs text-slate-400">ล็อกแผนวันจันทร์ Zero Look-Ahead</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
                  <div className="text-[11px] text-slate-500">เกณฑ์คัดเลือก 5 มิติ</div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-1.5">
                    Top 5 จาก SET50
                  </div>
                  <div className="text-[11px] text-slate-400">
                    จำกัดไม่เกิน 2 หุ้น/หมวดธุรกิจ
                  </div>
                </div>
              </div>

              {/* Top 5 Weekly Picks Cards */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  แผนหุ้น Top 5 ประจำสัปดาห์ (ล็อกราคาเปิดวันจันทร์ {weeklyData.mondayDate})
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {weeklyData.picks.map((p) => (
                    <div
                      key={p.symbol}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-lg bg-sky-500/15 text-sky-500 text-xs font-extrabold flex items-center justify-center">
                              #{p.rank}
                            </span>
                            <button
                              type="button"
                              onClick={() => jumpToStock(p.symbol)}
                              className="text-lg font-extrabold text-slate-900 dark:text-white hover:text-sky-400 cursor-pointer"
                            >
                              {p.symbol}
                            </button>
                            <span className="text-[11px] text-slate-500">{p.sector}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{p.rationaleTh}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-extrabold text-amber-500 tabular-nums">
                            คะแนน 5 มิติ: {p.scores.total}/100
                          </div>
                          <div
                            className={`text-sm font-extrabold tabular-nums ${
                              p.pnlPct >= 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {p.pnlPct >= 0 ? "+" : ""}
                            {p.pnlPct.toFixed(2)}% ({p.pnlBaht >= 0 ? "+" : ""}
                            {p.pnlBaht.toLocaleString()} บ.)
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-xs tabular-nums">
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 p-2">
                          <div className="text-[10px] text-slate-500">เข้า (จันทร์)</div>
                          <div className="font-bold">{p.entryPrice.toFixed(2)}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 p-2">
                          <div className="text-[10px] text-slate-500">ราคาล่าสุด</div>
                          <div className="font-bold text-sky-500">{p.currentPrice.toFixed(2)}</div>
                        </div>
                        <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-2">
                          <div className="text-[10px] text-rose-400">Stop Loss</div>
                          <div className="font-bold text-rose-500">{p.stopLoss.toFixed(2)}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2">
                          <div className="text-[10px] text-emerald-400">Target</div>
                          <div className="font-bold text-emerald-500">
                            {p.targetPrice.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <DimensionScoreBars scores={p.scores} />

                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-500 tabular-nums">
                          {p.sharesBoardLot.toLocaleString()} หุ้น ({p.allocatedBaht.toLocaleString()} บ.) ·
                          5D Win <strong className="text-emerald-500">{p.winRate5dPct}%</strong> ·
                          R:R 1:{p.rrRatio}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              jumpToTimeMachine({
                                symbol: p.symbol,
                                entry: p.entryPrice,
                                stop: p.stopLoss,
                                target: p.targetPrice,
                                sourceLabel: "พอร์ต 360° รายสัปดาห์",
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500 hover:text-slate-950 text-sky-500 font-bold inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <FlaskConical className="h-3 w-3" /> Time Machine
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              addPaperTrade({
                                symbol: p.symbol,
                                status: "open",
                                entryPrice: p.entryPrice,
                                shares: p.sharesBoardLot,
                                stopLoss: p.stopLoss,
                                targetPrice: p.targetPrice,
                                entryDate: weeklyData.mondayDate,
                                strategy: "พอร์ตจำลอง 360° รายสัปดาห์",
                                note: `คะแนน ${p.scores.total}/100 · ${p.rationaleTh}`,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 hover:text-slate-950 text-emerald-500 font-bold inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <BookmarkPlus className="h-3 w-3" /> จด Paper Trade
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* SUB-MODE 2: 12-WEEK BACKTEST & SANDBOX */}
      {subMode === "backtest" && (
        <div className="space-y-5">
          {/* 12-Week Backtest vs SET */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                สถิติย้อนหลังพอร์ตจำลอง 360° (12 สัปดาห์) เทียบดัชนี SET Index
              </h2>
              <p className="text-xs text-slate-500">
                จำลองการคัด Top 5 SET50 ทุกวันจันทร์โดยใช้เฉพาะข้อมูลก่อนเปิดตลาดจันทร์ (Zero Look-Ahead) พร้อมวินัย Stop Loss -4.5% / Take Profit +8.5%
              </p>
            </div>

            {weeklyData && weeklyData.backtest12W.length > 0 ? (
              <>
                <Backtest12WChart points={weeklyData.backtest12W} theme={theme} />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2 pr-3">สัปดาห์</th>
                        <th className="py-2 px-3">หุ้นที่คัดได้ (Top 5)</th>
                        <th className="py-2 px-3 text-right">พอร์ต 360°</th>
                        <th className="py-2 px-3 text-right">SET Index</th>
                        <th className="py-2 pl-3 text-right">สะสม 360° vs SET</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 tabular-nums">
                      {[...weeklyData.backtest12W].reverse().map((pt) => (
                        <tr key={pt.startDate}>
                          <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                            {pt.startDate} → {pt.endDate.slice(5)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1">
                              {pt.topPicks.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => jumpToStock(s)}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold hover:text-sky-400 cursor-pointer"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold ${
                              pt.portfolioReturnPct >= 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {pt.portfolioReturnPct >= 0 ? "+" : ""}
                            {pt.portfolioReturnPct.toFixed(2)}%
                          </td>
                          <td
                            className={`py-2 px-3 text-right ${
                              pt.setReturnPct >= 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {pt.setReturnPct >= 0 ? "+" : ""}
                            {pt.setReturnPct.toFixed(2)}%
                          </td>
                          <td className="py-2 pl-3 text-right font-semibold">
                            <span
                              className={
                                pt.cumulativePortfolioPct >= 0
                                  ? "text-emerald-500"
                                  : "text-rose-500"
                              }
                            >
                              {pt.cumulativePortfolioPct >= 0 ? "+" : ""}
                              {pt.cumulativePortfolioPct.toFixed(2)}%
                            </span>{" "}
                            <span className="text-slate-400">
                              / {pt.cumulativeSetPct >= 0 ? "+" : ""}
                              {pt.cumulativeSetPct.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <SkeletonCard lines={4} />
            )}
          </div>

          {/* Sandbox Backtest */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Sandbox Backtest · จำลองจัดพอร์ตหุ้นไทยเองเทียบ SET Index
              </h3>
              <p className="text-xs text-slate-500">
                เลือกหุ้น SET/mai และน้ำหนัก % ที่อยากทดสอบเพื่อดูผลตอบแทนย้อนหลังจริง, Alpha และ Max Drawdown
              </p>
            </div>

            <div className="space-y-2">
              {sandboxRows.map((row, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={row.symbol}
                    onChange={(e) =>
                      setSandboxRows((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, symbol: e.target.value.toUpperCase() } : r
                        )
                      )
                    }
                    placeholder="ชื่อหุ้น เช่น PTT"
                    className="w-36 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold uppercase outline-none focus:border-sky-400"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={row.weightPct}
                    onChange={(e) =>
                      setSandboxRows((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, weightPct: Number(e.target.value) } : r
                        )
                      )
                    }
                    className="w-24 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold tabular-nums outline-none"
                  />
                  <span className="text-xs text-slate-500">%</span>
                  {sandboxRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSandboxRows((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  sandboxRows.length < 10 &&
                  setSandboxRows((prev) => [...prev, { symbol: "", weightPct: 20 }])
                }
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 hover:border-sky-400 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> เพิ่มหุ้น
              </button>

              <select
                value={sandboxDays}
                onChange={(e) => setSandboxDays(Number(e.target.value))}
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold outline-none"
              >
                <option value={30}>ย้อนหลัง 30 วันทำการ (~1.5 เดือน)</option>
                <option value={60}>ย้อนหลัง 60 วันทำการ (~3 เดือน)</option>
                <option value={120}>ย้อนหลัง 120 วันทำการ (~6 เดือน)</option>
                <option value={200}>ย้อนหลัง 200 วันทำการ (~10 เดือน)</option>
              </select>

              <button
                type="button"
                onClick={() => void handleRunSandbox()}
                disabled={sandboxLoading}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {sandboxLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4" />
                )}
                รัน Sandbox Backtest
              </button>
            </div>

            {sandboxError && (
              <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-400">
                {sandboxError}
              </div>
            )}

            {sandboxResult && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-slate-500">ผลตอบแทนพอร์ต Sandbox</div>
                    <div
                      className={`text-xl font-extrabold tabular-nums mt-0.5 ${
                        sandboxResult.totalReturnPct >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {sandboxResult.totalReturnPct >= 0 ? "+" : ""}
                      {sandboxResult.totalReturnPct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-slate-500">SET Index ช่วงเดียวกัน</div>
                    <div
                      className={`text-xl font-extrabold tabular-nums mt-0.5 ${
                        sandboxResult.setReturnPct >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {sandboxResult.setReturnPct >= 0 ? "+" : ""}
                      {sandboxResult.setReturnPct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-slate-500">Alpha ชนะ/แพ้ตลาด</div>
                    <div
                      className={`text-xl font-extrabold tabular-nums mt-0.5 ${
                        sandboxResult.alphaPct >= 0 ? "text-sky-500" : "text-amber-500"
                      }`}
                    >
                      {sandboxResult.alphaPct >= 0 ? "+" : ""}
                      {sandboxResult.alphaPct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-slate-500">Max Drawdown</div>
                    <div className="text-xl font-extrabold text-rose-500 tabular-nums mt-0.5">
                      {sandboxResult.maxDrawdownPct.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <SandboxCurveChart curve={sandboxResult.curve} theme={theme} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-MODE 3: PERSONAL PAPER TRADE JOURNAL */}
      {subMode === "paper" && (
        <div className="space-y-4">
          {/* Paper Trade Stats + Export/Import */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
              <div className="text-[11px] text-slate-500">สถานะถือครองอยู่ (Open)</div>
              <div className="text-2xl font-extrabold tabular-nums mt-1">
                {paperStats.openCount} รายการ
              </div>
              <div className="text-xs text-slate-400 tabular-nums">
                ต้นทุนรวม {paperStats.openCost.toLocaleString()} บ.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
              <div className="text-[11px] text-slate-500">กำไร/ขาดทุนยังไม่รับรู้ (Unrealized)</div>
              <div
                className={`text-2xl font-extrabold tabular-nums mt-1 ${
                  paperStats.unrealizedBaht >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {paperStats.unrealizedBaht >= 0 ? "+" : ""}
                {paperStats.unrealizedBaht.toLocaleString(undefined, { maximumFractionDigits: 0 })} บ.
              </div>
              <div className="text-xs text-slate-400 tabular-nums">
                ({paperStats.unrealizedPct >= 0 ? "+" : ""}
                {paperStats.unrealizedPct.toFixed(2)}%)
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
              <div className="text-[11px] text-slate-500">กำไร/ขาดทุนปิดแล้ว (Realized)</div>
              <div
                className={`text-2xl font-extrabold tabular-nums mt-1 ${
                  paperStats.realizedBaht >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {paperStats.realizedBaht >= 0 ? "+" : ""}
                {paperStats.realizedBaht.toLocaleString(undefined, { maximumFractionDigits: 0 })} บ.
              </div>
              <div className="text-xs text-slate-400">
                ปิดแล้ว {paperStats.closedCount} ไม้ (Win Rate {paperStats.winRatePct.toFixed(0)}%)
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 flex flex-col justify-between gap-2">
              <div className="text-[11px] text-slate-500">สำรอง / ย้ายเครื่อง (JSON)</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:border-sky-400 border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Export
                </button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:border-sky-400 border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" /> Import
                </button>
              </div>
            </div>
          </div>

          {/* Add New Paper Trade Form */}
          <form
            onSubmit={handleAddPaperTrade}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">จดบันทึก Paper Trade ใหม่</h3>
              <button
                type="button"
                onClick={() => void refreshPaperQuotes()}
                disabled={quotesLoading}
                className="text-xs text-sky-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${quotesLoading ? "animate-spin" : ""}`} />
                อัปเดตราคาตลาดสด
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 text-xs">
              <input
                type="text"
                value={ptSymbol}
                onChange={(e) => setPtSymbol(e.target.value.toUpperCase())}
                placeholder="หุ้น เช่น PTT"
                required
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 font-bold uppercase outline-none focus:border-sky-400"
              />
              <input
                type="number"
                step="0.01"
                value={ptEntry}
                onChange={(e) => setPtEntry(e.target.value)}
                placeholder="ราคาเข้า (บ.)"
                required
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 tabular-nums outline-none"
              />
              <input
                type="number"
                step="100"
                min="100"
                value={ptShares}
                onChange={(e) => setPtShares(e.target.value)}
                placeholder="จำนวนหุ้น (x100)"
                required
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 tabular-nums outline-none"
              />
              <input
                type="number"
                step="0.01"
                value={ptStop}
                onChange={(e) => setPtStop(e.target.value)}
                placeholder="Stop Loss (บ.)"
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-rose-500/35 px-3 py-2 tabular-nums outline-none"
              />
              <input
                type="number"
                step="0.01"
                value={ptTarget}
                onChange={(e) => setPtTarget(e.target.value)}
                placeholder="Target (บ.)"
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-emerald-500/35 px-3 py-2 tabular-nums outline-none"
              />
              <input
                type="text"
                value={ptStrategy}
                onChange={(e) => setPtStrategy(e.target.value)}
                placeholder="กลยุทธ์"
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-2 inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> บันทึกไม้
              </button>
            </div>
            <input
              type="text"
              value={ptNote}
              onChange={(e) => setPtNote(e.target.value)}
              placeholder="บันทึกเหตุผลการเข้าซื้อ / โน้ตส่วนตัว (ไม่บังคับ)..."
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs outline-none"
            />
          </form>

          {/* Paper Trade List */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5">
            {paperTrades.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 space-y-2">
                <p>ยังไม่มีรายการในสมุดจด Paper Trade</p>
                <p>
                  คุณสามารถเพิ่มรายการด้านบน หรือกดปุ่ม <strong>&quot;ส่งเข้า Paper Trade&quot;</strong> จากหน้า Time Machine, สแกนหุ้น SET50, AI Chat Bot หรือพอร์ตจำลอง 360° ได้ทันทีครับ
                </p>
              </div>
            ) : isCardView ? (
              <div className="space-y-2.5">
                {paperTrades.map((t) => {
                  const curPrice =
                    t.status === "closed"
                      ? t.exitPrice ?? t.entryPrice
                      : liveQuotes[t.symbol]?.price ?? t.entryPrice;
                  const pnlBaht = (curPrice - t.entryPrice) * t.shares;
                  const pnlPct = ((curPrice - t.entryPrice) / t.entryPrice) * 100;
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => jumpToStock(t.symbol)}
                            className="font-extrabold text-sm text-sky-500 cursor-pointer"
                          >
                            {t.symbol}
                          </button>
                          <SentimentBadge
                            bias={t.status === "open" ? "neutral" : pnlBaht >= 0 ? "positive" : "negative"}
                            label={t.status === "open" ? "OPEN" : "CLOSED"}
                          />
                        </div>
                        <span
                          className={`font-extrabold tabular-nums ${
                            pnlBaht >= 0 ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {pnlBaht >= 0 ? "+" : ""}
                          {pnlBaht.toLocaleString(undefined, { maximumFractionDigits: 0 })} บ. (
                          {pnlPct >= 0 ? "+" : ""}
                          {pnlPct.toFixed(2)}%)
                        </span>
                      </div>
                      <div className="tabular-nums text-slate-500">
                        {t.shares.toLocaleString()} หุ้น @ {t.entryPrice.toFixed(2)} →{" "}
                        {curPrice.toFixed(2)} · SL {t.stopLoss.toFixed(2)} / TP{" "}
                        {t.targetPrice.toFixed(2)}
                      </div>
                      {t.note && <p className="text-slate-400">{t.note}</p>}
                      <div className="flex justify-end gap-2">
                        {t.status === "open" && (
                          <button
                            type="button"
                            onClick={() => closePaperTrade(t.id, curPrice)}
                            className="px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 font-bold cursor-pointer"
                          >
                            ปิดที่ {curPrice.toFixed(2)}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePaperTrade(t.id)}
                          className="px-2 py-1 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2 pr-3">สถานะ</th>
                      <th className="py-2 px-3">หุ้น</th>
                      <th className="py-2 px-3 text-right">จำนวนหุ้น</th>
                      <th className="py-2 px-3 text-right">ทุนเข้า</th>
                      <th className="py-2 px-3 text-right">ล่าสุด / ปิด</th>
                      <th className="py-2 px-3">Stop / Target</th>
                      <th className="py-2 px-3 text-right">PnL (บาท / %)</th>
                      <th className="py-2 px-3">กลยุทธ์ / โน้ต</th>
                      <th className="py-2 pl-3 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {paperTrades.map((t) => {
                      const curPrice =
                        t.status === "closed"
                          ? t.exitPrice ?? t.entryPrice
                          : liveQuotes[t.symbol]?.price ?? t.entryPrice;
                      const pnlBaht = (curPrice - t.entryPrice) * t.shares;
                      const pnlPct = ((curPrice - t.entryPrice) / t.entryPrice) * 100;
                      return (
                        <tr key={t.id} className="hover:bg-sky-500/5">
                          <td className="py-2.5 pr-3">
                            <SentimentBadge
                              bias={
                                t.status === "open"
                                  ? "neutral"
                                  : pnlBaht >= 0
                                    ? "positive"
                                    : "negative"
                              }
                              label={t.status === "open" ? "OPEN" : "CLOSED"}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => jumpToStock(t.symbol)}
                              className="font-extrabold text-sky-500 hover:underline cursor-pointer"
                            >
                              {t.symbol}
                            </button>
                            <div className="text-[10px] text-slate-500">{t.entryDate}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                            {t.shares.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {t.entryPrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold">
                            {curPrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums whitespace-nowrap">
                            <span className="text-rose-500">{t.stopLoss.toFixed(2)}</span> /{" "}
                            <span className="text-emerald-500">{t.targetPrice.toFixed(2)}</span>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right tabular-nums font-extrabold whitespace-nowrap ${
                              pnlBaht >= 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {pnlBaht >= 0 ? "+" : ""}
                            {pnlBaht.toLocaleString(undefined, { maximumFractionDigits: 0 })} บ. (
                            {pnlPct >= 0 ? "+" : ""}
                            {pnlPct.toFixed(2)}%)
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[200px]">
                            <div className="font-semibold text-slate-700 dark:text-slate-300">
                              {t.strategy}
                            </div>
                            {t.note && <div className="text-[11px] truncate">{t.note}</div>}
                          </td>
                          <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {t.status === "open" && (
                                <button
                                  type="button"
                                  onClick={() => closePaperTrade(t.id, curPrice)}
                                  className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500 hover:text-slate-950 text-sky-500 font-bold inline-flex items-center gap-1 cursor-pointer"
                                  title="ปิดสถานะที่ราคาตลาดปัจจุบัน"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> ปิดไม้
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => deletePaperTrade(t.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                                title="ลบรายการ"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
