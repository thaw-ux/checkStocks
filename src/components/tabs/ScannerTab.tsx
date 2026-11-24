"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookmarkPlus,
  ExternalLink,
  FileSpreadsheet,
  FlaskConical,
  Newspaper,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { IaaStackedBarChart } from "@/components/charts/AnalyticsCharts";
import { SentimentBadge, SkeletonCard } from "@/components/common/UiPrimitives";
import type {
  BrokerReportItem,
  IaaConsensusSummary,
  NewsPickItem,
  TechnicalSetupItem,
} from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

type ScannerMode = "iaa" | "research" | "technical" | "news";

interface IaaRow extends IaaConsensusSummary {
  changePct?: number;
  pe?: number | null;
  dividendYield?: number | null;
}

export function ScannerTab() {
  const { jumpToStock, jumpToTimeMachine, quickAddPlanToPaperTrade, theme, isCardView } =
    useAppStore();

  const [mode, setMode] = useState<ScannerMode>("iaa");

  // Mode 1: IAA Consensus
  const [iaaItems, setIaaItems] = useState<IaaRow[]>([]);
  const [iaaSectors, setIaaSectors] = useState<string[]>([]);
  const [iaaMeta, setIaaMeta] = useState({ count: 0, elapsedMs: 0 });
  const [iaaLoading, setIaaLoading] = useState(false);
  const [iaaSearch, setIaaSearch] = useState("");
  const [iaaSector, setIaaSector] = useState("ALL");
  const [iaaSort, setIaaSort] = useState<"buyCount" | "upside" | "buyRatio">("buyCount");
  const [iaaMinBrokers, setIaaMinBrokers] = useState(3);
  const [iaaHighCoverage, setIaaHighCoverage] = useState(false);

  // Mode 2: Daily Broker Research
  const [reports, setReports] = useState<BrokerReportItem[]>([]);
  const [brokers, setBrokers] = useState<string[]>([]);
  const [researchMeta, setResearchMeta] = useState({ count: 0, brokerCount: 0, elapsedMs: 0 });
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchSearch, setResearchSearch] = useState("");
  const [selectedBroker, setSelectedBroker] = useState("ALL");
  const [buyOnly, setBuyOnly] = useState(false);

  // Mode 3: SET50 Technical Setup Scanner
  const [setups, setSetups] = useState<TechnicalSetupItem[]>([]);
  const [techMeta, setTechMeta] = useState({ scannedCount: 0, elapsedMs: 0 });
  const [techLoading, setTechLoading] = useState(false);
  const [setupFilter, setSetupFilter] = useState<
    "ALL" | "Breakout + Volume" | "Pullback > EMA200" | "Oversold Rebound"
  >("ALL");

  // Mode 4: Daily News & Broker Pick Scanner
  const [newsPicks, setNewsPicks] = useState<NewsPickItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsElapsed, setNewsElapsed] = useState(0);

  const loadIaa = useCallback(async (refresh = false) => {
    setIaaLoading(true);
    try {
      const res = await fetch(`/api/scanner/iaa${refresh ? "?refresh=1" : ""}`);
      const json = (await res.json()) as {
        items?: IaaRow[];
        sectors?: string[];
        count?: number;
        elapsedMs?: number;
      };
      if (res.ok && json.items) {
        setIaaItems(json.items);
        setIaaSectors(json.sectors ?? []);
        setIaaMeta({ count: json.count ?? json.items.length, elapsedMs: json.elapsedMs ?? 0 });
      }
    } finally {
      setIaaLoading(false);
    }
  }, []);

  const loadResearch = useCallback(async (refresh = false) => {
    setResearchLoading(true);
    try {
      const res = await fetch(`/api/scanner/research${refresh ? "?refresh=1" : ""}`);
      const json = (await res.json()) as {
        reports?: BrokerReportItem[];
        brokers?: string[];
        count?: number;
        brokerCount?: number;
        elapsedMs?: number;
      };
      if (res.ok && json.reports) {
        setReports(json.reports);
        setBrokers(json.brokers ?? []);
        setResearchMeta({
          count: json.count ?? json.reports.length,
          brokerCount: json.brokerCount ?? 0,
          elapsedMs: json.elapsedMs ?? 0,
        });
      }
    } finally {
      setResearchLoading(false);
    }
  }, []);

  const loadTechnical = useCallback(async (refresh = false) => {
    setTechLoading(true);
    try {
      const res = await fetch(`/api/scanner/technical${refresh ? "?refresh=1" : ""}`);
      const json = (await res.json()) as {
        setups?: TechnicalSetupItem[];
        scannedCount?: number;
        elapsedMs?: number;
      };
      if (res.ok && json.setups) {
        setSetups(json.setups);
        setTechMeta({
          scannedCount: json.scannedCount ?? 50,
          elapsedMs: json.elapsedMs ?? 0,
        });
      }
    } finally {
      setTechLoading(false);
    }
  }, []);

  const loadNewsPicks = useCallback(async (refresh = false) => {
    setNewsLoading(true);
    try {
      const res = await fetch(`/api/scanner/news-picks${refresh ? "?refresh=1" : ""}`);
      const json = (await res.json()) as { picks?: NewsPickItem[]; elapsedMs?: number };
      if (res.ok && json.picks) {
        setNewsPicks(json.picks);
        setNewsElapsed(json.elapsedMs ?? 0);
      }
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "iaa" && iaaItems.length === 0) void loadIaa(false);
    if (mode === "research" && reports.length === 0) void loadResearch(false);
    if (mode === "technical" && setups.length === 0) void loadTechnical(false);
    if (mode === "news" && newsPicks.length === 0) void loadNewsPicks(false);
  }, [
    mode,
    iaaItems.length,
    reports.length,
    setups.length,
    newsPicks.length,
    loadIaa,
    loadResearch,
    loadTechnical,
    loadNewsPicks,
  ]);

  const filteredIaa = useMemo(() => {
    const minCov = iaaHighCoverage ? Math.max(5, iaaMinBrokers) : iaaMinBrokers;
    return iaaItems
      .filter((item) => {
        if (item.totalBrokers < minCov) return false;
        if (iaaSector !== "ALL" && item.sector !== iaaSector) return false;
        if (iaaSearch.trim()) {
          const q = iaaSearch.trim().toUpperCase();
          if (!item.symbol.includes(q) && !item.companyName.toUpperCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (iaaSort === "upside") return (b.upsidePct ?? -999) - (a.upsidePct ?? -999);
        if (iaaSort === "buyRatio") return (b.buyRatioPct ?? 0) - (a.buyRatioPct ?? 0);
        return b.buyCount - a.buyCount || (b.upsidePct ?? -999) - (a.upsidePct ?? -999);
      });
  }, [iaaItems, iaaMinBrokers, iaaHighCoverage, iaaSector, iaaSearch, iaaSort]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (buyOnly && r.ratingNormalized !== "Buy") return false;
      if (selectedBroker !== "ALL" && r.broker !== selectedBroker) return false;
      if (researchSearch.trim()) {
        const q = researchSearch.trim().toUpperCase();
        if (!r.symbol.includes(q) && !r.headline.toUpperCase().includes(q)) return false;
      }
      return true;
    });
  }, [reports, buyOnly, selectedBroker, researchSearch]);

  const filteredSetups = useMemo(() => {
    if (setupFilter === "ALL") return setups;
    return setups.filter((s) => s.setupType === setupFilter);
  }, [setups, setupFilter]);

  const modeTabs: { id: ScannerMode; label: string; icon: React.ReactNode }[] = [
    { id: "iaa", label: "มติพื้นฐาน IAA ทั้งตลาด", icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
    { id: "research", label: "บทวิเคราะห์ออกใหม่รายวัน", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { id: "technical", label: "สแกนกราฟ SET50 (Breakout/Pullback)", icon: <Activity className="h-3.5 w-3.5" /> },
    { id: "news", label: "สแกนข่าวโพยโบรกฯ รายวัน", icon: <Newspaper className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* 4-Mode Switcher */}
      <div className="flex flex-wrap gap-2">
        {modeTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
              mode === t.id
                ? "bg-sky-500 text-slate-950 shadow-sm"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-sky-400"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* MODE 1: FULL-MARKET IAA CONSENSUS */}
      {mode === "iaa" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  ตารางจัดอันดับ IAA / Analyst Consensus ทั้งตลาด SET ({iaaMeta.count} หุ้น ·{" "}
                  {(iaaMeta.elapsedMs / 1000).toFixed(2)} วินาที)
                </h2>
                <p className="text-xs text-slate-500">
                  เปรียบเทียบราคาเป้าหมาย 12 เดือน Upside % และสัดส่วนโบรกเกอร์แนะนำซื้อในตารางเดียว
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadIaa(true)}
                disabled={iaaLoading}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-sky-400 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${iaaLoading ? "animate-spin" : ""}`} />
                อัปเดตข้อมูล
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={iaaSearch}
                  onChange={(e) => setIaaSearch(e.target.value)}
                  placeholder="ค้นหาชื่อหุ้น..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 outline-none focus:border-sky-400"
                />
              </div>

              <select
                value={iaaSort}
                onChange={(e) => setIaaSort(e.target.value as typeof iaaSort)}
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none"
              >
                <option value="buyCount">เรียง: โบรกฯ แนะนำซื้อสูงสุด</option>
                <option value="upside">เรียง: Upside % สูงสุด</option>
                <option value="buyRatio">เรียง: สัดส่วนแนะซื้อ % สูงสุด</option>
              </select>

              <select
                value={iaaSector}
                onChange={(e) => setIaaSector(e.target.value)}
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none"
              >
                <option value="ALL">ทุกหมวดธุรกิจ ({iaaSectors.length})</option>
                {iaaSectors.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-1.5">
                <span className="text-slate-500 whitespace-nowrap">โบรกฯ ≥ {iaaMinBrokers}</span>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={iaaMinBrokers}
                  onChange={(e) => setIaaMinBrokers(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              <label className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={iaaHighCoverage}
                  onChange={(e) => setIaaHighCoverage(e.target.checked)}
                  className="accent-sky-500"
                />
                <span>Coverage ≥ 5 โบรกฯ</span>
              </label>
            </div>

            {/* Quick-jump Top 12 */}
            {filteredIaa.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {filteredIaa.slice(0, 12).map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => jumpToStock(item.symbol)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-sky-500 hover:text-slate-950 transition cursor-pointer tabular-nums"
                  >
                    {item.symbol}{" "}
                    <span className="text-[10px] opacity-80">
                      ({item.upsidePct !== null ? `${item.upsidePct >= 0 ? "+" : ""}${item.upsidePct}%` : "-"})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {iaaLoading && iaaItems.length === 0 ? (
              <SkeletonCard lines={6} />
            ) : isCardView ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredIaa.slice(0, 50).map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => jumpToStock(item.symbol)}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 cursor-pointer hover:border-sky-400"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-sky-500">{item.symbol}</span>
                      <span
                        className={`text-xs font-extrabold tabular-nums ${
                          (item.upsidePct ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        Upside {item.upsidePct !== null ? `${item.upsidePct >= 0 ? "+" : ""}${item.upsidePct}%` : "-"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{item.sector}</div>
                    <div className="flex justify-between text-xs mt-2 tabular-nums">
                      <span>ราคา {item.currentPrice.toFixed(2)} บ.</span>
                      <span>เป้าเฉลี่ย {item.avgTargetPrice?.toFixed(2) ?? "-"} บ.</span>
                      <span className="text-emerald-500 font-semibold">
                        ซื้อ {item.buyCount}/{item.totalBrokers} ({item.buyRatioPct ?? 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">หุ้น</th>
                      <th className="py-2 px-3">หมวดธุรกิจ</th>
                      <th className="py-2 px-3 text-right">ราคาล่าสุด</th>
                      <th className="py-2 px-3 text-right">เป้าเฉลี่ย</th>
                      <th className="py-2 px-3 text-right">Upside</th>
                      <th className="py-2 px-3 text-right">สัดส่วนแนะซื้อ</th>
                      <th className="py-2 pl-3 text-right">P/E · Yield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 tabular-nums">
                    {filteredIaa.slice(0, 80).map((item) => (
                      <tr
                        key={item.symbol}
                        onClick={() => jumpToStock(item.symbol)}
                        className="hover:bg-sky-500/5 cursor-pointer transition"
                      >
                        <td className="py-2.5 pr-3 font-bold text-sky-500">{item.symbol}</td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          {item.sector}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold">
                          {item.currentPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-500">
                          {item.avgTargetPrice?.toFixed(2) ?? "-"}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-extrabold ${
                            (item.upsidePct ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {item.upsidePct !== null
                            ? `${item.upsidePct >= 0 ? "+" : ""}${item.upsidePct.toFixed(1)}%`
                            : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-500">
                          {item.buyCount}/{item.totalBrokers} ({item.buyRatioPct ?? 0}%)
                        </td>
                        <td className="py-2.5 pl-3 text-right text-slate-500">
                          {item.pe ? `${item.pe.toFixed(1)}x` : "-"} ·{" "}
                          {item.dividendYield ? `${item.dividendYield.toFixed(1)}%` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <IaaStackedBarChart
            items={filteredIaa}
            theme={theme}
            onSelectSymbol={(sym) => jumpToStock(sym)}
          />
        </div>
      )}

      {/* MODE 2: DAILY NEW BROKER RESEARCH (20+ BROKERS) */}
      {mode === "research" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                บทวิเคราะห์และราคาเป้าหมายออกใหม่รายวัน ({researchMeta.count} ฉบับ ·{" "}
                {researchMeta.brokerCount} โบรกเกอร์/แหล่งวิจัย)
              </h2>
              <p className="text-xs text-slate-500">
                รวมบทวิเคราะห์และโพยเป้าจากโบรกเกอร์ชั้นนำไทยในตารางเดียว รู้ทันทีค่ายไหนเชียร์ตัวไหน Upside กี่ %
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadResearch(true)}
              disabled={researchLoading}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-sky-400 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${researchLoading ? "animate-spin" : ""}`} />
              อัปเดตฟีด
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={researchSearch}
                onChange={(e) => setResearchSearch(e.target.value)}
                placeholder="ค้นหาชื่อหุ้นหรือพาดหัว..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 outline-none focus:border-sky-400"
              />
            </div>

            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
              className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none"
            >
              <option value="ALL">ทุกโบรกเกอร์ ({brokers.length})</option>
              {brokers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={buyOnly}
                onChange={(e) => setBuyOnly(e.target.checked)}
                className="accent-emerald-500"
              />
              <span>เฉพาะแนะนำ &quot;ซื้อ / Outperform&quot;</span>
            </label>
          </div>

          {researchLoading && reports.length === 0 ? (
            <SkeletonCard lines={6} />
          ) : isCardView ? (
            <div className="space-y-2.5">
              {filteredReports.slice(0, 40).map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => jumpToStock(r.symbol)}
                      className="font-extrabold text-sm text-sky-500 cursor-pointer"
                    >
                      {r.symbol}
                    </button>
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
                  </div>
                  <div className="text-[11px] font-semibold text-amber-500">
                    {r.broker} · {r.reportDate}
                  </div>
                  <div className="flex gap-3 text-xs tabular-nums">
                    <span>เป้า: {r.targetPrice ? `${r.targetPrice.toFixed(2)} บ.` : "-"}</span>
                    <span>ล่าสุด: {r.currentPrice ? `${r.currentPrice.toFixed(2)} บ.` : "-"}</span>
                    {r.upsidePct !== null && (
                      <span
                        className={
                          r.upsidePct >= 0
                            ? "text-emerald-500 font-bold"
                            : "text-rose-500 font-bold"
                        }
                      >
                        Upside {r.upsidePct >= 0 ? "+" : ""}
                        {r.upsidePct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-600 dark:text-slate-300 hover:text-sky-400 inline-flex items-center gap-1"
                  >
                    {r.headline} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">หุ้น</th>
                    <th className="py-2 px-3">โบรกเกอร์</th>
                    <th className="py-2 px-3">คำแนะนำ</th>
                    <th className="py-2 px-3 text-right">เป้า (บ.)</th>
                    <th className="py-2 px-3 text-right">ล่าสุด</th>
                    <th className="py-2 px-3 text-right">Upside</th>
                    <th className="py-2 px-3">วันที่</th>
                    <th className="py-2 pl-3">พาดหัวข่าว/ต้นฉบับ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {filteredReports.slice(0, 70).map((r) => (
                    <tr key={r.id} className="hover:bg-sky-500/5">
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() => jumpToStock(r.symbol)}
                          className="font-bold text-sky-500 hover:underline cursor-pointer"
                        >
                          {r.symbol}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">{r.broker}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
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
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-amber-500">
                        {r.targetPrice ? r.targetPrice.toFixed(2) : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {r.currentPrice ? r.currentPrice.toFixed(2) : "-"}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                          (r.upsidePct ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {r.upsidePct !== null
                          ? `${r.upsidePct >= 0 ? "+" : ""}${r.upsidePct.toFixed(1)}%`
                          : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {r.reportDate}
                      </td>
                      <td className="py-2.5 pl-3">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-700 dark:text-slate-300 hover:text-sky-400 inline-flex items-center gap-1"
                        >
                          <span className="line-clamp-1">{r.headline}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODE 3: SET50 TECHNICAL SETUP SCANNER */}
      {mode === "technical" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                SET50 TECHNICAL SETUP SCANNER · หุ้นใหญ่สภาพคล่องสูงเข้าเกณฑ์พร้อมแผน Entry / Stop / Target
              </h2>
              <p className="text-xs text-slate-500">
                สแกนหุ้น SET50 จำนวน {techMeta.scannedCount} ตัว พบ {setups.length} Setup (
                {(techMeta.elapsedMs / 1000).toFixed(2)} วินาที) · กดส่งเข้า Time Machine 10,000 รอบได้ทันที
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadTechnical(true)}
              disabled={techLoading}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-sky-400 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${techLoading ? "animate-spin" : ""}`} />
              สแกนสดใหม่
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["ALL", `ทั้งหมด (${setups.length})`],
                [
                  "Breakout + Volume",
                  `Breakout + Volume เข้า (${setups.filter((s) => s.setupType === "Breakout + Volume").length})`,
                ],
                [
                  "Pullback > EMA200",
                  `Pullback บนขาขึ้น >EMA200 (${setups.filter((s) => s.setupType === "Pullback > EMA200").length})`,
                ],
                [
                  "Oversold Rebound",
                  `Oversold ลุ้นรีบาวด์ (${setups.filter((s) => s.setupType === "Oversold Rebound").length})`,
                ],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setSetupFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  setupFilter === val
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {techLoading && setups.length === 0 ? (
            <SkeletonCard lines={6} />
          ) : filteredSetups.length === 0 ? (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-6 text-center text-xs text-slate-500">
              ยังไม่พบหุ้น SET50 ที่เข้าเงื่อนไขรูปแบบนี้ในรอบล่าสุด
            </div>
          ) : isCardView ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredSetups.map((s) => (
                <div
                  key={`${s.symbol}-${s.setupType}`}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => jumpToStock(s.symbol)}
                      className="text-base font-extrabold text-sky-500 cursor-pointer"
                    >
                      {s.symbol}
                    </button>
                    <SentimentBadge
                      bias={
                        s.setupType === "Breakout + Volume"
                          ? "positive"
                          : s.setupType === "Pullback > EMA200"
                            ? "neutral"
                            : "negative"
                      }
                      label={s.setupType}
                    />
                  </div>
                  <div className="text-xs font-semibold tabular-nums">
                    ราคา {s.price.toFixed(2)} บ. ({s.changePct1d >= 0 ? "+" : ""}
                    {s.changePct1d}%) · R:R 1:{s.rrRatio}
                  </div>
                  <div className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
                    Entry <strong>{s.entry.toFixed(2)}</strong> / Stop{" "}
                    <strong className="text-rose-500">{s.stop.toFixed(2)}</strong> / Target{" "}
                    <strong className="text-emerald-500">{s.target.toFixed(2)}</strong>
                  </div>
                  <p className="text-[11px] text-slate-500">{s.reasonTh}</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        jumpToTimeMachine({
                          symbol: s.symbol,
                          entry: s.entry,
                          stop: s.stop,
                          target: s.target,
                          sourceLabel: s.setupType,
                        })
                      }
                      className="flex-1 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FlaskConical className="h-3.5 w-3.5" /> Time Machine
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        quickAddPlanToPaperTrade({
                          symbol: s.symbol,
                          action: s.setupType,
                          entry: s.entry,
                          stop: s.stop,
                          target: s.target,
                          rrRatio: s.rrRatio,
                          note: s.reasonTh,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-500 font-bold text-xs cursor-pointer"
                    >
                      + Paper
                    </button>
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
                    <th className="py-2 px-3">รูปแบบ Setup</th>
                    <th className="py-2 px-3 text-right">ราคาล่าสุด</th>
                    <th className="py-2 px-3 text-right">1D %</th>
                    <th className="py-2 px-3">Entry / Stop / Target</th>
                    <th className="py-2 px-3 text-right">R:R</th>
                    <th className="py-2 px-3">เหตุผลกราฟ</th>
                    <th className="py-2 pl-3 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {filteredSetups.map((s) => (
                    <tr key={`${s.symbol}-${s.setupType}`} className="hover:bg-sky-500/5">
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() => jumpToStock(s.symbol)}
                          className="font-extrabold text-sky-500 hover:underline cursor-pointer"
                        >
                          {s.symbol}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <SentimentBadge
                          bias={
                            s.setupType === "Breakout + Volume"
                              ? "positive"
                              : s.setupType === "Pullback > EMA200"
                                ? "neutral"
                                : "negative"
                          }
                          label={s.setupType}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold">
                        {s.price.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                          s.changePct1d >= 0 ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {s.changePct1d >= 0 ? "+" : ""}
                        {s.changePct1d.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 tabular-nums whitespace-nowrap">
                        <span className="font-semibold">{s.entry.toFixed(2)}</span> /{" "}
                        <span className="text-rose-500 font-semibold">{s.stop.toFixed(2)}</span> /{" "}
                        <span className="text-emerald-500 font-semibold">
                          {s.target.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-amber-500">
                        1:{s.rrRatio.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-xs">
                        {s.reasonTh}
                      </td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              jumpToTimeMachine({
                                symbol: s.symbol,
                                entry: s.entry,
                                stop: s.stop,
                                target: s.target,
                                sourceLabel: s.setupType,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <FlaskConical className="h-3 w-3" /> Time Machine
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              quickAddPlanToPaperTrade({
                                symbol: s.symbol,
                                action: s.setupType,
                                entry: s.entry,
                                stop: s.stop,
                                target: s.target,
                                rrRatio: s.rrRatio,
                                note: s.reasonTh,
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 font-bold inline-flex items-center gap-1 cursor-pointer"
                            title="บันทึกเข้า Paper Trade"
                          >
                            <BookmarkPlus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODE 4: DAILY NEWS & BROKER PICKS SCANNER */}
      {mode === "news" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                สแกนข่าวบทวิเคราะห์และโพยหุ้นเด่นรายวัน ({newsPicks.length} หุ้น ·{" "}
                {(newsElapsed / 1000).toFixed(2)} วินาที)
              </h2>
              <p className="text-xs text-slate-500">
                จัดอันดับหุ้น SET/mai ที่ถูกโบรกเกอร์และสำนักข่าวหุ้นกล่าวถึงมากที่สุดในรอบล่าสุด
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadNewsPicks(true)}
              disabled={newsLoading}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-sky-400 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${newsLoading ? "animate-spin" : ""}`} />
              สแกนข่าวใหม่
            </button>
          </div>

          {newsLoading && newsPicks.length === 0 ? (
            <SkeletonCard lines={6} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 pr-3">อันดับ</th>
                    <th className="py-2 px-3">หุ้น</th>
                    <th className="py-2 px-3">หมวดธุรกิจ</th>
                    <th className="py-2 px-3 text-center">จำนวนแหล่งข่าว</th>
                    <th className="py-2 px-3">โทนข่าว</th>
                    <th className="py-2 pl-3">โบรกเกอร์ / พาดหัวล่าสุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {newsPicks.map((p) => (
                    <tr key={p.symbol} className="hover:bg-sky-500/5">
                      <td className="py-2.5 pr-3 font-bold text-slate-400 tabular-nums">
                        #{p.rank}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => jumpToStock(p.symbol)}
                          className="font-extrabold text-sky-500 hover:underline cursor-pointer"
                        >
                          {p.symbol}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{p.sector}</td>
                      <td className="py-2.5 px-3 text-center font-bold tabular-nums">
                        {p.mentionCount} ข่าว ({p.sources.length} แหล่ง)
                      </td>
                      <td className="py-2.5 px-3">
                        <SentimentBadge bias={p.sentiment} />
                      </td>
                      <td className="py-2.5 pl-3">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {p.sources.slice(0, 4).map((src) => (
                            <span
                              key={src}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]"
                            >
                              {src}
                            </span>
                          ))}
                        </div>
                        {p.headlines[0] && (
                          <a
                            href={p.headlines[0].link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-slate-600 dark:text-slate-300 hover:text-sky-400 inline-flex items-center gap-1"
                          >
                            {p.headlines[0].title.slice(0, 80)}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
