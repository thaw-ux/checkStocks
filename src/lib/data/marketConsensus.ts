import { getOrFetch } from "../cache";
import { getStockMeta, normalizeThaiSymbol } from "../set50";
import type { IaaConsensusSummary, PeerMetricRow, StockFundamentals } from "../types";

const TV_SCAN_URL = "https://scanner.tradingview.com/thailand/scan";

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
  "Energy Minerals": "พลังงานและสาธารณูปโภค",
  Utilities: "พลังงานและสาธารณูปโภค",
  Finance: "การเงินและธนาคาร",
  "Retail Trade": "พาณิชย์",
  "Health Services": "การแพทย์",
  "Health Technology": "การแพทย์",
  Communications: "เทคโนโลยีสารสนเทศและการสื่อสาร",
  "Technology Services": "เทคโนโลยีสารสนเทศและการสื่อสาร",
  "Electronic Technology": "ชิ้นส่วนอิเล็กทรอนิกส์",
  Transportation: "ขนส่งและโลจิสติกส์",
  "Consumer Services": "การท่องเที่ยวและบริการ",
  "Consumer Non-Durables": "อาหารและเครื่องดื่ม",
  "Consumer Durables": "สินค้าอุปโภคบริโภค",
  "Process Industries": "ปิโตรเคมีและบรรจุภัณฑ์",
  "Non-Energy Minerals": "วัสดุก่อสร้างและเหมืองแร่",
  "Industrial Services": "บริการรับเหมาและอุตสาหกรรม",
  "Producer Manufacturing": "สินค้าอุตสาหกรรม",
  "Commercial Services": "บริการเฉพาะกิจ",
  "Distribution Services": "จัดจำหน่ายและค้าส่ง",
};

function numOrNull(v: string | number | null | undefined, digits = 2): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Number(v.toFixed(digits));
}

function mapTvRow(row: TvScanRow): FullConsensusRecord {
  const d = row.d;
  const symbol = normalizeThaiSymbol(String(d[0] ?? row.s.replace(/^SET:/i, "")));
  const meta = getStockMeta(symbol);
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
  const sector =
    meta.sector !== "ตลาดหลักทรัพย์แห่งประเทศไทย (SET/mai)"
      ? meta.sector
      : SECTOR_EN_TO_TH[tvSector] ?? (tvSector || "SET / mai");
  const industry = String(d[23] ?? sector);
  const now = new Date().toISOString();

  return {
    symbol,
    companyName: meta.nameTh !== symbol ? `${meta.nameTh} (${englishName})` : englishName,
    englishName,
    sector,
    industry,
    price,
    changePct,
    volume,
    consensus: {
      symbol,
      companyName: meta.nameTh !== symbol ? meta.nameTh : englishName,
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
      source: "Consensus ตลาดหุ้นไทย (SET / Analyst Coverage)",
      settradeUrl: `https://www.settrade.com/th/equities/quote/${encodeURIComponent(symbol)}/analyst-consensus`,
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
      cashBalanceStatus: "ปกติ (ตรวจสอบ ตลท. ล่าสุด)",
    },
  };
}

export async function fetchMarketConsensusAll(
  forceRefresh = false
): Promise<{ records: FullConsensusRecord[]; ok: boolean }> {
  return getOrFetch(
    "consensus:set:all",
    15 * 60 * 1000,
    async () => {
      try {
        const res = await fetch(TV_SCAN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          body: JSON.stringify({
            filter: [
              { left: "exchange", operation: "equal", right: "SET" },
              { left: "price_target_average", operation: "nempty" },
            ],
            options: { lang: "en" },
            symbols: { query: { types: ["stock"] } },
            sort: { sortBy: "recommendation_total", sortOrder: "desc" },
            range: [0, 300],
            columns: [...TV_COLUMNS],
          }),
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        });

        if (!res.ok) return { records: [], ok: false };
        const json = (await res.json()) as TvScanResponse;
        const rows = json.data ?? [];
        const records = rows.map(mapTvRow).filter((r) => r.price > 0);
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
  forceRefresh = false
): Promise<FullConsensusRecord | null> {
  const symbol = normalizeThaiSymbol(rawSymbol);
  return getOrFetch(
    `consensus:single:${symbol}`,
    12 * 60 * 1000,
    async () => {
      try {
        const res = await fetch(TV_SCAN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          body: JSON.stringify({
            symbols: { tickers: [`SET:${symbol}`] },
            columns: [...TV_COLUMNS],
          }),
          signal: AbortSignal.timeout(6000),
          cache: "no-store",
        });
        if (!res.ok) return null;
        const json = (await res.json()) as TvScanResponse;
        const row = json.data?.[0];
        if (!row) return null;
        return mapTvRow(row);
      } catch {
        return null;
      }
    },
    forceRefresh
  );
}

export async function fetchPeerMetricsBatch(
  rawSymbols: string[],
  forceRefresh = false
): Promise<PeerMetricRow[]> {
  const symbols = Array.from(
    new Set(rawSymbols.map(normalizeThaiSymbol).filter((s) => s.length >= 1))
  ).slice(0, 12);

  if (symbols.length === 0) return [];
  const cacheKey = `peers:${symbols.join(",")}`;

  return getOrFetch(
    cacheKey,
    10 * 60 * 1000,
    async () => {
      try {
        const res = await fetch(TV_SCAN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
          },
          body: JSON.stringify({
            symbols: { tickers: symbols.map((s) => `SET:${s}`) },
            columns: [...TV_COLUMNS],
          }),
          signal: AbortSignal.timeout(6000),
          cache: "no-store",
        });
        if (!res.ok) return [];
        const json = (await res.json()) as TvScanResponse;
        const map = new Map<string, FullConsensusRecord>();
        for (const row of json.data ?? []) {
          const mapped = mapTvRow(row);
          map.set(mapped.symbol, mapped);
        }
        return symbols.map((sym) => {
          const found = map.get(sym);
          const meta = getStockMeta(sym);
          return {
            symbol: sym,
            companyName: found?.englishName ?? meta.nameTh,
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
