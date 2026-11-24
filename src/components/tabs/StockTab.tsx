"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  FlaskConical,
  History,
  LineChart,
  Loader2,
  Maximize2,
  Minimize2,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { LightweightCandlestickChart } from "@/components/charts/LightweightCandlestickChart";
import { TimeMachineChart } from "@/components/charts/TimeMachineChart";
import { DataAuditStrip, SentimentBadge, SkeletonCard } from "@/components/common/UiPrimitives";
import { calcBoardLotSizing, runTimeMachineSimulation } from "@/lib/quant/timeMachine";
import type {
  PeerMetricRow,
  PointInTimeReplayResult,
  StockAnalysisPayload,
  TimeMachineHorizon,
} from "@/lib/types";
import { useAppStore, type StockSubTabId } from "@/store/useAppStore";

interface UploadedPdfAnalysis {
  fileName: string;
  charCount: number;
  excerpt: string;
  brokerName: string;
  rating: string;
  targetPrice: number | null;
  upsidePct: number | null;
  summary: string;
  keyTakeaways: string[];
  risks: string[];
  modelUsed: string;
}

export function StockTab() {
  const {
    activeSymbol,
    setActiveSymbol,
    stockSubTab,
    setStockSubTab,
    prefilledPlan,
    clearPrefilledPlan,
    addPaperTrade,
    watchlist,
    addToWatchlist,
    theme,
    isCardView,
    modelSettings,
    showToast,
  } = useAppStore();

  const [inputTicker, setInputTicker] = useState(activeSymbol);
  const [extractPdf, setExtractPdf] = useState(true);
  const [data, setData] = useState<StockAnalysisPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandChart, setExpandChart] = useState(false);
  const [copiedLine, setCopiedLine] = useState(false);
  const [showFactSheet, setShowFactSheet] = useState(false);

  // Manual PDF upload state
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfAnalysis | null>(null);

  // Position sizing & Time Machine state
  const [portfolioBaht, setPortfolioBaht] = useState(100_000);
  const [riskPct, setRiskPct] = useState(2);
  const [tmEntry, setTmEntry] = useState(0);
  const [tmStop, setTmStop] = useState(0);
  const [tmTarget, setTmTarget] = useState(0);
  const [tmHorizon, setTmHorizon] = useState<TimeMachineHorizon>("10d");
  const [intradayBars, setIntradayBars] = useState<StockAnalysisPayload["bars"]>([]);
  const [loadingIntraday, setLoadingIntraday] = useState(false);

  // Peer comparison state
  const [peersInput, setPeersInput] = useState("");
  const [peerRows, setPeerRows] = useState<PeerMetricRow[]>([]);
  const [peerAverage, setPeerAverage] = useState<PeerMetricRow | null>(null);
  const [peersLoading, setPeersLoading] = useState(false);

  // Point-in-Time Replay state
  const [replayDate, setReplayDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 45);
    return d.toISOString().slice(0, 10);
  });
  const [runAiLeakage, setRunAiLeakage] = useState(true);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayResult, setReplayResult] = useState<PointInTimeReplayResult | null>(null);
  const [replayError, setReplayError] = useState("");

  useEffect(() => {
    setInputTicker(activeSymbol);
  }, [activeSymbol]);

  const fetchStock = useCallback(
    async (sym: string, refresh = false) => {
      const clean = sym.trim().toUpperCase().replace(/\.BK$/i, "");
      if (!clean) return;
      setLoading(true);
      setError("");
      setUploadedPdf(null);
      setReplayResult(null);
      try {
        const params = new URLSearchParams();
        if (refresh) params.set("refresh", "1");
        if (!extractPdf) params.set("extractPdf", "0");
        if (modelSettings.proModel) params.set("model", modelSettings.proModel);
        const res = await fetch(`/api/stock/${encodeURIComponent(clean)}?${params.toString()}`);
        const json = (await res.json()) as StockAnalysisPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || `ไม่พบข้อมูลหุ้น ${clean}`);
        setData(json);
        setIntradayBars(json.intradayBars ?? []);
        setPeersInput(json.defaultPeers.join(", "));

        // Populate Time Machine inputs (prefer prefilled plan if matching symbol!)
        if (prefilledPlan && prefilledPlan.symbol === clean) {
          setTmEntry(prefilledPlan.entry);
          setTmStop(prefilledPlan.stop);
          setTmTarget(prefilledPlan.target);
          clearPrefilledPlan();
        } else {
          setTmEntry(json.technicals.price);
          setTmStop(json.technicals.standardStop);
          setTmTarget(json.technicals.shortTarget);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "โหลดข้อมูลหุ้นไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [extractPdf, modelSettings.proModel, prefilledPlan, clearPrefilledPlan]
  );

  useEffect(() => {
    void fetchStock(activeSymbol, false);
  }, [activeSymbol, fetchStock]);

  // Fetch intraday 5m bars lazily when user selects 1d_5m horizon in Time Machine
  useEffect(() => {
    if (tmHorizon !== "1d_5m" || !data || intradayBars.length > 0) return;
    let active = true;
    setLoadingIntraday(true);
    fetch(`/api/stock/${encodeURIComponent(data.symbol)}?intraday=1&extractPdf=0`)
      .then((r) => r.json())
      .then((j: StockAnalysisPayload) => {
        if (active && j.intradayBars?.length) {
          setIntradayBars(j.intradayBars);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingIntraday(false);
      });
    return () => {
      active = false;
    };
  }, [tmHorizon, data, intradayBars.length]);

  // Load peers when switching to peers tab
  const loadPeers = useCallback(async (sym: string, customCsv?: string) => {
    setPeersLoading(true);
    try {
      const q = customCsv ? `?peers=${encodeURIComponent(customCsv)}` : "";
      const res = await fetch(`/api/stock/${encodeURIComponent(sym)}/peers${q}`);
      const json = (await res.json()) as {
        rows?: PeerMetricRow[];
        sectorAverage?: PeerMetricRow;
      };
      if (res.ok && json.rows) {
        setPeerRows(json.rows);
        setPeerAverage(json.sectorAverage ?? null);
      }
    } finally {
      setPeersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (stockSubTab === "peers" && data) {
      void loadPeers(data.symbol, peersInput || data.defaultPeers.join(","));
    }
  }, [stockSubTab, data, loadPeers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time Position Sizing & 10,000-Run Time Machine Calculation (instant <20ms!)
  const sizing = useMemo(() => {
    if (!data || tmEntry <= 0 || tmStop <= 0 || tmTarget <= 0) return null;
    return calcBoardLotSizing({
      symbol: data.symbol,
      portfolioBaht,
      riskPct,
      entry: tmEntry,
      stop: tmStop,
      target: tmTarget,
    });
  }, [data, portfolioBaht, riskPct, tmEntry, tmStop, tmTarget]);

  const tmResult = useMemo(() => {
    if (!data || tmEntry <= 0 || tmStop <= 0 || tmTarget <= 0 || tmStop >= tmEntry || tmTarget <= tmEntry) {
      return null;
    }
    const sourceBars =
      tmHorizon === "1d_5m" && intradayBars.length >= 20 ? intradayBars : data.bars;
    return runTimeMachineSimulation({
      symbol: data.symbol,
      bars: sourceBars,
      entry: tmEntry,
      stop: tmStop,
      target: tmTarget,
      horizon: tmHorizon,
      simulations: 10_000,
    });
  }, [data, intradayBars, tmEntry, tmStop, tmTarget, tmHorizon]);

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !data) return;
    setPdfUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("model", modelSettings.proModel);
      const res = await fetch(`/api/stock/${encodeURIComponent(data.symbol)}/pdf`, {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as UploadedPdfAnalysis & { error?: string };
      if (!res.ok) throw new Error(json.error || "อ่านไฟล์ PDF ไม่สำเร็จ");
      setUploadedPdf(json);
      showToast(`อ่านไฟล์ ${file.name} และวิเคราะห์ด้วย ${json.modelUsed} แล้ว`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "อัปโหลด PDF ไม่สำเร็จ");
    } finally {
      setPdfUploading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  async function handleRunReplay() {
    if (!data) return;
    setReplayLoading(true);
    setReplayError("");
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(data.symbol)}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asOfDate: replayDate,
          runAiLeakageCheck: runAiLeakage,
          model: modelSettings.proModel,
        }),
      });
      const json = (await res.json()) as PointInTimeReplayResult & { error?: string };
      if (!res.ok) throw new Error(json.error || "ทดสอบย้อนเวลาไม่สำเร็จ");
      setReplayResult(json);
    } catch (err) {
      setReplayError(err instanceof Error ? err.message : "ทดสอบย้อนเวลาไม่สำเร็จ");
    } finally {
      setReplayLoading(false);
    }
  }

  function handleCopyLineSummary() {
    if (!data) return;
    const summary = [
      `📊 สรุปหุ้น ${data.symbol} (${data.companyName})`,
      `ราคา: ${data.technicals.price.toFixed(2)} บ. (${data.technicals.changePct >= 0 ? "+" : ""}${data.technicals.changePct.toFixed(2)}%)`,
      `ฟันธง AI: ${data.aiSynthesis.verdict}`,
      data.iaaConsensus.avgTargetPrice
        ? `เป้า IAA เฉลี่ย: ${data.iaaConsensus.avgTargetPrice.toFixed(2)} บ. (Upside ${data.iaaConsensus.upsidePct?.toFixed(1)}%, ซื้อ ${data.iaaConsensus.buyCount}/${data.iaaConsensus.totalBrokers} โบรกฯ)`
        : `เป้า IAA: ไม่มีข้อมูล`,
      `แผนเทรด 20D: Entry ${data.technicals.price.toFixed(2)} | Stop ${data.technicals.standardStop.toFixed(2)} | Target ${data.technicals.shortTarget.toFixed(2)}`,
      `แนวรับ S1/S2: ${data.technicals.s1}/${data.technicals.s2} · แนวต้าน R1/R2: ${data.technicals.r1}/${data.technicals.r2}`,
    ].join("\n");
    void navigator.clipboard.writeText(summary);
    setCopiedLine(true);
    showToast("คัดลอกสรุปส่งต่อ LINE / โน้ต แล้ว");
    setTimeout(() => setCopiedLine(false), 2000);
  }

  const subTabs: { id: StockSubTabId; label: string; icon: React.ReactNode }[] = [
    { id: "chart", label: "กราฟเทคนิค", icon: <LineChart className="h-3.5 w-3.5" /> },
    { id: "timemachine", label: "แผนเทรด & Time Machine", icon: <FlaskConical className="h-3.5 w-3.5" /> },
    { id: "peers", label: "เทียบคู่แข่ง", icon: <Scale className="h-3.5 w-3.5" /> },
    {
      id: "sources",
      label: `แหล่งข้อมูล (${(data?.brokerReports.length ?? 0) + (data?.companyNews.length ?? 0)})`,
      icon: <FileText className="h-3.5 w-3.5" />,
    },
    { id: "replay", label: "ทดสอบย้อนเวลา", icon: <History className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Top Search & PDF Upload Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const clean = inputTicker.trim().toUpperCase().replace(/\.BK$/i, "");
            if (clean) {
              if (clean === activeSymbol) void fetchStock(clean, true);
              else setActiveSymbol(clean);
            }
          }}
          className="flex flex-wrap items-center gap-2.5"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={inputTicker}
              onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
              placeholder="พิมพ์ชื่อย่อหุ้นไทย SET / mai เช่น PTT, CPALL, BDMS, AAI..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm font-bold tracking-wide uppercase outline-none focus:border-sky-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            วิเคราะห์หุ้น
          </button>

          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handlePdfUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={!data || pdfUploading}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:border-amber-400 border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="อัปโหลดไฟล์ PDF บทวิเคราะห์โบรกเกอร์เพื่อให้ Gemini Pro อ่านและสรุปประเด็นสำคัญ"
          >
            {pdfUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
            ) : (
              <Upload className="h-3.5 w-3.5 text-amber-400" />
            )}
            อัปโหลด PDF บทวิเคราะห์
          </button>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none ml-auto">
            <input
              type="checkbox"
              checked={extractPdf}
              onChange={(e) => setExtractPdf(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            <span>สกัด PDF โบรกฯ อัตโนมัติ (Timeout Guard)</span>
          </label>
        </form>

        {/* Quick Watchlist pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-slate-500 mr-1">หุ้นยอดนิยม / Watchlist:</span>
          {watchlist.map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => setActiveSymbol(sym)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                sym === activeSymbol
                  ? "bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/40"
                  : "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={6} />
        </div>
      ) : data ? (
        <>
          {/* Hero Price + IAA Consensus Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Stock Price Header */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 flex flex-col justify-between gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {data.symbol}
                    </h1>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      {data.sector}
                    </span>
                    <button
                      type="button"
                      onClick={() => addToWatchlist(data.symbol)}
                      className="text-slate-400 hover:text-amber-400 transition cursor-pointer"
                      title="เพิ่มใน Watchlist"
                    >
                      <Star
                        className={`h-4 w-4 ${watchlist.includes(data.symbol) ? "fill-amber-400 text-amber-400" : ""}`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {data.companyName}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {data.technicals.price.toFixed(2)}{" "}
                    <span className="text-sm font-normal text-slate-400">บ.</span>
                  </div>
                  <div
                    className={`inline-flex items-center gap-0.5 text-sm font-bold tabular-nums ${
                      data.technicals.change >= 0 ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {data.technicals.change >= 0 ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                    {data.technicals.change >= 0 ? "+" : ""}
                    {data.technicals.change.toFixed(2)} (
                    {data.technicals.changePct >= 0 ? "+" : ""}
                    {data.technicals.changePct.toFixed(2)}%)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    แท่งเทียนล่าสุด: {data.technicals.candleTimestamp}
                  </div>
                </div>
              </div>

              {/* Fundamentals Strip */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                {[
                  { label: "P/E", val: data.fundamentals.pe ? `${data.fundamentals.pe.toFixed(1)}x` : "-" },
                  { label: "P/BV", val: data.fundamentals.pbv ? `${data.fundamentals.pbv.toFixed(2)}x` : "-" },
                  { label: "ROE", val: data.fundamentals.roe ? `${data.fundamentals.roe.toFixed(1)}%` : "-" },
                  {
                    label: "Yield",
                    val: data.fundamentals.dividendYield
                      ? `${data.fundamentals.dividendYield.toFixed(2)}%`
                      : "-",
                  },
                  {
                    label: "Vol vs 20D",
                    val: data.technicals.volRatio ? `${data.technicals.volRatio.toFixed(2)}x` : "-",
                  },
                  {
                    label: "Mkt Cap",
                    val: data.fundamentals.marketCapBillion
                      ? `${data.fundamentals.marketCapBillion.toFixed(1)}B`
                      : "-",
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/70 px-2.5 py-2"
                  >
                    <div className="text-[10px] text-slate-500">{m.label}</div>
                    <div className="text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                      {m.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* IAA Consensus Summary Card */}
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-white to-white dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                    IAA / CONSENSUS เป้า 12 เดือน
                  </span>
                  <a
                    href={data.iaaConsensus.settradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-500 hover:underline inline-flex items-center gap-1"
                  >
                    Settrade <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {data.iaaConsensus.avgTargetPrice ? (
                  <>
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                        {data.iaaConsensus.avgTargetPrice.toFixed(2)} บ.
                      </span>
                      {data.iaaConsensus.upsidePct !== null && (
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            data.iaaConsensus.upsidePct >= 0
                              ? "text-emerald-500"
                              : "text-rose-500"
                          }`}
                        >
                          ({data.iaaConsensus.upsidePct >= 0 ? "+" : ""}
                          {data.iaaConsensus.upsidePct.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      ช่วงเป้าหมาย: {data.iaaConsensus.lowTargetPrice?.toFixed(2) ?? "-"} –{" "}
                      {data.iaaConsensus.highTargetPrice?.toFixed(2) ?? "-"} บ. (ค่ากลาง{" "}
                      {data.iaaConsensus.medianTargetPrice?.toFixed(2) ?? "-"} บ.)
                    </div>
                  </>
                ) : (
                  <div className="text-sm font-semibold text-slate-500 py-2">
                    ยังไม่มีเป้าเฉลี่ย Consensus ในระบบ
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-semibold tabular-nums">
                  <span className="text-emerald-500">ซื้อ {data.iaaConsensus.buyCount}</span>
                  <span className="text-amber-500">ถือ {data.iaaConsensus.holdCount}</span>
                  <span className="text-rose-500">ขาย {data.iaaConsensus.sellCount}</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  รวม {data.iaaConsensus.totalBrokers} โบรกฯ
                </span>
              </div>
            </div>
          </div>

          {/* Uploaded PDF Gemini Pro Analysis Card (if user uploaded one) */}
          {uploadedPdf && (
            <div className="rounded-2xl border border-amber-400/45 bg-amber-500/10 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-amber-400">
                    ผลวิเคราะห์ไฟล์ PDF ที่อัปโหลด ({uploadedPdf.fileName} · {uploadedPdf.modelUsed})
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {uploadedPdf.brokerName} · คำแนะนำ: {uploadedPdf.rating}
                    {uploadedPdf.targetPrice
                      ? ` · เป้า ${uploadedPdf.targetPrice.toFixed(2)} บ. (${uploadedPdf.upsidePct !== null ? `${uploadedPdf.upsidePct >= 0 ? "+" : ""}${uploadedPdf.upsidePct}%` : ""})`
                      : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedPdf(null)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  ปิดการ์ด
                </button>
              </div>
              <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                {uploadedPdf.summary}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="font-bold text-emerald-500 mb-1">ประเด็นสำคัญจาก PDF</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                    {uploadedPdf.keyTakeaways.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-bold text-rose-400 mb-1">ความเสี่ยงที่ระบุใน PDF</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                    {uploadedPdf.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Data Audit Strip */}
          <DataAuditStrip items={data.dataAudit} />

          {/* Single-Pass AI Synthesis Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-500 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  บทสังเคราะห์ความเห็น AI 360° ({data.aiSynthesis.modelUsed})
                </div>
                <div className="mt-1 text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {data.aiSynthesis.oneLineConclusion}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SentimentBadge
                  bias={data.aiSynthesis.verdictBias}
                  label={data.aiSynthesis.verdict}
                />
                <button
                  type="button"
                  onClick={handleCopyLineSummary}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  {copiedLine ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  คัดลอกส่ง LINE
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bull Case */}
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3.5 space-y-2">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ปัจจัยสนับสนุน (Bull Case)
                </div>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {data.aiSynthesis.bullCase.map((pt, i) => (
                    <li key={i} className="leading-relaxed">
                      • {pt.text}{" "}
                      {pt.sourceUrl ? (
                        <a
                          href={pt.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[11px] text-sky-500 hover:underline font-medium"
                        >
                          [{pt.sourceLabel} ↗]
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">[{pt.sourceLabel}]</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Bear Case */}
              <div className="rounded-xl bg-rose-500/5 border border-rose-500/20 p-3.5 space-y-2">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  ปัจจัยเสี่ยงและข้อจำกัดข้อมูล (Bear Case)
                </div>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {data.aiSynthesis.bearCase.map((pt, i) => (
                    <li key={i} className="leading-relaxed">
                      • {pt.text}{" "}
                      {pt.sourceUrl ? (
                        <a
                          href={pt.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[11px] text-sky-500 hover:underline font-medium"
                        >
                          [{pt.sourceLabel} ↗]
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">[{pt.sourceLabel}]</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Technical Levels Strip + Quick Actions */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  กรอบเทคนิคระยะสั้น (20D): แนวรับ{" "}
                  <span className="text-emerald-500">
                    S1 {data.technicals.s1.toFixed(2)} / S2 {data.technicals.s2.toFixed(2)}
                  </span>{" "}
                  · แนวต้าน{" "}
                  <span className="text-sky-400">
                    R1 {data.technicals.r1.toFixed(2)} / R2 {data.technicals.r2.toFixed(2)}
                  </span>{" "}
                  · Stop มาตรฐาน{" "}
                  <span className="text-rose-400">{data.technicals.standardStop.toFixed(2)} บ.</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {data.aiSynthesis.fundamentalView12M}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStockSubTab("timemachine")}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  ทดสอบ Time Machine
                </button>
              </div>
            </div>
          </div>

          {/* 5 Sub-Tabs Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {subTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStockSubTab(t.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                    stockSubTab === t.id
                      ? "bg-sky-500 text-slate-950 shadow-sm"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-sky-400"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {stockSubTab === "chart" && (
              <button
                type="button"
                onClick={() => setExpandChart((v) => !v)}
                className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:border-sky-400 cursor-pointer"
              >
                {expandChart ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {expandChart ? "ย่อขนาดกราฟ" : "ขยายกราฟเต็มจอ"}
              </button>
            )}
          </div>

          {/* SUB-TAB 1: Technical Chart */}
          {stockSubTab === "chart" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  สถานะแนวโน้ม: <span className="text-sky-500">{data.technicals.trendLabel}</span> ·
                  RSI(14) ={" "}
                  <span className="tabular-nums font-bold">
                    {data.technicals.rsi14?.toFixed(1) ?? "-"}
                  </span>{" "}
                  · MACD Hist ={" "}
                  <span className="tabular-nums font-bold">
                    {data.technicals.macdHist?.toFixed(3) ?? "-"}
                  </span>
                </div>
              </div>
              <LightweightCandlestickChart
                symbol={data.symbol}
                bars={data.bars}
                entry={tmEntry || data.technicals.price}
                stop={tmStop || data.technicals.standardStop}
                target={tmTarget || data.technicals.shortTarget}
                theme={theme}
                expanded={expandChart}
              />
            </div>
          )}

          {/* SUB-TAB 2: Trade Plan (Board Lot) & Time Machine 10,000 Runs */}
          {stockSubTab === "timemachine" && (
            <div className="space-y-4">
              {/* Position Sizing Calculator */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      คำนวณขนาดไม้ตามกฎ Board Lot (ทีละ 100 หุ้น) & แผนเทรด
                    </h3>
                    <p className="text-xs text-slate-500">
                      ปรับตัวเลขด้านล่างเพื่อคำนวณจำนวนหุ้นและรัน Time Machine 10,000 รอบทันทีแบบเรียลไทม์
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTmEntry(data.technicals.price);
                        setTmStop(data.technicals.standardStop);
                        setTmTarget(data.technicals.shortTarget);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 font-semibold cursor-pointer"
                    >
                      ใช้แนวต้านระยะสั้น ({data.technicals.shortTarget.toFixed(2)} บ.)
                    </button>
                    {data.iaaConsensus.avgTargetPrice &&
                      data.iaaConsensus.avgTargetPrice > data.technicals.price && (
                        <button
                          type="button"
                          onClick={() => {
                            setTmEntry(data.technicals.price);
                            setTmStop(data.technicals.standardStop);
                            setTmTarget(data.iaaConsensus.avgTargetPrice!);
                          }}
                          className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-semibold cursor-pointer"
                        >
                          ใช้เป้า IAA เฉลี่ย ({data.iaaConsensus.avgTargetPrice.toFixed(2)} บ.)
                        </button>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">เงินทุนพอร์ต (บาท)</label>
                    <input
                      type="number"
                      step={10000}
                      min={10000}
                      value={portfolioBaht}
                      onChange={(e) => setPortfolioBaht(Math.max(1000, Number(e.target.value)))}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">ความเสี่ยง (% พอร์ต)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0.5}
                      max={10}
                      value={riskPct}
                      onChange={(e) => setRiskPct(Math.max(0.2, Math.min(20, Number(e.target.value))))}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-sky-500 font-semibold mb-1">ราคาเข้า Entry (บ.)</label>
                    <input
                      type="number"
                      step={0.05}
                      value={tmEntry}
                      onChange={(e) => setTmEntry(Number(e.target.value))}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-sky-500/40 px-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-rose-500 font-semibold mb-1">จุดตัดขาดทุน Stop (บ.)</label>
                    <input
                      type="number"
                      step={0.05}
                      value={tmStop}
                      onChange={(e) => setTmStop(Number(e.target.value))}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-rose-500/40 px-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-rose-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-emerald-500 font-semibold mb-1">เป้าหมายขาย Target (บ.)</label>
                    <input
                      type="number"
                      step={0.05}
                      value={tmTarget}
                      onChange={(e) => setTmTarget(Number(e.target.value))}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-emerald-500/40 px-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {sizing && (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-[11px] text-slate-500">จำนวนหุ้นแนะนำ (Board Lot)</div>
                        <div className="text-lg font-extrabold text-sky-500 tabular-nums mt-0.5">
                          {sizing.shares.toLocaleString()} หุ้น
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {sizing.shares / 100} ล็อต (ทีละ 100 หุ้น)
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-[11px] text-slate-500">มูลค่าเงินลงทุน</div>
                        <div className="text-lg font-extrabold tabular-nums mt-0.5">
                          {sizing.positionValue.toLocaleString()} บ.
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {sizing.portfolioAllocPct}% ของพอร์ต
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-[11px] text-slate-500">อัตราส่วนคุ้มเสี่ยง (R:R)</div>
                        <div className="text-lg font-extrabold text-amber-500 tabular-nums mt-0.5">
                          1 : {sizing.rrRatio.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          เสี่ยง {sizing.riskPerShare} / เป้า +{sizing.rewardPerShare} บ.
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-[11px] text-slate-500">ขาดทุนสูงสุด / กำไรตามเป้า</div>
                        <div className="text-sm font-extrabold tabular-nums mt-1">
                          <span className="text-rose-500">-{sizing.maxLossBaht.toLocaleString()} บ.</span>
                          <span className="mx-1 text-slate-500">/</span>
                          <span className="text-emerald-500">+{sizing.targetGainBaht.toLocaleString()} บ.</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs">
                      <code className="text-slate-700 dark:text-slate-300 break-all">
                        {sizing.copySnippet}
                      </code>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(sizing.copySnippet);
                            showToast("คัดลอกบรรทัดแผนเทรดแล้ว");
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" /> คัดลอก
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            addPaperTrade({
                              symbol: data.symbol,
                              status: "open",
                              entryPrice: tmEntry,
                              shares: Math.max(100, sizing.shares),
                              stopLoss: tmStop,
                              targetPrice: tmTarget,
                              entryDate: new Date().toISOString().slice(0, 10),
                              strategy: `Time Machine (${tmHorizon})`,
                              note: tmResult
                                ? `Win ${tmResult.hitTargetPct}% | EV ${tmResult.expectancyR >= 0 ? "+" : ""}${tmResult.expectancyR}R`
                                : `R:R 1:${sizing.rrRatio}`,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <BookmarkPlus className="h-3.5 w-3.5" />
                          ส่งเข้า Paper Trade
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* TIME MACHINE 10,000-RUN ENGINE */}
              <div className="rounded-2xl border border-sky-500/35 bg-white dark:bg-slate-900/95 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-sky-500 flex items-center gap-1.5">
                      <FlaskConical className="h-4 w-4" />
                      TIME MACHINE · ทดสอบแผน 10,000 รอบก่อนเสียเงินจริง
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      จำลองเส้นทางราคา 10,000 รอบจากพฤติกรรมแท่งเทียน OHLC จริงในอดีตของหุ้น {data.symbol} เอง
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {loadingIntraday && <Loader2 className="h-4 w-4 animate-spin text-sky-400" />}
                    <select
                      value={tmHorizon}
                      onChange={(e) => setTmHorizon(e.target.value as TimeMachineHorizon)}
                      className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold outline-none focus:border-sky-400"
                    >
                      <option value="5d">Swing 5 วันทำการ (เก็งกำไรระยะสั้น)</option>
                      <option value="10d">Swing 10 วันทำการ (มาตรฐานหุ้นไทย)</option>
                      <option value="20d">Swing 20 วันทำการ (ถือรอรอบ 1 เดือน)</option>
                      <option value="1d_5m">Intraday 1 วันทำการ (แท่ง 5 นาที · หุ้นใหญ่)</option>
                    </select>
                  </div>
                </div>

                {!tmResult ? (
                  <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs text-amber-300">
                    กรุณาตั้งค่าให้ <strong>Stop Loss &lt; Entry &lt; Target</strong> เพื่อให้ Time Machine จำลองราคา 10,000 รอบได้ถูกต้อง
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <TimeMachineChart result={tmResult} theme={theme} />
                      </div>

                      {/* Verdict Panel */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/75 p-4 flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            ผลลัพธ์จาก {tmResult.simulations.toLocaleString()} รอบจำลอง
                          </div>
                          <SentimentBadge bias={tmResult.verdictBias} label={tmResult.verdictLabel} />

                          <div className="grid grid-cols-3 gap-2 pt-1">
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 p-2.5 text-center">
                              <div className="text-[10px] text-emerald-500 font-semibold">ถึงเป้าก่อน</div>
                              <div className="text-lg font-extrabold text-emerald-500 tabular-nums">
                                {tmResult.hitTargetPct}%
                              </div>
                            </div>
                            <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 p-2.5 text-center">
                              <div className="text-[10px] text-rose-500 font-semibold">ชน Stop ก่อน</div>
                              <div className="text-lg font-extrabold text-rose-500 tabular-nums">
                                {tmResult.hitStopPct}%
                              </div>
                            </div>
                            <div className="rounded-lg bg-slate-500/10 border border-slate-500/25 p-2.5 text-center">
                              <div className="text-[10px] text-slate-400 font-semibold">ไม่ถึงทั้งคู่</div>
                              <div className="text-lg font-extrabold text-slate-400 tabular-nums">
                                {tmResult.unresolvedPct}%
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
                            <div className="text-[11px] text-slate-500">สรุปความคุ้มค่า (Expectancy / R)</div>
                            <div
                              className={`text-2xl font-extrabold tabular-nums mt-0.5 ${
                                tmResult.expectancyR > 0
                                  ? "text-emerald-500"
                                  : tmResult.expectancyR < 0
                                    ? "text-rose-500"
                                    : "text-amber-500"
                              }`}
                            >
                              {tmResult.expectancyR >= 0 ? "+" : ""}
                              {tmResult.expectancyR.toFixed(2)}R
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              ค่าคาดหวังเฉลี่ยต่อ 1 หน่วยความเสี่ยงใน {tmResult.steps} แท่ง
                            </div>
                          </div>
                        </div>

                        {/* Historical Real-Chart Backcheck */}
                        <div className="rounded-xl bg-sky-500/10 border border-sky-500/25 p-3 text-xs">
                          <div className="font-bold text-sky-600 dark:text-sky-300 mb-1">
                            ย้อนเช็กกราฟจริงในอดีต ({tmResult.historicalBackcheck.totalCases} รอบ)
                          </div>
                          <div className="text-slate-700 dark:text-slate-300 tabular-nums">
                            ถึงเป้า <strong className="text-emerald-500">{tmResult.historicalBackcheck.hitTarget}</strong> ·
                            โดนตัด <strong className="text-rose-500">{tmResult.historicalBackcheck.hitStop}</strong> ·
                            ไม่ถึงทั้งคู่ <strong>{tmResult.historicalBackcheck.unresolved}</strong>{" "}
                            (Win {tmResult.historicalBackcheck.winRatePct}%)
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: Peer Comparison */}
          {stockSubTab === "peers" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void loadPeers(data.symbol, peersInput);
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  หุ้นคู่แข่งในกลุ่มเดียวกัน (คั่นด้วยลูกน้ำ ,):
                </label>
                <input
                  type="text"
                  value={peersInput}
                  onChange={(e) => setPeersInput(e.target.value.toUpperCase())}
                  className="flex-1 min-w-[220px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  disabled={peersLoading}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {peersLoading ? "กำลังโหลด..." : "อัปเดตตารางคู่แข่ง"}
                </button>
              </form>

              {isCardView ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[...peerRows, ...(peerAverage ? [peerAverage] : [])].map((r) => (
                    <div
                      key={r.symbol}
                      onClick={() => !r.symbol.startsWith("📌") && setActiveSymbol(r.symbol)}
                      className={`rounded-xl border p-3 ${
                        r.symbol === data.symbol
                          ? "border-sky-500/60 bg-sky-500/10"
                          : r.symbol.startsWith("📌")
                            ? "border-amber-500/40 bg-amber-500/10"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 cursor-pointer"
                      }`}
                    >
                      <div className="flex justify-between font-bold text-sm">
                        <span>{r.symbol}</span>
                        <span className="tabular-nums">{r.price ? `${r.price.toFixed(2)} บ.` : "-"}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 mt-2 text-[11px] tabular-nums">
                        <div>P/E: {r.pe ?? "-"}</div>
                        <div>P/BV: {r.pbv ?? "-"}</div>
                        <div>ROE: {r.roe ? `${r.roe}%` : "-"}</div>
                        <div>Yld: {r.dividendYield ? `${r.dividendYield}%` : "-"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2 pr-3">หุ้น</th>
                        <th className="py-2 px-3 text-right">ราคา (บ.)</th>
                        <th className="py-2 px-3 text-right">1D %</th>
                        <th className="py-2 px-3 text-right">P/E</th>
                        <th className="py-2 px-3 text-right">P/BV</th>
                        <th className="py-2 px-3 text-right">ROE (%)</th>
                        <th className="py-2 px-3 text-right">Yield (%)</th>
                        <th className="py-2 pl-3 text-right">Mkt Cap (พันลบ.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 tabular-nums">
                      {peerRows.map((r) => (
                        <tr
                          key={r.symbol}
                          onClick={() => setActiveSymbol(r.symbol)}
                          className={`cursor-pointer transition ${
                            r.symbol === data.symbol
                              ? "bg-sky-500/10 font-semibold"
                              : "hover:bg-slate-100 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <td className="py-2.5 pr-3 font-bold text-sky-500">{r.symbol}</td>
                          <td className="py-2.5 px-3 text-right">{r.price?.toFixed(2) ?? "-"}</td>
                          <td
                            className={`py-2.5 px-3 text-right ${
                              (r.changePct ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {r.changePct !== null
                              ? `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`
                              : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right">{r.pe?.toFixed(1) ?? "-"}</td>
                          <td className="py-2.5 px-3 text-right">{r.pbv?.toFixed(2) ?? "-"}</td>
                          <td className="py-2.5 px-3 text-right">{r.roe?.toFixed(1) ?? "-"}</td>
                          <td className="py-2.5 px-3 text-right">
                            {r.dividendYield?.toFixed(2) ?? "-"}
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            {r.marketCapBillion?.toFixed(1) ?? "-"}
                          </td>
                        </tr>
                      ))}
                      {peerAverage && (
                        <tr className="bg-amber-500/10 font-bold text-amber-700 dark:text-amber-300">
                          <td className="py-2.5 pr-3">{peerAverage.symbol}</td>
                          <td className="py-2.5 px-3 text-right">-</td>
                          <td className="py-2.5 px-3 text-right">
                            {peerAverage.changePct !== null ? `${peerAverage.changePct.toFixed(2)}%` : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right">{peerAverage.pe?.toFixed(1) ?? "-"}</td>
                          <td className="py-2.5 px-3 text-right">{peerAverage.pbv?.toFixed(2) ?? "-"}</td>
                          <td className="py-2.5 px-3 text-right">{peerAverage.roe?.toFixed(1) ?? "-"}</td>
                          <td className="py-2.5 px-3 text-right">
                            {peerAverage.dividendYield?.toFixed(2) ?? "-"}
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            {peerAverage.marketCapBillion?.toFixed(1) ?? "-"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 4: Sources, Broker Reports, News & Raw Fact Sheet */}
          {stockSubTab === "sources" && (
            <div className="space-y-4">
              {/* 1. Broker Reports */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">
                    1. บทวิเคราะห์และเป้าหมายรายโบรกเกอร์ ({data.brokerReports.length} รายการ)
                  </h3>
                  <a
                    href={data.iaaConsensus.settradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-500 hover:underline inline-flex items-center gap-1"
                  >
                    เปิด Settrade IAA ต้นฉบับ <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                {data.brokerReports.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    ไม่พบบทวิเคราะห์รายโบรกเกอร์ใหม่ในฟีดข่าว 14 วันล่าสุด (ตรวจสอบเป้า Consensus รวมได้จากการ์ดด้านบนหรืออัปโหลดไฟล์ PDF โบรกฯ เอง)
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <th className="py-2 pr-3">โบรกเกอร์</th>
                          <th className="py-2 px-3">คำแนะนำ</th>
                          <th className="py-2 px-3 text-right">เป้า (บ.)</th>
                          <th className="py-2 px-3 text-right">Upside</th>
                          <th className="py-2 px-3">วันที่</th>
                          <th className="py-2 pl-3">พาดหัว / ต้นฉบับ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {data.brokerReports.map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 pr-3 font-semibold">{r.broker}</td>
                            <td className="py-2 px-3">
                              <SentimentBadge
                                bias={
                                  r.ratingNormalized === "Buy"
                                    ? "positive"
                                    : r.ratingNormalized === "Sell"
                                      ? "negative"
                                      : "neutral"
                                }
                                label={r.rating}
                              />
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums font-bold">
                              {r.targetPrice ? r.targetPrice.toFixed(2) : "-"}
                            </td>
                            <td
                              className={`py-2 px-3 text-right tabular-nums font-bold ${
                                (r.upsidePct ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                              }`}
                            >
                              {r.upsidePct !== null
                                ? `${r.upsidePct >= 0 ? "+" : ""}${r.upsidePct.toFixed(1)}%`
                                : "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-500">{r.reportDate}</td>
                            <td className="py-2 pl-3">
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-500 hover:underline inline-flex items-center gap-1"
                              >
                                {r.headline.slice(0, 75)}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 2. 30D Company News & Public Broker Web */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-2.5">
                  <h3 className="text-sm font-bold">
                    2. ข่าวเฉพาะบริษัทที่คัดกรองแล้ว (รอบ 30 วัน · {data.companyNews.length})
                  </h3>
                  {data.companyNews.length === 0 ? (
                    <p className="text-xs text-slate-500">ไม่พบข่าวเฉพาะบริษัทในรอบ 30 วัน</p>
                  ) : (
                    data.companyNews.map((n) => (
                      <a
                        key={n.id}
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/70 p-3 hover:border-sky-400 transition"
                      >
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {n.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {n.source} · {n.pubDate.slice(0, 10)}
                        </div>
                      </a>
                    ))
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-2.5">
                  <h3 className="text-sm font-bold">
                    3. บทวิเคราะห์หน้าเว็บสาธารณะโบรกเกอร์ ({data.brokerWebResearch.length})
                  </h3>
                  {data.brokerWebResearch.length === 0 ? (
                    <p className="text-xs text-slate-500">ไม่พบบทวิเคราะห์สาธารณะเพิ่มเติม</p>
                  ) : (
                    data.brokerWebResearch.map((n) => (
                      <a
                        key={n.id}
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/70 p-3 hover:border-sky-400 transition"
                      >
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {n.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {n.source} · {n.pubDate.slice(0, 10)}
                        </div>
                      </a>
                    ))
                  )}
                </div>
              </div>

              {/* Transparency Expander: 5-Rule Checklist + Raw Fact Sheet */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFactSheet((v) => !v)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
                >
                  <span className="text-xs font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    ดูเช็กลิสต์ 5 เกณฑ์ และข้อมูลดิบ (Fact Sheet) ที่ส่งเข้า Gemini จริงเพื่อความโปร่งใส
                  </span>
                  {showFactSheet ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showFactSheet && (
                  <div className="px-5 pb-5 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      {data.aiSynthesis.checklist5.map((c) => {
                        const Icon =
                          c.status === "pass"
                            ? CheckCircle2
                            : c.status === "warn"
                              ? AlertTriangle
                              : XCircle;
                        const col =
                          c.status === "pass"
                            ? "text-emerald-500"
                            : c.status === "warn"
                              ? "text-amber-500"
                              : "text-rose-500";
                        return (
                          <div
                            key={c.label}
                            className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3 text-xs"
                          >
                            <div className="flex items-center gap-1.5 font-bold mb-1">
                              <Icon className={`h-3.5 w-3.5 shrink-0 ${col}`} />
                              <span>{c.label}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {c.detail}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <pre className="rounded-xl bg-slate-950 text-slate-200 p-4 text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                      {data.factSheetMarkdown}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 5: Point-in-Time Replay & Leakage Audit */}
          {stockSubTab === "replay" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  จำลองย้อนเวลาด้วยข้อมูลที่มีอยู่จริง ณ วันนั้น (Point-in-Time Replay & Zero-Future-Leakage Audit)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ระบบจะตัดแท่งเทียนและข่าวทั้งหมดที่เกิดขึ้นหลังวันที่เลือกออก 100% เพื่อทดสอบว่า AI วิเคราะห์ได้แม่นยำจริงโดยไม่แอบเห็นอนาคต
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    เลือกวันย้อนหลังที่ต้องการทดสอบ (As-Of Date):
                  </label>
                  <input
                    type="date"
                    value={replayDate}
                    onChange={(e) => setReplayDate(e.target.value)}
                    className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold outline-none focus:border-sky-400"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 pb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runAiLeakage}
                    onChange={(e) => setRunAiLeakage(e.target.checked)}
                    className="accent-sky-500"
                  />
                  ส่งข้อมูลชุดตัดอนาคตให้ Gemini Pro ลองสรุปและสแกนคำรั่วไหล
                </label>
                <button
                  type="button"
                  onClick={() => void handleRunReplay()}
                  disabled={replayLoading}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {replayLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                  รันทดสอบย้อนเวลา
                </button>
              </div>

              {replayError && (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-400">
                  {replayError}
                </div>
              )}

              {replayResult && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                      <div className="text-[11px] text-slate-500">ราคา ณ วันทดสอบ ({replayResult.asOfDate})</div>
                      <div className="text-lg font-extrabold tabular-nums mt-0.5">
                        {replayResult.priceAtAsOf.toFixed(2)} บ.
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                      <div className="text-[11px] text-slate-500">
                        ผลลัพธ์จริง ({replayResult.daysElapsed} วันทำการต่อมา)
                      </div>
                      <div
                        className={`text-lg font-extrabold tabular-nums mt-0.5 ${
                          (replayResult.actualReturnPct ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {replayResult.actualPriceLater !== null
                          ? `${replayResult.actualPriceLater.toFixed(2)} บ. (${(replayResult.actualReturnPct ?? 0) >= 0 ? "+" : ""}${replayResult.actualReturnPct?.toFixed(2)}%)`
                          : "-"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                      <div className="text-[11px] text-slate-500">การตัดข่าวอนาคต</div>
                      <div className="text-xs font-bold mt-1">
                        ใช้ข่าวก่อนวันนั้น {replayResult.cutoffNewsCount} · ตัดทิ้ง {replayResult.excludedFutureNewsCount}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3">
                      <div className="text-[11px] text-slate-500">Zero-Leakage Audit</div>
                      <div className="mt-1">
                        <SentimentBadge
                          bias={replayResult.leakageAudit.passed ? "positive" : "negative"}
                          label={replayResult.leakageAudit.passed ? "ผ่าน (Zero Leakage)" : "พบคำรั่วไหล"}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs">
                    <div className="font-bold text-sky-500">
                      บทวิเคราะห์แบบปิดตา ณ {replayResult.asOfDate} ({replayResult.modelUsed})
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                      {replayResult.aiSummary}
                    </p>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-500">
                      <strong>การเทียบผลจริง:</strong> {replayResult.verdictAccuracy}
                    </div>
                    <div className="text-[11px] text-emerald-500">
                      {replayResult.leakageAudit.explanation}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
