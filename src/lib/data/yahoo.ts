import { getOrFetch } from "../cache";
import { toYahooSymbol } from "../set50";
import type { GlobalMacroItem, OhlcvBar } from "../types";

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
  // Convert to Asia/Bangkok (UTC+7) YYYY-MM-DD
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
  forceRefresh = false
): Promise<YahooChartResponse> {
  const yahooSym = rawSymbol.includes(".") || rawSymbol.startsWith("^") || rawSymbol.includes("=") || rawSymbol.includes("-")
    ? rawSymbol
    : toYahooSymbol(rawSymbol);

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
              // Replace duplicate day with latest candle
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
            currency: m?.currency ?? "THB",
            regularMarketPrice: m?.regularMarketPrice ?? lastBar?.close ?? 0,
            chartPreviousClose: m?.chartPreviousClose ?? prevBar?.close ?? 0,
            previousClose: m?.previousClose ?? prevBar?.close ?? m?.chartPreviousClose ?? 0,
            fiftyTwoWeekHigh: m?.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: m?.fiftyTwoWeekLow ?? null,
            regularMarketVolume: m?.regularMarketVolume ?? lastBar?.volume ?? null,
            regularMarketTime: m?.regularMarketTime ?? lastBar?.timestamp ?? Math.floor(Date.now() / 1000),
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
  forceRefresh = false
): Promise<Map<string, YahooChartResponse>> {
  const results = new Map<string, YahooChartResponse>();
  let cursor = 0;

  async function worker() {
    while (cursor < symbols.length) {
      const idx = cursor++;
      const sym = symbols[idx];
      const data = await fetchYahooChart(sym, range, "1d", forceRefresh);
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

const MACRO_DEFINITIONS: {
  symbol: string;
  labelTh: string;
  category: GlobalMacroItem["category"];
  unit?: string;
}[] = [
  { symbol: "^SET.BK", labelTh: "SET Index (หุ้นไทย)", category: "thai", unit: "จุด" },
  { symbol: "^GSPC", labelTh: "S&P 500 (สหรัฐฯ)", category: "us" },
  { symbol: "^IXIC", labelTh: "Nasdaq (เทคฯ สหรัฐฯ)", category: "us" },
  { symbol: "^DJI", labelTh: "Dow Jones (ดาวโจนส์)", category: "us" },
  { symbol: "^N225", labelTh: "Nikkei 225 (ญี่ปุ่น)", category: "asia" },
  { symbol: "^HSI", labelTh: "Hang Seng (ฮ่องกง)", category: "asia" },
  { symbol: "GC=F", labelTh: "ราคาทองคำโลก (Gold)", category: "commodity", unit: "USD" },
  { symbol: "BZ=F", labelTh: "น้ำมันดิบ Brent", category: "commodity", unit: "USD" },
  { symbol: "CL=F", labelTh: "น้ำมันดิบ WTI", category: "commodity", unit: "USD" },
  { symbol: "THB=X", labelTh: "ค่าเงินบาท (USD/THB)", category: "fx_bond", unit: "บ." },
  { symbol: "DX-Y.NYB", labelTh: "ดัชนีดอลลาร์ (DXY)", category: "fx_bond" },
  { symbol: "^TNX", labelTh: "บอนด์ยีลด์สหรัฐฯ 10Y", category: "fx_bond", unit: "%" },
];

export async function fetchGlobalMacro12(forceRefresh = false): Promise<GlobalMacroItem[]> {
  return getOrFetch(
    "yf:macro:12",
    5 * 60 * 1000,
    async () => {
      const items = await Promise.all(
        MACRO_DEFINITIONS.map(async (def) => {
          const chart = await fetchYahooChart(def.symbol, "5d", "1d", forceRefresh);
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
