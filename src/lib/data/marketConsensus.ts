import { getOrFetch } from "../cache";
import {
  CHINA_UNIVERSE,
  DR_UNIVERSE,
  NASDAQ100_UNIVERSE,
  resolveStockSymbol,
  SP500_UNIVERSE,
  type GlobalStockMeta,
} from "../markets";
import type {
  CurrencyCode,
  IaaConsensusSummary,
  MarketId,
  PeerMetricRow,
  StockFundamentals,
} from "../types";

const TV_COLUMNS = [
  "name", // 0
  "description", // 1
  "close", // 2
  "change", // 3
  "volume", // 4
  "market_cap_basic", // 5
  "price_earnings_ttm", // 6
  "price_book_fq", // 7
  "return_on_equity_fq", // 8
  "dividends_yield_current", // 9
  "price_target_average", // 10
  "price_target_high", // 11
  "price_target_low", // 12
  "price_target_median", // 13
  "recommendation_buy", // 14
  "recommendation_over", // 15
  "recommendation_hold", // 16
  "recommendation_under", // 17
  "recommendation_sell", // 18
  "recommendation_total", // 19
  "price_52_week_high", // 20
  "price_52_week_low", // 21
  "sector", // 22
  "industry", // 23
] as const;

interface TvScanRow {
  s: string;
  d: (string | number | null)[];
}

interface TvScanResponse {
  totalCount?: number;
  data?: TvScanRow[];
}

export interface FullConsensusRecord {
  symbol: string;
  market: MarketId;
  currency: CurrencyCode;
  companyName: string;
  englishName: string;
  sector: string;
  industry: string;
  price: number;
  changePct: number;
  volume: number;
  consensus: IaaConsensusSummary;
  fundamentals: StockFundamentals;
}

const SECTOR_EN_TO_TH: Record<string, string> = {
  "Energy Minerals": "พลังงาน",
  Utilities: "สาธารณูปโภค",
  Finance: "การเงินและธนาคาร",
  "Retail Trade": "ค้าปลีกและอีคอมเมิร์ซ",
  "Health Services": "การแพทย์และสุขภาพ",
  "Health Technology": "เวชภัณฑ์และไบโอเทค",
  Communications: "สื่อสารและแพลตฟอร์ม",
  "Technology Services": "ซอฟต์แวร์และคลาวด์ AI",
  "Electronic Technology": "เซมิคอนดักเตอร์และฮาร์ดแวร์",
  Transportation: "ขนส่งและโลจิสติกส์",
  "Consumer Services": "บริการและท่องเที่ยว",
  "Consumer Non-Durables": "สินค้าอุปโภคบริโภคจำเป็น",
  "Consumer Durables": "ยานยนต์ EV และสินค้าคงทน",
  "Process Industries": "เคมีภัณฑ์และวัสดุ",
  "Non-Energy Minerals": "เหมืองแร่และโลหะ",
  "Industrial Services": "บริการอุตสาหกรรม",
  "Producer Manufacturing": "การผลิตและอุตสาหกรรม",
  "Commercial Services": "บริการธุรกิจ",
  "Distribution Services": "จัดจำหน่ายและค้าส่ง",
};

function numOrNull(v: string | number | null | undefined, digits = 2): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Number(v.toFixed(digits));
}

function mapTvRow(
  row: TvScanRow,
  tvMarket: "thailand" | "america" | "hongkong" | "china",
  marketHint: MarketId
): FullConsensusRecord {
  const d = row.d;
  const rawName = String(d[0] ?? row.s.split(":")[1] ?? "");

  let symbol = rawName.toUpperCase();
  let currency: CurrencyCode = "USD";
  let sourceLabel = "Wall Street Analyst Consensus (US Equities)";
  let refUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/analysis`;

  if (tvMarket === "thailand") {
    symbol = rawName.toUpperCase().replace(/\.BK$/i, "");
    currency = "THB";
    sourceLabel = "DR หุ้นต่างประเทศ (ข้อมูลราคาตลาด)";
    refUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(`${symbol}.BK`)}`;
  } else if (tvMarket === "america") {
    symbol = rawName.replace(".", "-").toUpperCase();
    currency = "USD";
    sourceLabel =
      marketHint === "CHINA"
        ? "Wall Street Analyst Consensus (China US ADR)"
        : "Wall Street Analyst Consensus (US Equities)";
    refUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/analysis`;
  } else if (tvMarket === "hongkong") {
    const padded = rawName.replace(/\D/g, "").padStart(4, "0");
    symbol = `${padded}.HK`;
    currency = "HKD";
    sourceLabel = "HKEX Analyst Consensus (Hong Kong)";
    refUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/analysis`;
  } else {
    const exchangePrefix = row.s.split(":")[0]?.toUpperCase();
    const suffix = exchangePrefix === "SZSE" || !rawName.startsWith("6") ? "SZ" : "SS";
    symbol = `${rawName}.${suffix}`;
    currency = "CNY";
    sourceLabel = "China A-Share Analyst Consensus (SSE / SZSE)";
    refUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/analysis`;
  }

  const globalMeta = resolveStockSymbol(symbol, marketHint);
  const englishName = String(d[1] ?? symbol);
  const price = typeof d[2] === "number" && Number.isFinite(d[2]) ? Number(d[2].toFixed(2)) : 0;
  const changePct = typeof d[3] === "number" && Number.isFinite(d[3]) ? Number(d[3].toFixed(2)) : 0;
  const volume = typeof d[4] === "number" && Number.isFinite(d[4]) ? Math.round(d[4]) : 0;
  const mktCapRaw = typeof d[5] === "number" && Number.isFinite(d[5]) ? d[5] : null;

  const avgTarget = numOrNull(d[10]);
  const highTarget = numOrNull(d[11]);
  const lowTarget = numOrNull(d[12]);
  const medianTarget = numOrNull(d[13]);

  const buy = (typeof d[14] === "number" ? d[14] : 0) + (typeof d[15] === "number" ? d[15] : 0);
  const hold = typeof d[16] === "number" ? d[16] : 0;
  const sell = (typeof d[17] === "number" ? d[17] : 0) + (typeof d[18] === "number" ? d[18] : 0);
  const totalRaw = typeof d[19] === "number" ? d[19] : buy + hold + sell;
  const totalBrokers = Math.max(totalRaw, buy + hold + sell);

  const upsidePct =
    avgTarget !== null && price > 0
      ? Number((((avgTarget - price) / price) * 100).toFixed(1))
      : null;
  const buyRatioPct =
    totalBrokers > 0 ? Number(((buy / totalBrokers) * 100).toFixed(0)) : null;

  let recommendationKey = "ไม่มีข้อมูล";
  if (totalBrokers > 0) {
    if ((buyRatioPct ?? 0) >= 70) recommendationKey = "ซื้อแข็งแกร่ง (Strong Buy)";
    else if ((buyRatioPct ?? 0) >= 50) recommendationKey = "ซื้อ (Buy)";
    else if (sell > buy) recommendationKey = "ขาย / ลดน้ำหนัก (Sell)";
    else recommendationKey = "ถือ (Hold)";
  }

  const tvSector = String(d[22] ?? "");
  const sector = SECTOR_EN_TO_TH[tvSector] ?? (tvSector || globalMeta.sector);
  const industry = String(d[23] ?? sector);
  const now = new Date().toISOString();

  const displayName = globalMeta.name !== symbol ? globalMeta.name : englishName;

  return {
    symbol,
    market: marketHint,
    currency,
    companyName: displayName,
    englishName,
    sector,
    industry,
    price,
    changePct,
    volume,
    consensus: {
      symbol,
      market: marketHint,
      currency,
      companyName: displayName,
      sector,
      currentPrice: price,
      avgTargetPrice: avgTarget,
      medianTargetPrice: medianTarget,
      highTargetPrice: highTarget,
      lowTargetPrice: lowTarget,
      upsidePct,
      buyCount: Math.round(buy),
      holdCount: Math.round(hold),
      sellCount: Math.round(sell),
      totalBrokers: Math.round(totalBrokers),
      buyRatioPct,
      recommendationKey,
      source: sourceLabel,
      settradeUrl: refUrl,
      updatedAt: now,
    },
    fundamentals: {
      pe: numOrNull(d[6]),
      forwardPe: null,
      pbv: numOrNull(d[7]),
      roe: numOrNull(d[8], 1),
      dividendYield: numOrNull(d[9], 2),
      exDividendDate: null,
      marketCapBillion: mktCapRaw !== null ? Number((mktCapRaw / 1e9).toFixed(2)) : null,
      volumeRatio20d: null,
      fiftyTwoWeekHigh: numOrNull(d[20]),
      fiftyTwoWeekLow: numOrNull(d[21]),
      cashBalanceStatus:
        marketHint === "DR" ? "DR หุ้นต่างประเทศ (ปกติ)" : "ตลาดต่างประเทศ (ปกติ)",
    },
  };
}

async function postTvScan(
  tvMarket: "thailand" | "america" | "hongkong" | "china",
  body: Record<string, unknown>,
  timeoutMs = 8000
): Promise<TvScanRow[]> {
  const res = await fetch(`https://scanner.tradingview.com/${tvMarket}/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: JSON.stringify({ ...body, columns: [...TV_COLUMNS] }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as TvScanResponse;
  return json.data ?? [];
}

export async function fetchMarketConsensusByMarket(
  market: MarketId,
  forceRefresh = false
): Promise<{ records: FullConsensusRecord[]; ok: boolean }> {
  return getOrFetch(
    `consensus:global:v2:${market}`,
    15 * 60 * 1000,
    async () => {
      try {
        if (market === "DR") {
          const drTickers = DR_UNIVERSE.map((d) => `SET:${d.tvName}`);
          const rows = await postTvScan("thailand", {
            symbols: { tickers: drTickers },
          });
          const records = rows
            .map((r) => mapTvRow(r, "thailand", "DR"))
            .filter((r) => r.price > 0);
          return { records, ok: records.length > 0 };
        }

        if (market === "SP500") {
          const rows = await postTvScan("america", {
            filter: [
              { left: "exchange", operation: "in_range", right: ["NYSE", "NASDAQ"] },
              { left: "price_target_average", operation: "nempty" },
              { left: "market_cap_basic", operation: "greater", right: 15_000_000_000 },
            ],
            options: { lang: "en" },
            symbols: { query: { types: ["stock"] } },
            sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
            range: [0, 220],
          });
          const spCoreSet = new Set(SP500_UNIVERSE.map((s) => s.symbol));
          const records = rows
            .map((r) => mapTvRow(r, "america", "SP500"))
            .filter((r) => r.price > 0 && !r.symbol.includes("/"));
          records.sort((a, b) => {
            const aCore = spCoreSet.has(a.symbol) ? 1 : 0;
            const bCore = spCoreSet.has(b.symbol) ? 1 : 0;
            if (b.consensus.buyCount !== a.consensus.buyCount) {
              return b.consensus.buyCount - a.consensus.buyCount;
            }
            return bCore - aCore;
          });
          return { records, ok: records.length > 0 };
        }

        if (market === "NASDAQ100") {
          const ndxNames = NASDAQ100_UNIVERSE.map((s) => s.tvName);
          const [coreRows, extraRows] = await Promise.all([
            postTvScan("america", {
              filter: [
                { left: "exchange", operation: "equal", right: "NASDAQ" },
                { left: "name", operation: "in_range", right: ndxNames },
              ],
              range: [0, 100],
            }),
            postTvScan("america", {
              filter: [
                { left: "exchange", operation: "equal", right: "NASDAQ" },
                { left: "price_target_average", operation: "nempty" },
                { left: "market_cap_basic", operation: "greater", right: 10_000_000_000 },
              ],
              symbols: { query: { types: ["stock"] } },
              sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
              range: [0, 110],
            }),
          ]);

          const seen = new Set<string>();
          const records: FullConsensusRecord[] = [];
          for (const row of [...coreRows, ...extraRows]) {
            const mapped = mapTvRow(row, "america", "NASDAQ100");
            if (mapped.price > 0 && !seen.has(mapped.symbol)) {
              seen.add(mapped.symbol);
              records.push(mapped);
            }
          }
          return { records, ok: records.length > 0 };
        }

        if (market === "HK") {
          const hkRows = await postTvScan("hongkong", {
            filter: [
              { left: "exchange", operation: "equal", right: "HKEX" },
              { left: "price_target_average", operation: "nempty" },
              { left: "recommendation_total", operation: "greater", right: 2 },
            ],
            symbols: { query: { types: ["stock"] } },
            sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
            range: [0, 180],
          });

          const seen = new Set<string>();
          const records: FullConsensusRecord[] = [];
          for (const r of hkRows) {
            const rawCode = String(r.d[0] ?? "");
            // Skip HKEX dual-counter 8xxxx RMB duplicates (e.g. 80700)
            if (/^8\d{4}$/.test(rawCode)) continue;
            const m = mapTvRow(r, "hongkong", "HK");
            if (m.price > 0 && !seen.has(m.symbol)) {
              seen.add(m.symbol);
              records.push(m);
            }
          }
          return { records, ok: records.length > 0 };
        }

        // CHINA: Mainland A-Shares (SSE / SZSE) + China US ADRs
        const adrNames = CHINA_UNIVERSE.filter((s) => s.tvMarket === "america").map((s) => s.tvName);
        const [adrRows, aShareRows] = await Promise.all([
          postTvScan("america", {
            filter: [
              { left: "name", operation: "in_range", right: adrNames },
              { left: "exchange", operation: "in_range", right: ["NYSE", "NASDAQ"] },
            ],
            range: [0, 35],
          }),
          postTvScan("china", {
            filter: [
              { left: "price_target_average", operation: "nempty" },
              { left: "recommendation_total", operation: "greater", right: 8 },
            ],
            symbols: { query: { types: ["stock"] } },
            sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
            range: [0, 120],
          }),
        ]);

        const seen = new Set<string>();
        const records: FullConsensusRecord[] = [];
        for (const r of adrRows) {
          const m = mapTvRow(r, "america", "CHINA");
          if (m.price > 0 && !seen.has(m.symbol)) {
            seen.add(m.symbol);
            records.push(m);
          }
        }
        for (const r of aShareRows) {
          const m = mapTvRow(r, "china", "CHINA");
          if (m.price > 0 && !seen.has(m.symbol)) {
            seen.add(m.symbol);
            records.push(m);
          }
        }

        return { records, ok: records.length > 0 };
      } catch {
        return { records: [], ok: false };
      }
    },
    forceRefresh
  );
}

export async function fetchSingleStockConsensusAndFundamentals(
  rawSymbol: string,
  forceRefresh = false,
  hintMarket?: MarketId
): Promise<FullConsensusRecord | null> {
  const resolved: GlobalStockMeta = resolveStockSymbol(rawSymbol, hintMarket);
  return getOrFetch(
    `consensus:single:v2:${resolved.tvMarket}:${resolved.tvName}:${resolved.market}`,
    12 * 60 * 1000,
    async () => {
      try {
        if (resolved.tvMarket === "thailand") {
          const rows = await postTvScan("thailand", {
            symbols: { tickers: [`SET:${resolved.tvName}`] },
          });
          return rows[0] ? mapTvRow(rows[0], "thailand", "DR") : null;
        }

        if (resolved.tvMarket === "hongkong") {
          const rows = await postTvScan("hongkong", {
            symbols: { tickers: [`HKEX:${resolved.tvName}`] },
          });
          return rows[0] ? mapTvRow(rows[0], "hongkong", "HK") : null;
        }

        if (resolved.tvMarket === "china") {
          const exch = resolved.symbol.endsWith(".SZ") ? "SZSE" : "SSE";
          const rows = await postTvScan("china", {
            symbols: { tickers: [`${exch}:${resolved.tvName}`] },
          });
          return rows[0] ? mapTvRow(rows[0], "china", "CHINA") : null;
        }

        const rows = await postTvScan("america", {
          filter: [
            { left: "name", operation: "equal", right: resolved.tvName },
            { left: "exchange", operation: "in_range", right: ["NASDAQ", "NYSE", "AMEX"] },
          ],
          range: [0, 3],
        });
        return rows[0] ? mapTvRow(rows[0], "america", resolved.market) : null;
      } catch {
        return null;
      }
    },
    forceRefresh
  );
}

export async function fetchPeerMetricsBatch(
  rawSymbols: string[],
  forceRefresh = false,
  hintMarket?: MarketId
): Promise<PeerMetricRow[]> {
  const resolvedList = Array.from(
    new Map(
      rawSymbols
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const r = resolveStockSymbol(s, hintMarket);
          return [r.symbol, r] as const;
        })
    ).values()
  ).slice(0, 20);

  if (resolvedList.length === 0) return [];
  const cacheKey = `peers:v3:${resolvedList.map((r) => `${r.tvMarket}:${r.symbol}`).join(",")}`;

  return getOrFetch(
    cacheKey,
    10 * 60 * 1000,
    async () => {
      try {
        const byTvMarket = {
          thailand: resolvedList.filter((r) => r.tvMarket === "thailand"),
          america: resolvedList.filter((r) => r.tvMarket === "america"),
          hongkong: resolvedList.filter((r) => r.tvMarket === "hongkong"),
          china: resolvedList.filter((r) => r.tvMarket === "china"),
        };

        const [drRows, usRows, hkRows, cnRows] = await Promise.all([
          byTvMarket.thailand.length > 0
            ? postTvScan("thailand", {
                symbols: { tickers: byTvMarket.thailand.map((r) => `SET:${r.tvName}`) },
              })
            : Promise.resolve([]),
          byTvMarket.america.length > 0
            ? postTvScan("america", {
                filter: [
                  {
                    left: "name",
                    operation: "in_range",
                    right: byTvMarket.america.map((r) => r.tvName),
                  },
                  { left: "exchange", operation: "in_range", right: ["NASDAQ", "NYSE", "AMEX"] },
                ],
                range: [0, 30],
              })
            : Promise.resolve([]),
          byTvMarket.hongkong.length > 0
            ? postTvScan("hongkong", {
                symbols: { tickers: byTvMarket.hongkong.map((r) => `HKEX:${r.tvName}`) },
              })
            : Promise.resolve([]),
          byTvMarket.china.length > 0
            ? postTvScan("china", {
                symbols: {
                  tickers: byTvMarket.china.map(
                    (r) => `${r.symbol.endsWith(".SZ") ? "SZSE" : "SSE"}:${r.tvName}`
                  ),
                },
              })
            : Promise.resolve([]),
        ]);

        const recordMap = new Map<string, FullConsensusRecord>();
        for (const r of drRows) {
          const m = mapTvRow(r, "thailand", "DR");
          recordMap.set(m.symbol, m);
        }
        for (const r of usRows) {
          const m = mapTvRow(r, "america", hintMarket === "CHINA" ? "CHINA" : "SP500");
          recordMap.set(m.symbol, m);
        }
        for (const r of hkRows) {
          const m = mapTvRow(r, "hongkong", "HK");
          recordMap.set(m.symbol, m);
        }
        for (const r of cnRows) {
          const m = mapTvRow(r, "china", "CHINA");
          recordMap.set(m.symbol, m);
        }

        return resolvedList.map((res) => {
          const found = recordMap.get(res.symbol);
          return {
            symbol: res.symbol,
            currency: res.currency,
            companyName: found?.englishName ?? res.name,
            price: found?.price ?? null,
            changePct: found?.changePct ?? null,
            pe: found?.fundamentals.pe ?? null,
            pbv: found?.fundamentals.pbv ?? null,
            roe: found?.fundamentals.roe ?? null,
            dividendYield: found?.fundamentals.dividendYield ?? null,
            marketCapBillion: found?.fundamentals.marketCapBillion ?? null,
          };
        });
      } catch {
        return [];
      }
    },
    forceRefresh
  );
}
