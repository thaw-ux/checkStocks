"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  Newspaper,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  DataAuditStrip,
  SentimentBadge,
  SkeletonCard,
} from "@/components/common/UiPrimitives";
import type { MarketOverviewPayload, NewsImpactResult } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const IMPACT_PRESETS = [
  {
    label: "ตัวอย่าง: ราคาน้ำมันดิบปรับขึ้นแรง",
    text: "ราคาน้ำมันดิบเบรนท์ปรับตัวพุ่งขึ้นกว่า 4% จากความตึงเครียดตะวันออกกลางและกำลังการผลิตที่ตึงตัว ส่งผลต่อต้นทุนพลังงาน สายการบิน ปิโตรเคมี และหุ้นกลุ่มสำรวจผลิตน้ำมันของไทย เช่น PTTEP, PTT, TOP, AOT",
  },
  {
    label: "ตัวอย่าง: กนง. ปรับลดอัตราดอกเบี้ยนโยบาย",
    text: "คณะกรรมการนโยบายการเงิน (กนง.) มีมติปรับลดอัตราดอกเบี้ยนโยบายลง 0.25% เพื่อกระตุ้นเศรษฐกิจและบรรเทาภาระหนี้ครัวเรือน กระทบกลุ่มธนาคาร ไฟแนนซ์เช่าซื้อ อสังหาริมทรัพย์ และรีท เช่น MTC, SAWAD, TIDLOR, AP, SPALI, KBANK, BBL",
  },
  {
    label: "ตัวอย่าง: นักท่องเที่ยวต่างชาติทำสถิติใหม่",
    text: "จำนวนนักท่องเที่ยวต่างชาติเดินทางเข้าไทยเดือนล่าสุดเติบโตโดดเด่นรับไฮซีซัน ยอดผู้โดยสารสุวรรณภูมิและดอนเมืองพุ่งสูงสุดหลังโควิด หนุนรายได้สนามบิน โรงแรม ค้าปลีก และโรงพยาบาล เช่น AOT, MINT, CENTEL, ERW, CPALL, BDMS",
  },
];

export function NewsTab() {
  const { jumpToStock, isCardView, modelSettings } = useAppStore();
  const [subMode, setSubMode] = useState<"overview" | "custom">("overview");
  const [data, setData] = useState<MarketOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRawNews, setShowRawNews] = useState(false);

  // Custom news impact state
  const [newsUrl, setNewsUrl] = useState("");
  const [newsText, setNewsText] = useState("");
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState("");
  const [impactResult, setImpactResult] = useState<NewsImpactResult | null>(null);

  const loadOverview = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (refresh) params.set("refresh", "1");
        if (modelSettings.flashModel) params.set("model", modelSettings.flashModel);
        const res = await fetch(`/api/market/overview?${params.toString()}`);
        const json = (await res.json()) as MarketOverviewPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "โหลดภาพรวมตลาดไม่สำเร็จ");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
      }
    },
    [modelSettings.flashModel]
  );

  useEffect(() => {
    void loadOverview(false);
  }, [loadOverview]);

  async function handleAnalyzeCustomNews(e: React.FormEvent) {
    e.preventDefault();
    if (!newsUrl.trim() && !newsText.trim()) return;
    setImpactLoading(true);
    setImpactError("");
    try {
      const res = await fetch("/api/market/news-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newsUrl.trim() || undefined,
          text: newsText.trim() || undefined,
          model: modelSettings.flashModel,
        }),
      });
      const json = (await res.json()) as NewsImpactResult & { error?: string };
      if (!res.ok) throw new Error(json.error || "วิเคราะห์ข่าวไม่สำเร็จ");
      setImpactResult(json);
    } catch (err) {
      setImpactError(err instanceof Error ? err.message : "วิเคราะห์ข่าวไม่สำเร็จ");
    } finally {
      setImpactLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Sub-mode switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-800 p-1">
          <button
            type="button"
            onClick={() => setSubMode("overview")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              subMode === "overview"
                ? "bg-sky-500 text-slate-950 shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            ภาพรวมดัชนีตลาดโลกและข่าวประจำวัน
          </button>
          <button
            type="button"
            onClick={() => setSubMode("custom")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              subMode === "custom"
                ? "bg-sky-500 text-slate-950 shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            วิเคราะห์ผลกระทบจากลิงก์หรือข้อความข่าว
          </button>
        </div>

        {subMode === "overview" && (
          <button
            type="button"
            onClick={() => void loadOverview(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-sky-400 text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            รีเฟรชข้อมูลล่าสุด
          </button>
        )}
      </div>

      {subMode === "overview" ? (
        <>
          {error && (
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-400">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <SkeletonCard key={i} lines={1} />
                ))}
              </div>
              <SkeletonCard lines={5} />
            </div>
          ) : data ? (
            <>
              {/* 12 Global Macro KPI Cards */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    ภาพรวมดัชนีตลาดโลก ทองคำ น้ำมัน ค่าเงินบาท และบอนด์ยีลด์
                  </h2>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    อัปเดต {new Date(data.generatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                  {data.macroCards.map((m) => {
                    const up = m.changePct >= 0;
                    const isSet = m.symbol === "^SET.BK";
                    return (
                      <div
                        key={m.symbol}
                        className={`rounded-xl border p-3 transition ${
                          isSet
                            ? "border-sky-500/50 bg-sky-500/10 dark:bg-sky-950/35"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90"
                        }`}
                      >
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                          {m.labelTh}
                        </div>
                        <div className="mt-1 text-base font-bold tabular-nums text-slate-900 dark:text-white">
                          {m.price.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          {m.unit ? (
                            <span className="text-[10px] font-normal text-slate-400 ml-1">
                              {m.unit}
                            </span>
                          ) : null}
                        </div>
                        <div
                          className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
                            up
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {up ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {up ? "+" : ""}
                          {m.changePct.toFixed(2)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Daily Auto Briefing (6 Sections) */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-500 mb-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      สรุปภาวะตลาดและข่าวใหญ่ประจำวัน (AUTO BRIEFING · {data.briefing.modelUsed})
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      {data.briefing.headline}
                    </h3>
                  </div>
                  <SentimentBadge
                    bias={
                      data.briefing.mood === "Risk-On"
                        ? "positive"
                        : data.briefing.mood === "Risk-Off"
                          ? "negative"
                          : "neutral"
                    }
                    label={`โหมดตลาด: ${data.briefing.mood}`}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.briefing.sections.map((sec) => (
                    <div
                      key={sec.key}
                      className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 p-3.5"
                    >
                      <div className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-1.5">
                        {sec.title}
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {sec.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Affected Thai Stocks */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      หุ้นไทยที่เกี่ยวข้องกับประเด็นตลาดโลกและข่าววันนี้
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      คลิกที่ชื่อหุ้นเพื่อเจาะลึกกราฟเทคนิค, เป้า IAA และ Time Machine ทันที
                    </p>
                  </div>
                </div>

                {/* Quick jump pills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {data.affectedStocks.map((s) => (
                    <button
                      key={s.symbol}
                      type="button"
                      onClick={() => jumpToStock(s.symbol)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-sky-400 hover:bg-sky-500/10 transition cursor-pointer"
                    >
                      <span>
                        {s.sentiment === "positive" ? "🟢" : s.sentiment === "negative" ? "🔴" : "🟡"}
                      </span>
                      <span>{s.symbol}</span>
                      {s.price ? (
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                          {s.price.toFixed(2)}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                {isCardView ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {data.affectedStocks.map((s) => (
                      <div
                        key={s.symbol}
                        onClick={() => jumpToStock(s.symbol)}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 cursor-pointer hover:border-sky-400 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-sky-600 dark:text-sky-400">
                            {s.symbol}
                          </span>
                          <SentimentBadge bias={s.sentiment} />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{s.sector}</div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-1.5">
                          {s.reason}
                        </p>
                        {s.price && (
                          <div className="mt-2 text-xs font-semibold tabular-nums">
                            ราคา {s.price.toFixed(2)} บ.{" "}
                            {s.changePct !== undefined && (
                              <span
                                className={
                                  s.changePct >= 0 ? "text-emerald-500" : "text-rose-500"
                                }
                              >
                                ({s.changePct >= 0 ? "+" : ""}
                                {s.changePct.toFixed(2)}%)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                          <th className="py-2 pr-3 font-semibold">หุ้น</th>
                          <th className="py-2 px-3 font-semibold">หมวดธุรกิจ</th>
                          <th className="py-2 px-3 font-semibold">มุมมอง</th>
                          <th className="py-2 px-3 font-semibold text-right">ราคาล่าสุด</th>
                          <th className="py-2 pl-3 font-semibold">ประเด็นเชื่อมโยง</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {data.affectedStocks.map((s) => (
                          <tr
                            key={s.symbol}
                            onClick={() => jumpToStock(s.symbol)}
                            className="hover:bg-sky-500/5 cursor-pointer transition"
                          >
                            <td className="py-2.5 pr-3 font-bold text-sky-600 dark:text-sky-400">
                              {s.symbol}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              {s.sector}
                            </td>
                            <td className="py-2.5 px-3">
                              <SentimentBadge bias={s.sentiment} />
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                              {s.price ? `${s.price.toFixed(2)} บ.` : "-"}
                              {s.changePct !== undefined && (
                                <span
                                  className={`ml-1.5 text-[11px] ${
                                    s.changePct >= 0 ? "text-emerald-500" : "text-rose-500"
                                  }`}
                                >
                                  ({s.changePct >= 0 ? "+" : ""}
                                  {s.changePct.toFixed(2)}%)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pl-3 text-slate-600 dark:text-slate-300">
                              {s.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Categorized Raw Headlines (7 Categories) */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRawNews((s) => !s)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Newspaper className="h-4 w-4 text-sky-400" />
                    เปิดดูพาดหัวข่าวด่วน & บทวิเคราะห์โบรกเกอร์ต้นฉบับแยก 7 หมวด ({data.totalHeadlines} รายการล่าสุด)
                  </div>
                  {showRawNews ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {showRawNews && (
                  <div className="px-5 pb-5 space-y-4 border-t border-slate-200 dark:border-slate-800 pt-4">
                    {Object.entries(data.categorizedNews).map(([catLabel, items]) => (
                      <div key={catLabel}>
                        <h4 className="text-xs font-bold text-amber-600 dark:text-amber-300 mb-2">
                          {catLabel} ({items.length})
                        </h4>
                        {items.length === 0 ? (
                          <p className="text-xs text-slate-500">ไม่พบข่าวใหม่ในหมวดนี้</p>
                        ) : (
                          <div className="space-y-1.5">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/70 px-3 py-2 text-xs"
                              >
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-800 dark:text-slate-200 hover:text-sky-400 font-medium flex-1 min-w-[220px] inline-flex items-center gap-1.5"
                                >
                                  <span>{item.title}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                </a>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {(item.tickers ?? []).slice(0, 3).map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => jumpToStock(t)}
                                      className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 cursor-pointer"
                                    >
                                      {t}
                                    </button>
                                  ))}
                                  <span className="text-[11px] text-slate-500">
                                    {item.source} · {item.pubDate.slice(5, 10)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DataAuditStrip items={data.dataAudit} />
            </>
          ) : null}
        </>
      ) : (
        /* Sub-mode 1B: Custom News URL / Text Impact Analyzer */
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                วิเคราะห์ผลกระทบต่อหุ้นไทยจากลิงก์ข่าว หรือข้อความข่าว
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                วางลิงก์ข่าวหรือข้อความประเด็นร้อน เพื่อให้ AI ประเมินกลุ่มที่ได้/เสียประโยชน์พร้อมรายชื่อหุ้น SET ที่เกี่ยวข้อง
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {IMPACT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setNewsUrl("");
                    setNewsText(p.text);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/15 hover:text-sky-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setNewsUrl("");
                  setNewsText("");
                  setImpactResult(null);
                  setImpactError("");
                }}
                className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:text-rose-400 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
              >
                ล้างข้อมูล
              </button>
            </div>

            <form onSubmit={handleAnalyzeCustomNews} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  ลิงก์ข่าวสาธารณะ (URL · ไม่บังคับ)
                </label>
                <input
                  type="url"
                  value={newsUrl}
                  onChange={(e) => setNewsUrl(e.target.value)}
                  placeholder="https://www.kaohoon.com/..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  ข้อความข่าว หรือประเด็นที่ต้องการประเมิน
                </label>
                <textarea
                  rows={4}
                  value={newsText}
                  onChange={(e) => setNewsText(e.target.value)}
                  placeholder="วางข้อความข่าว เอกสารสรุป หรือคำถามประเด็นเศรษฐกิจ..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm outline-none focus:border-sky-400"
                />
              </div>
              <button
                type="submit"
                disabled={impactLoading || (!newsUrl.trim() && !newsText.trim())}
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition cursor-pointer"
              >
                {impactLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังประเมินผลกระทบ...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    วิเคราะห์ข่าวด้วย AI
                  </>
                )}
              </button>
            </form>

            {impactError && (
              <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
                {impactError}
              </div>
            )}
          </div>

          {impactResult && (
            <div className="rounded-2xl border border-sky-500/30 bg-white dark:bg-slate-900/95 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-sky-400">
                    ผลวิเคราะห์ผลกระทบ ({impactResult.modelUsed})
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {impactResult.headline}
                  </h3>
                </div>
                <SentimentBadge
                  bias={
                    impactResult.overallImpact.includes("บวก")
                      ? "positive"
                      : impactResult.overallImpact.includes("ลบ")
                        ? "negative"
                        : "neutral"
                  }
                  label={impactResult.overallImpact}
                />
              </div>

              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {impactResult.summary}
              </p>

              {impactResult.affectedSectors.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {impactResult.affectedSectors.map((sec, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{sec.sector}</span>
                        <SentimentBadge bias={sec.impact} />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{sec.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {impactResult.affectedStocks.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
                    หุ้นไทยที่เกี่ยวข้อง (คลิกเพื่อวิเคราะห์รายตัว)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {impactResult.affectedStocks.map((s) => (
                      <button
                        key={s.symbol}
                        type="button"
                        onClick={() => jumpToStock(s.symbol)}
                        className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-400 p-3 transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-sky-500">{s.symbol}</span>
                          <SentimentBadge bias={s.sentiment} />
                        </div>
                        <div className="text-[11px] text-slate-500">{s.sector}</div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                          {s.reason}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                <strong>แนวทางติดตามต่อ:</strong> {impactResult.actionableTakeaway}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
