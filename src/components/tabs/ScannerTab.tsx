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
import { MarketSwitcher } from "@/components/common/MarketSwitcher";
import { SentimentBadge, SkeletonCard } from "@/components/common/UiPrimitives";
import { formatPrice, MARKET_CONFIGS } from "@/lib/markets";
import type {
  BrokerReportItem,
  IaaConsensusSummary,
  MarketId,
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
  const {
    activeMarket,
    setActiveMarket,
    jumpToStock,
    jumpToTimeMachine,
    quickAddPlanToPaperTrade,
    theme,
    isCardView,
  } = useAppStore();

  const [mode, setMode] = useState<ScannerMode>("iaa");

  // Mode 1: Analyst Consensus
  const [iaaItems, setIaaItems] = useState<IaaRow[]>([]);
  const [iaaSectors, setIaaSectors] = useState<string[]>([]);
  const [iaaMeta, setIaaMeta] = useState({ count: 0, elapsedMs: 0 });
  const [iaaLoading, setIaaLoading] = useState(false);
  const [iaaSearch, setIaaSearch] = useState("");
  const [iaaSector, setIaaSector] = useState("ALL");
  const [iaaSort, setIaaSort] = useState<"buyCount" | "upside" | "buyRatio">("buyCount");
  const [iaaMinBrokers, setIaaMinBrokers] = useState(3);
  const [iaaHighCoverage, setIaaHighCoverage] = useState(false);

  // Mode 2: Daily Broker / Wall Street Research
  const [reports, setReports] = useState<BrokerReportItem[]>([]);
  const [brokers, setBrokers] = useState<string[]>([]);
  const [researchMeta, setResearchMeta] = useState({ count: 0, brokerCount: 0, elapsedMs: 0 });
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchSearch, setResearchSearch] = useState("");
  const [selectedBroker, setSelectedBroker] = useState("ALL");
  const [buyOnly, setBuyOnly] = useState(false);

  // Mode 3: Technical & S/R Setup Scanner
  const [setups, setSetups] = useState<TechnicalSetupItem[]>([]);
  const [techMeta, setTechMeta] = useState({ scannedCount: 0, elapsedMs: 0, universe: "" });
  const [techLoading, setTechLoading] = useState(false);
  const [proximityPct, setProximityPct] = useState(3);
  const [setupFilter, setSetupFilter] = useState<
    | "ALL"
    | "Breakout + Volume"
    | "Pullback > EMA200"
    | "Near Support (S1)"
    | "Near Resistance (R1)"
    | "Oversold Rebound"
  >("ALL");

  // Mode 4: Daily News & Research Mentions
  const [newsPicks, setNewsPicks] = useState<NewsPickItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsElapsed, setNewsElapsed] = useState(0);

  const loadIaa = useCallback(async (mkt: MarketId, refresh = false) => {
    setIaaLoading(true);
    try {
      const res = await fetch(`/api/scanner/iaa?market=${mkt}${refresh ? "&refresh=1" : ""}`);
      const json = (await res.json()) as {
        items?: IaaRow[];
        sectors?: string[];
        count?: number;
        elapsedMs?: number;
      };
      if (res.ok && json.items) {
        setIaaItems(json.items);
        setIaaSectors(json.sectors ?? []);
        setIaaSector("ALL");
        setIaaMeta({ count: json.count ?? json.items.length, elapsedMs: json.elapsedMs ?? 0 });
      }
    } finally {
      setIaaLoading(false);
    }
  }, []);

  const loadResearch = useCallback(async (mkt: MarketId, refresh = false) => {
    setResearchLoading(true);
    try {
      const res = await fetch(`/api/scanner/research?market=${mkt}${refresh ? "&refresh=1" : ""}`);
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
        setSelectedBroker("ALL");
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

  const loadTechnical = useCallback(async (mkt: MarketId, prox: number, refresh = false) => {
    setTechLoading(true);
    try {
      const res = await fetch(
        `/api/scanner/technical?market=${mkt}&proximity=${prox}${refresh ? "&refresh=1" : ""}`
      );
      const json = (await res.json()) as {
        setups?: TechnicalSetupItem[];
        scannedCount?: number;
        elapsedMs?: number;
        universe?: string;
      };
      if (res.ok && json.setups) {
        setSetups(json.setups);
        setTechMeta({
          scannedCount: json.scannedCount ?? 0,
          elapsedMs: json.elapsedMs ?? 0,
          universe: json.universe ?? MARKET_CONFIGS[mkt].label,
        });
      }
    } finally {
      setTechLoading(false);
    }
  }, []);

  const loadNewsPicks = useCallback(async (mkt: MarketId, refresh = false) => {
    setNewsLoading(true);
    try {
      const res = await fetch(`/api/scanner/news-picks?market=${mkt}${refresh ? "&refresh=1" : ""}`);
      const json = (await res.json()) as { picks?: NewsPickItem[]; elapsedMs?: number };
      if (res.ok && json.picks) {
        setNewsPicks(json.picks);
        setNewsElapsed(json.elapsedMs ?? 0);
      }
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // Reload active scanner mode whenever mode, activeMarket, or proximity changes
  useEffect(() => {
    if (mode === "iaa") void loadIaa(activeMarket, false);
    if (mode === "research") void loadResearch(activeMarket, false);
    if (mode === "technical") void loadTechnical(activeMarket, proximityPct, false);
    if (mode === "news") void loadNewsPicks(activeMarket, false);
  }, [mode, activeMarket, proximityPct, loadIaa, loadResearch, loadTechnical, loadNewsPicks]);

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

  const mktCfg = MARKET_CONFIGS[activeMarket];

  const modeTabs: { id: ScannerMode; label: string; icon: React.ReactNode }[] = [
    {
      id: "iaa",
      label: "Analyst Consensus ทั้งตลาด",
      icon: <FileSpreadsheet className="h-3.5 w-3.5" />,
    },
    {
      id: "research",
      label: "Wall Street / โบรกฯ รายวัน",
      icon: <TrendingUp className="h-3.5 w-3.5" />,
    },
    {
      id: "technical",
      label: `สแกนกราฟ & แนวรับ-ต้าน ${mktCfg.shortLabel}`,
      icon: <Activity className="h-3.5 w-3.5" />,
    },
    {
      id: "news",
      label: "สแกนข่าวหุ้นเด่นรายวัน",
      icon: <Newspaper className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Market Switcher + 4-Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MarketSwitcher value={activeMarket} onChange={setActiveMarket} />
      </div>

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

      {/* MODE 1: CONSENSUS */}
      {mode === "iaa" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {mktCfg.flag} ตารางจัดอันดับ Analyst Consensus — {mktCfg.label} ({iaaMeta.count} หุ้น ·{" "}
                  {(iaaMeta.elapsedMs / 1000).toFixed(2)} วินาที)
                </h2>
                <p className="text-xs text-slate-500">
                  เปรียบเทียบราคาเป้าหมาย 12 เดือน Upside % และสัดส่วนนักวิเคราะห์แนะนำซื้อในตารางเดียว
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadIaa(activeMarket, true)}
                disabled={iaaLoading}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-sky-400 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${iaaLoading ? "animate-spin" : ""}`} />
                อัปเดตข้อมูล
              </button>
            </div>

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
                <option value="buyCount">เรียง: แนะนำซื้อสูงสุด</option>
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
                <span className="text-slate-500 whitespace-nowrap">นักวิเคราะห์ ≥ {iaaMinBrokers}</span>
                <input
                  type="range"
                  min={1}
                  max={25}
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
                <span>Coverage ≥ 5 ราย</span>
              </label>
            </div>

            {filteredIaa.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {filteredIaa.slice(0, 12).map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => jumpToStock(item.symbol, "chart", activeMarket)}
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

            {iaaLoading ? (
              <SkeletonCard lines={6} />
            ) : isCardView ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredIaa.slice(0, 50).map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => jumpToStock(item.symbol, "chart", activeMarket)}
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
                    <div className="text-[11px] text-slate-500 truncate">{item.companyName}</div>
                    <div className="flex justify-between text-xs mt-2 tabular-nums">
                      <span>{formatPrice(item.currentPrice, item.currency)}</span>
                      <span>เป้า {formatPrice(item.avgTargetPrice, item.currency)}</span>
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
                      <th className="py-2 px-3">บริษัท / หมวดธุรกิจ</th>
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
                        onClick={() => jumpToStock(item.symbol, "chart", activeMarket)}
                        className="hover:bg-sky-500/5 cursor-pointer transition"
                      >
                        <td className="py-2.5 pr-3 font-bold text-sky-500 whitespace-nowrap">
                          {item.symbol}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                            {item.companyName}
                          </div>
                          <div className="text-[10px]">{item.sector}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                          {formatPrice(item.currentPrice, item.currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-500 whitespace-nowrap">
                          {formatPrice(item.avgTargetPrice, item.currency)}
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
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-500 whitespace-nowrap">
                          {item.buyCount}/{item.totalBrokers} ({item.buyRatioPct ?? 0}%)
                        </td>
                        <td className="py-2.5 pl-3 text-right text-slate-500 whitespace-nowrap">
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
            onSelectSymbol={(sym) => jumpToStock(sym, "chart", activeMarket)}
          />
        </div>
      )}

      {/* MODE 2: DAILY BROKER / WALL STREET RESEARCH */}
      {mode === "research" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {mktCfg.flag} บทวิเคราะห์และราคาเป้าหมายออกใหม่ — {mktCfg.label} ({researchMeta.count} รายการ ·{" "}
                {researchMeta.brokerCount} สถาบัน/โบรกเกอร์)
              </h2>
              <p className="text-xs text-slate-500">
                รวมบทวิเคราะห์และปรับเป้าจากโบรกเกอร์ชั้นนำ รู้ทันทีค่ายไหนเชียร์ตัวไหน Upside กี่ %
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadResearch(activeMarket, true)}
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
              <span>เฉพาะแนะนำ &quot;ซื้อ / Outperform / Overweight&quot;</span>
            </label>
          </div>

          {researchLoading ? (
            <SkeletonCard lines={6} />
          ) : (
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">หุ้น</th>
                    <th className="py-2 px-3">โบรกเกอร์</th>
                    <th className="py-2 px-3">คำแนะนำ</th>
                    <th className="py-2 px-3 text-right">เป้า</th>
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
                          onClick={() => jumpToStock(r.symbol, "chart", activeMarket)}
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
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-amber-500 whitespace-nowrap">
                        {formatPrice(r.targetPrice, r.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        {formatPrice(r.currentPrice, r.currency)}
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

      {/* MODE 3: TECHNICAL & S/R SETUP SCANNER */}
      {mode === "technical" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {mktCfg.flag} TECHNICAL & S/R SETUP SCANNER — {mktCfg.label}
              </h2>
              <p className="text-xs text-slate-500">
                สแกนหุ้น {techMeta.scannedCount} ตัว พบ {setups.length} Setup (
                {(techMeta.elapsedMs / 1000).toFixed(2)} วินาที) · แสดงแนวรับ S1 / แนวต้าน R1 + ระยะห่าง %
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs">
                <span className="text-slate-500 whitespace-nowrap">
                  ระยะชิดแนวรับ/ต้าน ≤ <strong>{proximityPct}%</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={0.5}
                  value={proximityPct}
                  onChange={(e) => setProximityPct(Number(e.target.value))}
                  className="w-24 accent-sky-500"
                />
              </div>
              <button
                type="button"
                onClick={() => void loadTechnical(activeMarket, proximityPct, true)}
                disabled={techLoading}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-sky-400 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${techLoading ? "animate-spin" : ""}`} />
                สแกนสดใหม่
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["ALL", `ทั้งหมด (${setups.length})`],
                [
                  "Breakout + Volume",
                  `Breakout + Vol (${setups.filter((s) => s.setupType === "Breakout + Volume").length})`,
                ],
                [
                  "Pullback > EMA200",
                  `Pullback >EMA200 (${setups.filter((s) => s.setupType === "Pullback > EMA200").length})`,
                ],
                [
                  "Near Support (S1)",
                  `🎯 ชิดแนวรับ S1 ≤${proximityPct}% (${setups.filter((s) => s.setupType === "Near Support (S1)").length})`,
                ],
                [
                  "Near Resistance (R1)",
                  `🚀 จ่อเบรกต้าน R1 ≤${proximityPct}% (${setups.filter((s) => s.setupType === "Near Resistance (R1)").length})`,
                ],
                [
                  "Oversold Rebound",
                  `Oversold (${setups.filter((s) => s.setupType === "Oversold Rebound").length})`,
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

          {techLoading ? (
            <SkeletonCard lines={6} />
          ) : filteredSetups.length === 0 ? (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-6 text-center text-xs text-slate-500">
              ยังไม่พบหุ้นใน {mktCfg.label} ที่เข้าเงื่อนไขรูปแบบนี้ (ลองเพิ่มสไลเดอร์ระยะ % ห่างแนวรับ-ต้านดูได้ครับ)
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 pr-3">หุ้น</th>
                    <th className="py-2 px-3">รูปแบบ Setup</th>
                    <th className="py-2 px-3 text-right">ราคาล่าสุด</th>
                    <th className="py-2 px-3 text-right">แนวรับ S1 (% ห่าง)</th>
                    <th className="py-2 px-3 text-right">แนวต้าน R1 (% ห่าง)</th>
                    <th className="py-2 px-3">Entry / Stop / Target</th>
                    <th className="py-2 px-3 text-right">R:R</th>
                    <th className="py-2 pl-3 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {filteredSetups.map((s) => (
                    <tr key={`${s.symbol}-${s.setupType}`} className="hover:bg-sky-500/5">
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() => jumpToStock(s.symbol, "chart", activeMarket)}
                          className="font-extrabold text-sky-500 hover:underline cursor-pointer"
                        >
                          {s.symbol}
                        </button>
                        <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                          {s.companyName}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <SentimentBadge
                          bias={
                            s.setupType === "Breakout + Volume" || s.setupType === "Near Support (S1)"
                              ? "positive"
                              : s.setupType === "Oversold Rebound"
                                ? "negative"
                                : "neutral"
                          }
                          label={s.setupType}
                        />
                        <div className="text-[10px] text-slate-500 mt-0.5 max-w-[190px] truncate" title={s.reasonTh}>
                          {s.reasonTh}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        <div className="font-bold">{formatPrice(s.price, s.currency)}</div>
                        <div
                          className={`text-[10px] font-semibold ${
                            s.changePct1d >= 0 ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {s.changePct1d >= 0 ? "+" : ""}
                          {s.changePct1d.toFixed(2)}%
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        <div className="font-bold text-emerald-500">
                          {formatPrice(s.s1, s.currency)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          -{s.s1DistPct.toFixed(1)}% · {"★".repeat(Math.min(5, s.s1Strength))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        <div className="font-bold text-rose-500">
                          {formatPrice(s.r1, s.currency)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          +{s.r1DistPct.toFixed(1)}% · {"★".repeat(Math.min(5, s.r1Strength))}
                        </div>
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
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              jumpToTimeMachine({
                                symbol: s.symbol,
                                market: activeMarket,
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
                                market: activeMarket,
                                currency: s.currency,
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

      {/* MODE 4: NEWS PICKS */}
      {mode === "news" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {mktCfg.flag} สแกนข่าวบทวิเคราะห์และหุ้นเด่นรายวัน — {mktCfg.label} ({newsPicks.length} หุ้น ·{" "}
                {(newsElapsed / 1000).toFixed(2)} วินาที)
              </h2>
              <p className="text-xs text-slate-500">
                จัดอันดับหุ้นที่ถูกโบรกเกอร์และสำนักข่าวการเงินกล่าวถึงมากที่สุดในรอบล่าสุด
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadNewsPicks(activeMarket, true)}
              disabled={newsLoading}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-sky-400 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${newsLoading ? "animate-spin" : ""}`} />
              สแกนข่าวใหม่
            </button>
          </div>

          {newsLoading ? (
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
                          onClick={() => jumpToStock(p.symbol, "chart", activeMarket)}
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
