import { getOrFetch } from "../cache";
import { computeTechnicalSummary } from "../quant/indicators";
import { aggregateWeeklyBars, computeSmartSupportResistance } from "../quant/supportResistance";
import type { FxRatesToThb, GlobalMacroItem, IndexSrRadarItem, OhlcvBar } from "../types";

const YF_HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json",
};

export interface YahooChartMeta {
  symbol: string;
  currency: string;
  regularMarketPrice: number;
  chartPreviousClose: number;
  previousClose: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  regularMarketVolume: number | null;
  regularMarketTime: number;
  longName?: string;
  shortName?: string;
}

export interface YahooChartResponse {
  bars: OhlcvBar[];
  meta: YahooChartMeta | null;
  ok: boolean;
}

interface RawYahooChartJson {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketVolume?: number;
        regularMarketTime?: number;
        longName?: string;
        shortName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}

function formatDateYmdBkk(unixSeconds: number): string {
  const d = new Date((unixSeconds + 7 * 3600) * 1000);
  return d.toISOString().slice(0, 10);
}

function formatDateTimeBkk(unixSeconds: number): string {
  const d = new Date((unixSeconds + 7 * 3600) * 1000);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export async function fetchYahooChart(
  rawSymbol: string,
  range: "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" = "1y",
  interval: "5m" | "15m" | "1d" = "1d",
  forceRefresh = false,
  // Kept for backward compatibility; all callers pass exact Yahoo symbols now
  _isExactYahooSymbol = true
): Promise<YahooChartResponse> {
  void _isExactYahooSymbol;
  const yahooSym = rawSymbol.trim().toUpperCase();
  const cacheKey = `yf:chart:${yahooSym}:${range}:${interval}`;
  const ttlMs = interval === "1d" ? 10 * 60 * 1000 : 3 * 60 * 1000;

  return getOrFetch(
    cacheKey,
    ttlMs,
    async () => {
      for (const host of YF_HOSTS) {
        try {
          const url = `${host}/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=${range}&interval=${interval}&includePrePost=false`;
          const res = await fetch(url, {
            headers: DEFAULT_HEADERS,
            signal: AbortSignal.timeout(8000),
            cache: "no-store",
          });
          if (!res.ok) continue;

          const json = (await res.json()) as RawYahooChartJson;
          const result = json.chart?.result?.[0];
          if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
            continue;
          }

          const ts = result.timestamp;
          const q = result.indicators.quote[0];
          const bars: OhlcvBar[] = [];
          const seenTime = new Set<string>();

          for (let i = 0; i < ts.length; i++) {
            const o = q.open?.[i];
            const h = q.high?.[i];
            const l = q.low?.[i];
            const c = q.close?.[i];
            const v = q.volume?.[i] ?? 0;
            if (
              o === null || o === undefined ||
              h === null || h === undefined ||
              l === null || l === undefined ||
              c === null || c === undefined ||
              !Number.isFinite(c) || c <= 0
            ) {
              continue;
            }
            const timeStr =
              interval === "1d" ? formatDateYmdBkk(ts[i]) : formatDateTimeBkk(ts[i]);
            if (seenTime.has(timeStr)) {
              const idx = bars.findIndex((b) => b.time === timeStr);
              if (idx >= 0) {
                bars[idx] = {
                  time: timeStr,
                  timestamp: ts[i],
                  open: Number(o.toFixed(4)),
                  high: Number(h.toFixed(4)),
                  low: Number(l.toFixed(4)),
                  close: Number(c.toFixed(4)),
                  volume: Math.max(0, Math.round(v ?? 0)),
                };
              }
              continue;
            }
            seenTime.add(timeStr);
            bars.push({
              time: timeStr,
              timestamp: ts[i],
              open: Number(o.toFixed(4)),
              high: Number(h.toFixed(4)),
              low: Number(l.toFixed(4)),
              close: Number(c.toFixed(4)),
              volume: Math.max(0, Math.round(v ?? 0)),
            });
          }

          const m = result.meta;
          const lastBar = bars[bars.length - 1];
          const prevBar = bars[bars.length - 2] ?? lastBar;
          const meta: YahooChartMeta = {
            symbol: m?.symbol ?? yahooSym,
            currency: m?.currency ?? "USD",
            regularMarketPrice: m?.regularMarketPrice ?? lastBar?.close ?? 0,
            chartPreviousClose: m?.chartPreviousClose ?? prevBar?.close ?? 0,
            previousClose: m?.previousClose ?? prevBar?.close ?? m?.chartPreviousClose ?? 0,
            fiftyTwoWeekHigh: m?.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: m?.fiftyTwoWeekLow ?? null,
            regularMarketVolume: m?.regularMarketVolume ?? lastBar?.volume ?? null,
            regularMarketTime:
              m?.regularMarketTime ?? lastBar?.timestamp ?? Math.floor(Date.now() / 1000),
            longName: m?.longName,
            shortName: m?.shortName,
          };

          return { bars, meta, ok: bars.length > 0 };
        } catch {
          // Try next host
        }
      }
      return { bars: [], meta: null, ok: false };
    },
    forceRefresh
  );
}

export async function fetchYahooBatchCharts(
  symbols: string[],
  range: "6mo" | "1y" = "1y",
  concurrency = 10,
  forceRefresh = false,
  exactYahooSymbols = true
): Promise<Map<string, YahooChartResponse>> {
  const results = new Map<string, YahooChartResponse>();
  let cursor = 0;

  async function worker() {
    while (cursor < symbols.length) {
      const idx = cursor++;
      const sym = symbols[idx];
      const data = await fetchYahooChart(sym, range, "1d", forceRefresh, exactYahooSymbols);
      results.set(sym, data);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, symbols.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/** 12 Global Market & FX KPI Cards (US, HK, China, VIX, Gold, Oil, 10Y Yield, USD/THB, HKD/THB) */
const MACRO_DEFINITIONS: {
  symbol: string;
  labelTh: string;
  category: GlobalMacroItem["category"];
  unit?: string;
}[] = [
  { symbol: "^GSPC", labelTh: "🇺🇸 S&P 500 (สหรัฐฯ)", category: "us" },
  { symbol: "^NDX", labelTh: "🇺🇸 Nasdaq 100 (เทคฯ)", category: "us" },
  { symbol: "^DJI", labelTh: "🇺🇸 Dow Jones (ดาวโจนส์)", category: "us" },
  { symbol: "^HSI", labelTh: "🇭🇰 Hang Seng (ฮ่องกง)", category: "hk_cn" },
  { symbol: "000001.SS", labelTh: "🇨🇳 Shanghai Comp (จีน)", category: "hk_cn" },
  { symbol: "399001.SZ", labelTh: "🇨🇳 Shenzhen Comp (จีน)", category: "hk_cn" },
  { symbol: "^VIX", labelTh: "VIX ดัชนีความผันผวน", category: "volatility" },
  { symbol: "GC=F", labelTh: "ราคาทองคำโลก (Gold)", category: "commodity", unit: "USD" },
  { symbol: "BZ=F", labelTh: "น้ำมันดิบ Brent", category: "commodity", unit: "USD" },
  { symbol: "^TNX", labelTh: "บอนด์ยีลด์สหรัฐฯ 10Y", category: "fx_bond", unit: "%" },
  { symbol: "THB=X", labelTh: "อัตราแลกเปลี่ยน USD/THB", category: "fx_bond", unit: "฿" },
  { symbol: "HKDTHB=X", labelTh: "อัตราแลกเปลี่ยน HKD/THB", category: "fx_bond", unit: "฿" },
];

export async function fetchGlobalMacro12(forceRefresh = false): Promise<GlobalMacroItem[]> {
  return getOrFetch(
    "yf:macro:global:12",
    5 * 60 * 1000,
    async () => {
      const items = await Promise.all(
        MACRO_DEFINITIONS.map(async (def) => {
          const chart = await fetchYahooChart(def.symbol, "5d", "1d", forceRefresh, true);
          const bars = chart.bars;
          const last = bars[bars.length - 1];
          const prev = bars[bars.length - 2];
          const price = chart.meta?.regularMarketPrice || last?.close || 0;
          const prevClose = prev?.close || chart.meta?.chartPreviousClose || price;
          const change = price - prevClose;
          const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

          return {
            symbol: def.symbol,
            labelTh: def.labelTh,
            category: def.category,
            price: Number(price.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePct: Number(changePct.toFixed(2)),
            unit: def.unit,
            updatedAt: chart.meta?.regularMarketTime
              ? new Date(chart.meta.regularMarketTime * 1000).toISOString()
              : new Date().toISOString(),
          };
        })
      );
      return items.filter((item) => item.price > 0);
    },
    forceRefresh
  );
}

/** Live FX rates to Thai Baht (THB) for multi-currency Paper Trade conversion */
export async function fetchFxRatesToThb(forceRefresh = false): Promise<FxRatesToThb> {
  return getOrFetch(
    "yf:fx:to_thb",
    10 * 60 * 1000,
    async () => {
      const [usdRes, hkdRes, cnyRes] = await Promise.all([
        fetchYahooChart("THB=X", "5d", "1d", forceRefresh, true),
        fetchYahooChart("HKDTHB=X", "5d", "1d", forceRefresh, true),
        fetchYahooChart("CNYTHB=X", "5d", "1d", forceRefresh, true),
      ]);

      const usd = usdRes.meta?.regularMarketPrice || usdRes.bars.at(-1)?.close || 34.0;
      const hkd = hkdRes.meta?.regularMarketPrice || hkdRes.bars.at(-1)?.close || usd / 7.8;
      const cny = cnyRes.meta?.regularMarketPrice || cnyRes.bars.at(-1)?.close || usd / 7.2;

      return {
        USD: Number(usd.toFixed(4)),
        HKD: Number(hkd.toFixed(4)),
        CNY: Number(cny.toFixed(4)),
        THB: 1,
        updatedAt: new Date().toISOString(),
      };
    },
    forceRefresh
  );
}

/** 5 Global Index S/R Radar definitions (US + Hong Kong + Mainland China) */
const INDEX_RADAR_DEFS: {
  yahooSymbol: string;
  displaySymbol: string;
  labelTh: string;
  flag: string;
  market: IndexSrRadarItem["market"];
  currency: string;
}[] = [
  {
    yahooSymbol: "^GSPC",
    displaySymbol: "^GSPC",
    labelTh: "S&P 500 (ดัชนีหลักสหรัฐฯ)",
    flag: "🇺🇸",
    market: "SP500",
    currency: "USD",
  },
  {
    yahooSymbol: "^NDX",
    displaySymbol: "^NDX",
    labelTh: "Nasdaq 100 (เทคฯ สหรัฐฯ)",
    flag: "🇺🇸",
    market: "NASDAQ100",
    currency: "USD",
  },
  {
    yahooSymbol: "^DJI",
    displaySymbol: "^DJI",
    labelTh: "Dow Jones (อุตสาหกรรมสหรัฐฯ)",
    flag: "🇺🇸",
    market: "SP500",
    currency: "USD",
  },
  {
    yahooSymbol: "^HSI",
    displaySymbol: "^HSI",
    labelTh: "Hang Seng (ตลาดฮ่องกง HKEX)",
    flag: "🇭🇰",
    market: "HK",
    currency: "HKD",
  },
  {
    yahooSymbol: "000001.SS",
    displaySymbol: "000001.SS",
    labelTh: "Shanghai Composite (จีนแผ่นดินใหญ่)",
    flag: "🇨🇳",
    market: "CHINA",
    currency: "CNY",
  },
];

export async function fetchIndexSrRadar5(forceRefresh = false): Promise<IndexSrRadarItem[]> {
  return getOrFetch(
    "yf:index:sr-radar:global:5",
    10 * 60 * 1000,
    async () => {
      const list = await Promise.all(
        INDEX_RADAR_DEFS.map(async (def) => {
          const chart = await fetchYahooChart(def.yahooSymbol, "2y", "1d", forceRefresh, true);
          if (!chart.ok || chart.bars.length < 30) return null;
          const tech = computeTechnicalSummary(chart.bars, def.currency);
          const srDaily = computeSmartSupportResistance(chart.bars, def.currency, "day");
          const weeklyBars = aggregateWeeklyBars(chart.bars);
          const srWeekly = computeSmartSupportResistance(weeklyBars, def.currency, "week");
          return {
            symbol: def.yahooSymbol,
            displaySymbol: def.displaySymbol,
            labelTh: def.labelTh,
            flag: def.flag,
            market: def.market,
            price: tech.price,
            changePct: tech.changePct,
            trendLabel: tech.trendLabel,
            trendBias: tech.trendBias,
            rsi14: tech.rsi14,
            srDaily,
            srWeekly,
          } satisfies IndexSrRadarItem;
        })
      );
      return list.filter((x): x is IndexSrRadarItem => x !== null);
    },
    forceRefresh
  );
}
