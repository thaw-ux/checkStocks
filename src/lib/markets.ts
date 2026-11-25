import type { CurrencyCode, MarketId } from "./types";

export type { CurrencyCode, MarketId };

export const VALID_MARKETS: MarketId[] = ["SP500", "NASDAQ100", "HK", "CHINA", "DR"];

export function parseMarketId(raw: string | null | undefined, fallback: MarketId = "NASDAQ100"): MarketId {
  if (raw === "SP500" || raw === "NASDAQ100" || raw === "HK" || raw === "CHINA" || raw === "DR") {
    return raw;
  }
  return fallback;
}

export interface GlobalStockMeta {
  symbol: string; // Display symbol e.g. NVDA, ^GSPC, 0700.HK, 600519.SS, BABA, NVDA80
  yahooSymbol: string; // Yahoo Finance symbol e.g. NVDA, ^GSPC, 0700.HK, 600519.SS, NVDA80.BK
  tvMarket: "america" | "hongkong" | "china" | "thailand";
  tvName: string; // TradingView `name` field
  name: string;
  sector: string;
  market: MarketId;
  currency: CurrencyCode;
  lotSize: number;
  isIndexOrEtf?: boolean;
}

export interface MarketConfig {
  id: MarketId;
  label: string;
  shortLabel: string;
  flag: string;
  benchmarkYahoo: string;
  benchmarkLabel: string;
  defaultCurrency: CurrencyCode;
  defaultCapital: number;
  quickTickers: string[];
}

export const MARKET_CONFIGS: Record<MarketId, MarketConfig> = {
  SP500: {
    id: "SP500",
    label: "สหรัฐฯ S&P 500",
    shortLabel: "S&P 500",
    flag: "🇺🇸",
    benchmarkYahoo: "^GSPC",
    benchmarkLabel: "S&P 500",
    defaultCurrency: "USD",
    defaultCapital: 10_000,
    quickTickers: ["^GSPC", "SPY", "NVDA", "AAPL", "MSFT", "AMZN", "LLY", "JPM"],
  },
  NASDAQ100: {
    id: "NASDAQ100",
    label: "สหรัฐฯ Nasdaq 100",
    shortLabel: "Nasdaq 100",
    flag: "🇺🇸",
    benchmarkYahoo: "^NDX",
    benchmarkLabel: "Nasdaq 100",
    defaultCurrency: "USD",
    defaultCapital: 10_000,
    quickTickers: ["^NDX", "QQQ", "NVDA", "AAPL", "MSFT", "META", "TSLA", "AVGO"],
  },
  HK: {
    id: "HK",
    label: "ฮ่องกง (HKEX / Hang Seng)",
    shortLabel: "ฮ่องกง HKEX",
    flag: "🇭🇰",
    benchmarkYahoo: "^HSI",
    benchmarkLabel: "Hang Seng",
    defaultCurrency: "HKD",
    defaultCapital: 100_000,
    quickTickers: ["^HSI", "0700.HK", "9988.HK", "1211.HK", "1810.HK", "3690.HK", "0005.HK", "9992.HK"],
  },
  CHINA: {
    id: "CHINA",
    label: "จีน (A-Share + US ADR)",
    shortLabel: "จีน A/ADR",
    flag: "🇨🇳",
    benchmarkYahoo: "000001.SS",
    benchmarkLabel: "Shanghai Comp",
    defaultCurrency: "USD",
    defaultCapital: 10_000,
    quickTickers: ["000001.SS", "600519.SS", "300750.SZ", "BABA", "PDD", "JD", "KWEB", "ASHR"],
  },
  DR: {
    id: "DR",
    label: "DR หุ้นต่างประเทศ (บาท)",
    shortLabel: "DR หุ้นนอก",
    flag: "🇹🇭",
    benchmarkYahoo: "SP50001.BK",
    benchmarkLabel: "SP50001 DR",
    defaultCurrency: "THB",
    defaultCapital: 100_000,
    quickTickers: ["NVDA80", "AAPL80", "MSFT80", "TSLA80", "TENCENT80", "BABA80", "BYDCOM80", "NDX01"],
  },
};

export function currencySymbol(currency: CurrencyCode | string | undefined): string {
  switch (currency) {
    case "USD":
      return "$";
    case "HKD":
      return "HK$";
    case "CNY":
      return "¥";
    case "THB":
      return "฿";
    default:
      return "$";
  }
}

export function formatPrice(price: number | null | undefined, currency?: string): string {
  if (price === null || price === undefined || !Number.isFinite(price)) return "-";
  const num = price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (currency === "THB") return `฿${num}`;
  if (currency === "HKD") return `HK$${num}`;
  if (currency === "CNY") return `¥${num}`;
  return `$${num}`;
}

function usMeta(
  symbol: string,
  name: string,
  sector: string,
  market: "SP500" | "NASDAQ100" | "CHINA",
  isIndexOrEtf = false
): GlobalStockMeta {
  return {
    symbol,
    yahooSymbol: symbol,
    tvMarket: "america",
    tvName: symbol.replace("-", "."),
    name,
    sector,
    market,
    currency: "USD",
    lotSize: 1,
    isIndexOrEtf,
  };
}

function hkMeta(code4: string, name: string, sector: string, isIndexOrEtf = false): GlobalStockMeta {
  const padded = code4.replace(/\.HK$/i, "").padStart(4, "0");
  const tvNumeric = String(Number(padded));
  return {
    symbol: `${padded}.HK`,
    yahooSymbol: `${padded}.HK`,
    tvMarket: "hongkong",
    tvName: tvNumeric,
    name,
    sector,
    market: "HK",
    currency: "HKD",
    lotSize: 100,
    isIndexOrEtf,
  };
}

function cnMeta(
  code6: string,
  suffix: "SS" | "SZ",
  name: string,
  sector: string,
  isIndexOrEtf = false
): GlobalStockMeta {
  return {
    symbol: `${code6}.${suffix}`,
    yahooSymbol: `${code6}.${suffix}`,
    tvMarket: "china",
    tvName: code6,
    name,
    sector,
    market: "CHINA",
    currency: "CNY",
    lotSize: 100,
    isIndexOrEtf,
  };
}

function drMeta(symbol: string, name: string, sector: string): GlobalStockMeta {
  return {
    symbol,
    yahooSymbol: `${symbol}.BK`,
    tvMarket: "thailand",
    tvName: symbol,
    name,
    sector,
    market: "DR",
    currency: "THB",
    lotSize: 1, // DR trades from 1 unit
    isIndexOrEtf: true,
  };
}

/** Verified live Global Indices & ETFs */
export const GLOBAL_INDICES_ETFS: GlobalStockMeta[] = [
  {
    symbol: "^GSPC",
    yahooSymbol: "^GSPC",
    tvMarket: "america",
    tvName: "SPX",
    name: "S&P 500 Index (ดัชนีหุ้นสหรัฐฯ 500 บริษัท)",
    sector: "US Index",
    market: "SP500",
    currency: "USD",
    lotSize: 1,
    isIndexOrEtf: true,
  },
  {
    symbol: "^NDX",
    yahooSymbol: "^NDX",
    tvMarket: "america",
    tvName: "NDX",
    name: "Nasdaq 100 Index (ดัชนีเทคฯ สหรัฐฯ 100 บริษัท)",
    sector: "US Tech Index",
    market: "NASDAQ100",
    currency: "USD",
    lotSize: 1,
    isIndexOrEtf: true,
  },
  {
    symbol: "^DJI",
    yahooSymbol: "^DJI",
    tvMarket: "america",
    tvName: "DJI",
    name: "Dow Jones Industrial Average (ดัชนีดาวโจนส์)",
    sector: "US Index",
    market: "SP500",
    currency: "USD",
    lotSize: 1,
    isIndexOrEtf: true,
  },
  {
    symbol: "^HSI",
    yahooSymbol: "^HSI",
    tvMarket: "hongkong",
    tvName: "HSI",
    name: "Hang Seng Index (ดัชนีฮั่งเส็ง ฮ่องกง)",
    sector: "HK Index",
    market: "HK",
    currency: "HKD",
    lotSize: 1,
    isIndexOrEtf: true,
  },
  cnMeta("000001", "SS", "Shanghai Composite Index (ดัชนีเซี่ยงไฮ้ จีนแผ่นดินใหญ่)", "China Index", true),
  cnMeta("399001", "SZ", "Shenzhen Component Index (ดัชนีเซินเจิ้น จีน)", "China Index", true),
  usMeta("SPY", "SPDR S&P 500 ETF Trust", "US Index ETF", "SP500", true),
  usMeta("VOO", "Vanguard S&P 500 ETF", "US Index ETF", "SP500", true),
  usMeta("QQQ", "Invesco QQQ Trust (Nasdaq 100 ETF)", "US Tech ETF", "NASDAQ100", true),
  hkMeta("3033", "CSOP Hang Seng TECH Index ETF", "HK Tech ETF", true),
  hkMeta("2800", "Tracker Fund of Hong Kong (HSI ETF)", "HK Index ETF", true),
  hkMeta("3188", "ChinaAMC CSI 300 Index ETF (HK)", "China A-Share ETF", true),
  usMeta("KWEB", "KraneShares CSI China Internet ETF", "China Tech ETF", "CHINA", true),
  usMeta("FXI", "iShares China Large-Cap ETF", "China Index ETF", "CHINA", true),
  usMeta("MCHI", "iShares MSCI China ETF", "China Index ETF", "CHINA", true),
  usMeta("ASHR", "Xtrackers Harvest CSI 300 China A-Shares ETF", "China A-Share ETF", "CHINA", true),
];

/** 25 Verified live International DRs traded in THB */
export const DR_UNIVERSE: GlobalStockMeta[] = [
  // US Tech & Index DRs
  drMeta("NVDA80", "DR หุ้น NVIDIA (สหรัฐฯ · กรุงไทย)", "DR หุ้นสหรัฐฯ · AI/Chip"),
  drMeta("AAPL80", "DR หุ้น Apple (สหรัฐฯ · กรุงไทย)", "DR หุ้นสหรัฐฯ · Tech"),
  drMeta("MSFT80", "DR หุ้น Microsoft (สหรัฐฯ · กรุงไทย)", "DR หุ้นสหรัฐฯ · Cloud/AI"),
  drMeta("GOOG80", "DR หุ้น Alphabet / Google (สหรัฐฯ · กรุงไทย)", "DR หุ้นสหรัฐฯ · Tech"),
  drMeta("META80", "DR หุ้น Meta Platforms (สหรัฐฯ · กรุงไทย)", "DR หุ้นสหรัฐฯ · Tech"),
  drMeta("AMZN80", "DR หุ้น Amazon (สหรัฐฯ · กรุงไทย)", "DR หุ้นสหรัฐฯ · E-Commerce"),
  drMeta("TSLA80", "DR หุ้น Tesla (สหรัฐฯ · กรุงไทย)", "DR หุ้นสหรัฐฯ · EV/AI"),
  drMeta("AMD80", "DR หุ้น AMD (สหรัฐฯ · กรุงไทย)", "DR หุ้นสหรัฐฯ · Chip"),
  drMeta("NFLX80", "DR หุ้น Netflix (สหรัฐฯ · กรุงไทย)", "DR หุ้นสหรัฐฯ · Media"),
  drMeta("SP50001", "DR กองทุนดัชนี S&P 500 (บัวหลวง)", "DR ดัชนีสหรัฐฯ"),
  drMeta("NDX01", "DR กองทุนดัชนี Nasdaq 100 (บัวหลวง)", "DR ดัชนีสหรัฐฯ"),
  // Hong Kong & China DRs
  drMeta("TENCENT80", "DR หุ้น Tencent (ฮ่องกง · กรุงไทย)", "DR หุ้นฮ่องกง/จีน · Tech"),
  drMeta("BABA80", "DR หุ้น Alibaba (ฮ่องกง/จีน · กรุงไทย)", "DR หุ้นฮ่องกง/จีน · E-Commerce"),
  drMeta("BYDCOM80", "DR หุ้น BYD (ฮ่องกง/จีน · กรุงไทย)", "DR หุ้นฮ่องกง/จีน · EV"),
  drMeta("XIAOMI80", "DR หุ้น Xiaomi (ฮ่องกง/จีน · กรุงไทย)", "DR หุ้นฮ่องกง/จีน · Tech/EV"),
  drMeta("MEITUAN80", "DR หุ้น Meituan (ฮ่องกง/จีน · กรุงไทย)", "DR หุ้นฮ่องกง/จีน · Delivery"),
  drMeta("POPMART80", "DR หุ้น Pop Mart (ฮ่องกง/จีน · กรุงไทย)", "DR หุ้นฮ่องกง/จีน · Consumer"),
  drMeta("NETEASE80", "DR หุ้น NetEase (ฮ่องกง/จีน · กรุงไทย)", "DR หุ้นฮ่องกง/จีน · Gaming"),
  drMeta("JD80", "DR หุ้น JD.com (ฮ่องกง/จีน · กรุงไทย)", "DR หุ้นฮ่องกง/จีน · E-Commerce"),
  drMeta("BIDU80", "DR หุ้น Baidu (ฮ่องกง/จีน · กรุงไทย)", "DR หุ้นฮ่องกง/จีน · AI"),
  drMeta("PINGAN80", "DR หุ้น Ping An (ฮ่องกง/จีน · กรุงไทย)", "DR หุ้นฮ่องกง/จีน · Finance"),
  drMeta("CN01", "DR กองทุนดัชนี CSI 300 จีน (บัวหลวง)", "DR ดัชนีจีน"),
  drMeta("CNTECH01", "DR กองทุนดัชนี Hang Seng Tech (บัวหลวง)", "DR ดัชนีเทคฯ ฮ่องกง/จีน"),
  drMeta("HK01", "DR กองทุนดัชนี Hang Seng (บัวหลวง)", "DR ดัชนีฮ่องกง"),
  drMeta("HKTECH13", "DR กองทุน Hang Seng Tech (เคจีไอ)", "DR ดัชนีเทคฯ ฮ่องกง/จีน"),
];

export const SP500_UNIVERSE: GlobalStockMeta[] = [
  usMeta("SPY", "SPDR S&P 500 ETF Trust", "US Index ETF", "SP500", true),
  usMeta("AAPL", "Apple Inc.", "Technology", "SP500"),
  usMeta("MSFT", "Microsoft Corp.", "Technology", "SP500"),
  usMeta("NVDA", "NVIDIA Corp.", "Semiconductors", "SP500"),
  usMeta("AMZN", "Amazon.com Inc.", "Consumer Discretionary", "SP500"),
  usMeta("GOOGL", "Alphabet Inc.", "Communication Services", "SP500"),
  usMeta("META", "Meta Platforms Inc.", "Communication Services", "SP500"),
  usMeta("TSLA", "Tesla Inc.", "Consumer Discretionary", "SP500"),
  usMeta("AVGO", "Broadcom Inc.", "Semiconductors", "SP500"),
  usMeta("BRK-B", "Berkshire Hathaway", "Financials", "SP500"),
  usMeta("LLY", "Eli Lilly & Co.", "Healthcare", "SP500"),
  usMeta("JPM", "JPMorgan Chase & Co.", "Financials", "SP500"),
  usMeta("V", "Visa Inc.", "Financials", "SP500"),
  usMeta("MA", "Mastercard Inc.", "Financials", "SP500"),
  usMeta("WMT", "Walmart Inc.", "Consumer Staples", "SP500"),
  usMeta("COST", "Costco Wholesale", "Consumer Staples", "SP500"),
  usMeta("UNH", "UnitedHealth Group", "Healthcare", "SP500"),
  usMeta("XOM", "Exxon Mobil Corp.", "Energy", "SP500"),
  usMeta("CVX", "Chevron Corp.", "Energy", "SP500"),
  usMeta("HD", "Home Depot Inc.", "Consumer Discretionary", "SP500"),
  usMeta("PG", "Procter & Gamble", "Consumer Staples", "SP500"),
  usMeta("JNJ", "Johnson & Johnson", "Healthcare", "SP500"),
  usMeta("ABBV", "AbbVie Inc.", "Healthcare", "SP500"),
  usMeta("NFLX", "Netflix Inc.", "Communication Services", "SP500"),
  usMeta("ORCL", "Oracle Corp.", "Technology", "SP500"),
  usMeta("CRM", "Salesforce Inc.", "Technology", "SP500"),
  usMeta("BAC", "Bank of America", "Financials", "SP500"),
  usMeta("GS", "Goldman Sachs", "Financials", "SP500"),
  usMeta("MS", "Morgan Stanley", "Financials", "SP500"),
  usMeta("WFC", "Wells Fargo", "Financials", "SP500"),
  usMeta("BLK", "BlackRock Inc.", "Financials", "SP500"),
  usMeta("AXP", "American Express", "Financials", "SP500"),
  usMeta("KO", "Coca-Cola Co.", "Consumer Staples", "SP500"),
  usMeta("PEP", "PepsiCo Inc.", "Consumer Staples", "SP500"),
  usMeta("MRK", "Merck & Co.", "Healthcare", "SP500"),
  usMeta("PFE", "Pfizer Inc.", "Healthcare", "SP500"),
  usMeta("AMD", "Advanced Micro Devices", "Semiconductors", "SP500"),
  usMeta("ADBE", "Adobe Inc.", "Technology", "SP500"),
  usMeta("CSCO", "Cisco Systems", "Technology", "SP500"),
  usMeta("ACN", "Accenture plc", "Technology", "SP500"),
  usMeta("IBM", "IBM Corp.", "Technology", "SP500"),
  usMeta("NOW", "ServiceNow Inc.", "Technology", "SP500"),
  usMeta("INTU", "Intuit Inc.", "Technology", "SP500"),
  usMeta("PLTR", "Palantir Technologies", "Technology", "SP500"),
  usMeta("MCD", "McDonald's Corp.", "Consumer Discretionary", "SP500"),
  usMeta("DIS", "Walt Disney Co.", "Communication Services", "SP500"),
  usMeta("NKE", "Nike Inc.", "Consumer Discretionary", "SP500"),
  usMeta("SBUX", "Starbucks Corp.", "Consumer Discretionary", "SP500"),
  usMeta("GE", "GE Aerospace", "Industrials", "SP500"),
  usMeta("CAT", "Caterpillar Inc.", "Industrials", "SP500"),
  usMeta("RTX", "RTX Corp.", "Industrials", "SP500"),
  usMeta("BA", "Boeing Co.", "Industrials", "SP500"),
  usMeta("UBER", "Uber Technologies", "Industrials", "SP500"),
  usMeta("TMO", "Thermo Fisher Scientific", "Healthcare", "SP500"),
  usMeta("ABT", "Abbott Laboratories", "Healthcare", "SP500"),
  usMeta("NEE", "NextEra Energy", "Utilities", "SP500"),
  usMeta("LOW", "Lowe's Companies", "Consumer Discretionary", "SP500"),
  usMeta("TJX", "TJX Companies", "Consumer Discretionary", "SP500"),
];

export const NASDAQ100_UNIVERSE: GlobalStockMeta[] = [
  usMeta("QQQ", "Invesco QQQ Trust (Nasdaq 100 ETF)", "US Tech ETF", "NASDAQ100", true),
  usMeta("NVDA", "NVIDIA Corp.", "Semiconductors", "NASDAQ100"),
  usMeta("AAPL", "Apple Inc.", "Technology", "NASDAQ100"),
  usMeta("MSFT", "Microsoft Corp.", "Technology", "NASDAQ100"),
  usMeta("AMZN", "Amazon.com Inc.", "Consumer Discretionary", "NASDAQ100"),
  usMeta("META", "Meta Platforms Inc.", "Communication Services", "NASDAQ100"),
  usMeta("AVGO", "Broadcom Inc.", "Semiconductors", "NASDAQ100"),
  usMeta("GOOGL", "Alphabet Inc.", "Communication Services", "NASDAQ100"),
  usMeta("TSLA", "Tesla Inc.", "Consumer Discretionary", "NASDAQ100"),
  usMeta("COST", "Costco Wholesale", "Consumer Staples", "NASDAQ100"),
  usMeta("NFLX", "Netflix Inc.", "Communication Services", "NASDAQ100"),
  usMeta("PLTR", "Palantir Technologies", "Technology", "NASDAQ100"),
  usMeta("AMD", "Advanced Micro Devices", "Semiconductors", "NASDAQ100"),
  usMeta("ASML", "ASML Holding", "Semiconductors", "NASDAQ100"),
  usMeta("QCOM", "Qualcomm Inc.", "Semiconductors", "NASDAQ100"),
  usMeta("TXN", "Texas Instruments", "Semiconductors", "NASDAQ100"),
  usMeta("AMAT", "Applied Materials", "Semiconductors", "NASDAQ100"),
  usMeta("MU", "Micron Technology", "Semiconductors", "NASDAQ100"),
  usMeta("LRCX", "Lam Research", "Semiconductors", "NASDAQ100"),
  usMeta("KLAC", "KLA Corp.", "Semiconductors", "NASDAQ100"),
  usMeta("MRVL", "Marvell Technology", "Semiconductors", "NASDAQ100"),
  usMeta("ADI", "Analog Devices", "Semiconductors", "NASDAQ100"),
  usMeta("INTC", "Intel Corp.", "Semiconductors", "NASDAQ100"),
  usMeta("ARM", "Arm Holdings", "Semiconductors", "NASDAQ100"),
  usMeta("NXPI", "NXP Semiconductors", "Semiconductors", "NASDAQ100"),
  usMeta("ADBE", "Adobe Inc.", "Technology", "NASDAQ100"),
  usMeta("CSCO", "Cisco Systems", "Technology", "NASDAQ100"),
  usMeta("INTU", "Intuit Inc.", "Technology", "NASDAQ100"),
  usMeta("PANW", "Palo Alto Networks", "Cybersecurity", "NASDAQ100"),
  usMeta("CRWD", "CrowdStrike Holdings", "Cybersecurity", "NASDAQ100"),
  usMeta("FTNT", "Fortinet Inc.", "Cybersecurity", "NASDAQ100"),
  usMeta("ZS", "Zscaler Inc.", "Cybersecurity", "NASDAQ100"),
  usMeta("DDOG", "Datadog Inc.", "Cloud/Software", "NASDAQ100"),
  usMeta("WDAY", "Workday Inc.", "Cloud/Software", "NASDAQ100"),
  usMeta("TEAM", "Atlassian Corp.", "Cloud/Software", "NASDAQ100"),
  usMeta("SNPS", "Synopsys Inc.", "Technology", "NASDAQ100"),
  usMeta("CDNS", "Cadence Design Systems", "Technology", "NASDAQ100"),
  usMeta("APP", "AppLovin Corp.", "Technology", "NASDAQ100"),
  usMeta("MSTR", "Strategy (MicroStrategy)", "Technology", "NASDAQ100"),
  usMeta("TMUS", "T-Mobile US", "Communication Services", "NASDAQ100"),
  usMeta("CMCSA", "Comcast Corp.", "Communication Services", "NASDAQ100"),
  usMeta("PEP", "PepsiCo Inc.", "Consumer Staples", "NASDAQ100"),
  usMeta("MDLZ", "Mondelez International", "Consumer Staples", "NASDAQ100"),
  usMeta("MNST", "Monster Beverage", "Consumer Staples", "NASDAQ100"),
  usMeta("ISRG", "Intuitive Surgical", "Healthcare", "NASDAQ100"),
  usMeta("AMGN", "Amgen Inc.", "Healthcare", "NASDAQ100"),
  usMeta("VRTX", "Vertex Pharmaceuticals", "Healthcare", "NASDAQ100"),
  usMeta("GILD", "Gilead Sciences", "Healthcare", "NASDAQ100"),
  usMeta("REGN", "Regeneron Pharmaceuticals", "Healthcare", "NASDAQ100"),
  usMeta("BKNG", "Booking Holdings", "Consumer Discretionary", "NASDAQ100"),
  usMeta("MELI", "MercadoLibre Inc.", "Consumer Discretionary", "NASDAQ100"),
  usMeta("ABNB", "Airbnb Inc.", "Consumer Discretionary", "NASDAQ100"),
  usMeta("DASH", "DoorDash Inc.", "Consumer Discretionary", "NASDAQ100"),
  usMeta("PYPL", "PayPal Holdings", "Financials", "NASDAQ100"),
  usMeta("PDD", "PDD Holdings (Temu/Pinduoduo)", "China E-Commerce", "NASDAQ100"),
  usMeta("HON", "Honeywell International", "Industrials", "NASDAQ100"),
  usMeta("LIN", "Linde plc", "Materials", "NASDAQ100"),
  usMeta("CEG", "Constellation Energy", "Utilities", "NASDAQ100"),
];

/** Dedicated Hong Kong (HKEX / Hang Seng) Universe */
export const HK_UNIVERSE: GlobalStockMeta[] = [
  hkMeta("3033", "CSOP Hang Seng TECH ETF", "HK Tech ETF", true),
  hkMeta("2800", "Tracker Fund of Hong Kong (HSI ETF)", "HK Index ETF", true),
  hkMeta("0700", "Tencent Holdings (เทนเซ็นต์)", "HK Tech & Gaming"),
  hkMeta("9988", "Alibaba Group HK (อาลีบาบา)", "HK E-Commerce & Cloud"),
  hkMeta("3690", "Meituan (เหม่ยถวน)", "HK Internet & Delivery"),
  hkMeta("1810", "Xiaomi Corp. (เสียวหมี่)", "HK Tech & EV"),
  hkMeta("1211", "BYD Company (บีวายดี)", "HK EV & Battery"),
  hkMeta("9618", "JD.com HK (เจดีดอทคอม)", "HK E-Commerce"),
  hkMeta("9999", "NetEase (เน็ตอีส)", "HK Tech & Gaming"),
  hkMeta("9888", "Baidu HK (ไป่ตู้)", "HK AI & Search"),
  hkMeta("0981", "SMIC (เซมิคอนดักเตอร์จีน)", "HK Semiconductors"),
  hkMeta("2015", "Li Auto HK (หลี่ออโต้)", "HK EV"),
  hkMeta("9868", "XPeng HK (เสี่ยวเผิง)", "HK EV"),
  hkMeta("9961", "Trip.com HK (ทริปดอทคอม)", "HK Travel"),
  hkMeta("9992", "Pop Mart (ป๊อปมาร์ท)", "HK Consumer"),
  hkMeta("1024", "Kuaishou (ไคว่โส่ว)", "HK Social Media"),
  hkMeta("0005", "HSBC Holdings (เอชเอสบีซี)", "HK Banking"),
  hkMeta("1299", "AIA Group (เอไอเอ ฮ่องกง)", "HK Insurance"),
  hkMeta("0388", "HKEX (ตลาดหลักทรัพย์ฮ่องกง)", "HK Financials"),
  hkMeta("0001", "CK Hutchison Holdings", "HK Conglomerate"),
  hkMeta("0669", "Techtronic Industries", "HK Industrials"),
  hkMeta("0027", "Galaxy Entertainment (กาแล็กซี มาเก๊า)", "HK Leisure & Gaming"),
  hkMeta("2318", "Ping An Insurance (ผิงอัน)", "HK Financials"),
  hkMeta("0941", "China Mobile (ไชน่าโมบาย)", "HK Telecom"),
  hkMeta("0883", "CNOOC (พลังงาน/น้ำมัน)", "HK Energy"),
  hkMeta("1398", "ICBC (ธนาคารพาณิชย์จีน)", "HK Banking"),
  hkMeta("0939", "China Construction Bank", "HK Banking"),
  hkMeta("2020", "ANTA Sports (อันต้า)", "HK Consumer"),
  hkMeta("9633", "Nongfu Spring (หนงฟูสปริง)", "HK Consumer"),
  hkMeta("6690", "Haier Smart Home (ไฮเออร์)", "HK Consumer"),
  hkMeta("0285", "BYD Electronic", "HK Electronics"),
  hkMeta("0175", "Geely Auto (จีลี่)", "HK EV"),
];

/** Dedicated Mainland China (A-Share SSE/SZSE) + China US ADRs & ETFs Universe */
export const CHINA_UNIVERSE: GlobalStockMeta[] = [
  // China Thematic ETFs
  usMeta("KWEB", "KraneShares China Internet ETF", "China Tech ETF", "CHINA", true),
  usMeta("FXI", "iShares China Large-Cap ETF", "China Index ETF", "CHINA", true),
  usMeta("MCHI", "iShares MSCI China ETF", "China Index ETF", "CHINA", true),
  usMeta("ASHR", "Xtrackers Harvest CSI 300 A-Shares ETF", "China A-Share ETF", "CHINA", true),
  // Mainland China A-Shares (Live-verified on Yahoo v8 & TradingView)
  cnMeta("600519", "SS", "Kweichow Moutai (เหมาไถ)", "China Consumer Staples"),
  cnMeta("300750", "SZ", "CATL (แบตเตอรี่ EV จีน)", "China EV & Battery"),
  cnMeta("600036", "SS", "China Merchants Bank (CMB)", "China Banking"),
  cnMeta("000858", "SZ", "Wuliangye Yibin (อู่เหลียงเย่)", "China Consumer Staples"),
  cnMeta("002594", "SZ", "BYD Co. A-Share (บีวายดี A)", "China EV & Battery"),
  cnMeta("000333", "SZ", "Midea Group (ไมเดีย กรุ๊ป)", "China Consumer"),
  cnMeta("601899", "SS", "Zijin Mining (จื่อจิน ทองคำ/โลหะ)", "China Materials"),
  cnMeta("600900", "SS", "China Yangtze Power (โรงไฟฟ้าพลังน้ำ)", "China Utilities"),
  cnMeta("601318", "SS", "Ping An Insurance A-Share (ผิงอัน A)", "China Financials"),
  cnMeta("600276", "SS", "Jiangsu Hengrui Pharma (เหิงรุ่ย)", "China Healthcare"),
  // China US ADRs (NYSE / NASDAQ)
  usMeta("BABA", "Alibaba Group ADR (อาลีบาบา)", "China E-Commerce & Cloud", "CHINA"),
  usMeta("PDD", "PDD Holdings ADR (พินตัวตัว/Temu)", "China E-Commerce", "CHINA"),
  usMeta("JD", "JD.com ADR (เจดีดอทคอม)", "China E-Commerce", "CHINA"),
  usMeta("BIDU", "Baidu ADR (ไป่ตู้)", "China AI & Search", "CHINA"),
  usMeta("NIO", "NIO Inc. ADR (นีโอ)", "China EV", "CHINA"),
  usMeta("XPEV", "XPeng Inc. ADR (เสี่ยวเผิง)", "China EV", "CHINA"),
  usMeta("LI", "Li Auto Inc. ADR (หลี่ออโต้)", "China EV", "CHINA"),
  usMeta("TCOM", "Trip.com Group ADR", "China Travel", "CHINA"),
  usMeta("FUTU", "Futu Holdings ADR", "China Fintech", "CHINA"),
  usMeta("BILI", "Bilibili Inc. ADR", "China Media", "CHINA"),
  usMeta("YUMC", "Yum China Holdings", "China Consumer", "CHINA"),
];

export function getUniverseByMarket(market: MarketId): GlobalStockMeta[] {
  switch (market) {
    case "SP500":
      return SP500_UNIVERSE;
    case "HK":
      return HK_UNIVERSE;
    case "CHINA":
      return CHINA_UNIVERSE;
    case "DR":
      return DR_UNIVERSE;
    case "NASDAQ100":
    default:
      return NASDAQ100_UNIVERSE;
  }
}

const GLOBAL_META_MAP = new Map<string, GlobalStockMeta>();
for (const idx of GLOBAL_INDICES_ETFS) {
  GLOBAL_META_MAP.set(idx.symbol, idx);
}
for (const dr of DR_UNIVERSE) {
  GLOBAL_META_MAP.set(dr.symbol, dr);
}
for (const list of [NASDAQ100_UNIVERSE, SP500_UNIVERSE, HK_UNIVERSE, CHINA_UNIVERSE]) {
  for (const item of list) {
    if (!GLOBAL_META_MAP.has(item.symbol)) {
      GLOBAL_META_MAP.set(item.symbol, item);
    }
  }
}

const DR_SET = new Set(DR_UNIVERSE.map((d) => d.symbol));
const US_AND_ADR_SET = new Set<string>([
  ...NASDAQ100_UNIVERSE.map((s) => s.symbol),
  ...SP500_UNIVERSE.map((s) => s.symbol),
  ...CHINA_UNIVERSE.filter((s) => s.tvMarket === "america").map((s) => s.symbol),
  ...GLOBAL_INDICES_ETFS.filter((s) => s.tvMarket === "america").map((s) => s.symbol),
]);

export function resolveStockSymbol(rawInput: string, hintMarket?: MarketId): GlobalStockMeta {
  const cleaned = rawInput.trim().toUpperCase().replace(/\s+/g, "");

  // 1. Direct Global Index shortcuts
  if (cleaned === "^GSPC" || cleaned === "SPX" || cleaned === "SP500" || cleaned === "S&P500") {
    return GLOBAL_META_MAP.get("^GSPC")!;
  }
  if (cleaned === "^NDX" || cleaned === "NDX" || cleaned === "NASDAQ100" || cleaned === "^IXIC") {
    return GLOBAL_META_MAP.get("^NDX")!;
  }
  if (cleaned === "^DJI" || cleaned === "DJI" || cleaned === "DOW" || cleaned === "DOWJONES") {
    return GLOBAL_META_MAP.get("^DJI")!;
  }
  if (cleaned === "^HSI" || cleaned === "HSI" || cleaned === "HANGSENG") {
    return GLOBAL_META_MAP.get("^HSI")!;
  }
  if (
    cleaned === "000001.SS" ||
    cleaned === "SSEC" ||
    cleaned === "SHANGHAI" ||
    cleaned === "000300.SS"
  ) {
    return GLOBAL_META_MAP.get("000001.SS")!;
  }
  if (cleaned === "399001.SZ" || cleaned === "SZSE" || cleaned === "SHENZHEN") {
    return GLOBAL_META_MAP.get("399001.SZ")!;
  }

  // 2. Known International DR (traded in THB)
  const strippedBk = cleaned.replace(/\.BK$/i, "");
  if (
    DR_SET.has(strippedBk) ||
    (cleaned.endsWith(".BK") && /\d{2}$/.test(strippedBk)) ||
    (hintMarket === "DR" && /\d{2}$/.test(strippedBk))
  ) {
    const knownDr = GLOBAL_META_MAP.get(strippedBk);
    if (knownDr) return knownDr;
    return drMeta(strippedBk, `DR ${strippedBk}`, "DR หุ้นต่างประเทศ");
  }

  // 3. Hong Kong HKEX codes (.HK or 3-4 digits)
  if (cleaned.endsWith(".HK") || /^\d{3,4}$/.test(cleaned)) {
    const padded = cleaned.replace(/\.HK$/i, "").padStart(4, "0");
    const sym = `${padded}.HK`;
    const known = GLOBAL_META_MAP.get(sym);
    if (known) return known;
    return hkMeta(padded, sym, "Hong Kong (HKEX)");
  }

  // 4. Mainland China A-Share codes (.SS / .SZ or 6 digits)
  if (cleaned.endsWith(".SS") || cleaned.endsWith(".SZ") || /^\d{6}$/.test(cleaned)) {
    const code6 = cleaned.replace(/\.(SS|SZ)$/i, "");
    const suffix: "SS" | "SZ" = cleaned.endsWith(".SZ")
      ? "SZ"
      : cleaned.endsWith(".SS")
        ? "SS"
        : code6.startsWith("6")
          ? "SS"
          : "SZ";
    const sym = `${code6}.${suffix}`;
    const known = GLOBAL_META_MAP.get(sym);
    if (known) return known;
    return cnMeta(code6, suffix, sym, "China A-Share");
  }

  // 5. Known global index/ETF directly
  if (GLOBAL_META_MAP.has(cleaned) && GLOBAL_META_MAP.get(cleaned)!.isIndexOrEtf) {
    return GLOBAL_META_MAP.get(cleaned)!;
  }

  // 6. Respect market hint for US / China ADR overlap (e.g. NVDA in SP500 vs NASDAQ100)
  if (hintMarket === "SP500" || hintMarket === "NASDAQ100") {
    const inPool = (hintMarket === "NASDAQ100" ? NASDAQ100_UNIVERSE : SP500_UNIVERSE).find(
      (s) => s.symbol === cleaned
    );
    if (inPool) return inPool;
    const knownUs = GLOBAL_META_MAP.get(cleaned);
    if (knownUs && knownUs.tvMarket === "america") return knownUs;
    return usMeta(cleaned, cleaned, "US Equities", hintMarket);
  }

  if (hintMarket === "CHINA") {
    const knownCn = CHINA_UNIVERSE.find((s) => s.symbol === cleaned);
    if (knownCn) return knownCn;
    return usMeta(cleaned, cleaned, "China ADR / Global", "CHINA");
  }

  if (hintMarket === "HK") {
    const knownHk = HK_UNIVERSE.find((s) => s.symbol === cleaned);
    if (knownHk) return knownHk;
  }

  // 7. Known global US/ADR symbol without hint
  if (GLOBAL_META_MAP.has(cleaned)) {
    return GLOBAL_META_MAP.get(cleaned)!;
  }

  // 8. Default fallback: US Equities (never .BK Thai SET!)
  return usMeta(cleaned, cleaned, "US Equities", "SP500");
}

export function getDefaultGlobalPeers(resolved: GlobalStockMeta): string[] {
  if (resolved.market === "DR") {
    if (/NVDA|AAPL|MSFT|GOOG|META|AMZN|TSLA|AMD|NFLX|NDX|SP500/.test(resolved.symbol)) {
      return ["NVDA80", "AAPL80", "MSFT80", "TSLA80", "NDX01", "SP50001"];
    }
    return ["TENCENT80", "BABA80", "BYDCOM80", "XIAOMI80", "CN01", "HK01"];
  }
  if (resolved.isIndexOrEtf) {
    return ["SPY", "QQQ", "2800.HK", "3033.HK", "KWEB", "ASHR"];
  }
  const customPeers: Record<string, string[]> = {
    NVDA: ["NVDA", "AMD", "AVGO", "QCOM", "MU"],
    AAPL: ["AAPL", "MSFT", "GOOGL", "AMZN", "META"],
    MSFT: ["MSFT", "AAPL", "GOOGL", "ORCL", "CRM"],
    TSLA: ["TSLA", "1211.HK", "LI", "XPEV", "NIO"],
    META: ["META", "GOOGL", "NFLX", "AMZN", "PLTR"],
    JPM: ["JPM", "BAC", "GS", "WFC", "MS"],
    LLY: ["LLY", "JNJ", "ABBV", "MRK", "UNH"],
    "0700.HK": ["0700.HK", "9988.HK", "3690.HK", "9999.HK", "1024.HK"],
    "9988.HK": ["9988.HK", "9618.HK", "3690.HK", "0700.HK", "9888.HK"],
    "1211.HK": ["1211.HK", "1810.HK", "2015.HK", "9868.HK", "0175.HK"],
    "1810.HK": ["1810.HK", "1211.HK", "0700.HK", "9988.HK", "0981.HK"],
    "0005.HK": ["0005.HK", "1299.HK", "0388.HK", "2318.HK", "1398.HK"],
    BABA: ["BABA", "PDD", "JD", "BIDU", "TCOM"],
    PDD: ["PDD", "BABA", "JD", "MELI", "AMZN"],
    "600519.SS": ["600519.SS", "000858.SZ", "300750.SZ", "000333.SZ", "600036.SS"],
    "300750.SZ": ["300750.SZ", "002594.SZ", "1211.HK", "600519.SS", "601899.SS"],
  };
  if (customPeers[resolved.symbol]) return customPeers[resolved.symbol];

  const pool = getUniverseByMarket(resolved.market);
  const sameSector = pool
    .filter(
      (s) =>
        s.sector === resolved.sector &&
        s.symbol !== resolved.symbol &&
        s.tvMarket === resolved.tvMarket
    )
    .slice(0, 4)
    .map((s) => s.symbol);
  if (sameSector.length >= 2) return [resolved.symbol, ...sameSector];

  return [
    resolved.symbol,
    ...pool
      .filter((s) => s.symbol !== resolved.symbol && s.tvMarket === resolved.tvMarket)
      .slice(0, 4)
      .map((s) => s.symbol),
  ];
}

export function extractGlobalTickersFromText(text: string): GlobalStockMeta[] {
  const found = new Map<string, GlobalStockMeta>();

  // 1. Explicit .HK / .SS / .SZ codes
  const hkMatches = text.match(/\b\d{3,4}\.HK\b/gi) ?? [];
  for (const m of hkMatches) {
    const r = resolveStockSymbol(m, "HK");
    found.set(r.symbol, r);
  }
  const cnMatches = text.match(/\b\d{6}\.(?:SS|SZ)\b/gi) ?? [];
  for (const m of cnMatches) {
    const r = resolveStockSymbol(m, "CHINA");
    found.set(r.symbol, r);
  }

  // 2. Explicit DR tickers (e.g. NVDA80, TENCENT80, NDX01, SP50001, CN01, HK01)
  const drMatches = text.toUpperCase().match(/\b[A-Z]{2,10}(?:80|01|13|19|23)\b/g) ?? [];
  for (const m of drMatches) {
    if (DR_SET.has(m)) {
      found.set(m, GLOBAL_META_MAP.get(m)!);
    }
  }

  // 3. Index / ETF / Company aliases (Thai & English)
  const aliases: [RegExp, string, MarketId][] = [
    [/\^gspc|s&p\s*500|sp500|เอสแอนด์พี/i, "^GSPC", "SP500"],
    [/\^ndx|nasdaq\s*100|แนสแด็ก/i, "^NDX", "NASDAQ100"],
    [/\^dji|dow\s*jones|ดาวโจนส์/i, "^DJI", "SP500"],
    [/\^hsi|hang\s*seng|ฮั่งเส็ง/i, "^HSI", "HK"],
    [/shanghai|เซี่ยงไฮ้|csi\s*300/i, "000001.SS", "CHINA"],
    [/shenzhen|เซินเจิ้น/i, "399001.SZ", "CHINA"],
    [/nvidia|เอ็นวิเดีย/i, "NVDA", "NASDAQ100"],
    [/apple|แอปเปิล/i, "AAPL", "NASDAQ100"],
    [/microsoft|ไมโครซอฟท์/i, "MSFT", "NASDAQ100"],
    [/tesla|เทสลา/i, "TSLA", "NASDAQ100"],
    [/amazon|อเมซอน|แอมะซอน/i, "AMZN", "NASDAQ100"],
    [/alphabet|google|กูเกิล/i, "GOOGL", "NASDAQ100"],
    [/\bmeta\b|เมต้า/i, "META", "NASDAQ100"],
    [/broadcom|บรอดคอม/i, "AVGO", "NASDAQ100"],
    [/netflix|เน็ตฟลิกซ์/i, "NFLX", "NASDAQ100"],
    [/palantir|พาแลนเทียร์/i, "PLTR", "NASDAQ100"],
    [/eli\s*lilly/i, "LLY", "SP500"],
    [/jpmorgan|jp\s*morgan/i, "JPM", "SP500"],
    [/tencent|เทนเซ็นต์/i, "0700.HK", "HK"],
    [/alibaba|อาลีบาบา/i, "9988.HK", "HK"],
    [/meituan|เหม่ยถวน/i, "3690.HK", "HK"],
    [/xiaomi|เสียวหมี่/i, "1810.HK", "HK"],
    [/\bbyd\b|บีวายดี/i, "1211.HK", "HK"],
    [/baidu|ไป่ตู้/i, "9888.HK", "HK"],
    [/pop\s*mart|ป๊อปมาร์ท/i, "9992.HK", "HK"],
    [/\bhsbc\b|เอชเอสบีซี/i, "0005.HK", "HK"],
    [/\baia\b|เอไอเอ/i, "1299.HK", "HK"],
    [/pinduoduo|temu|\bpdd\b/i, "PDD", "CHINA"],
    [/moutai|เหมาไถ/i, "600519.SS", "CHINA"],
    [/\bcatl\b/i, "300750.SZ", "CHINA"],
    [/wuliangye|อู่เหลียงเย่/i, "000858.SZ", "CHINA"],
    [/zijin|จื่อจิน/i, "601899.SS", "CHINA"],
  ];
  for (const [re, sym, mkt] of aliases) {
    if (re.test(text)) {
      if (
        (sym === "^GSPC" || sym === "^NDX" || sym === "^DJI" || sym === "^HSI") &&
        /สแกน|breakout|pullback|พอร์ตจำลอง/i.test(text) &&
        !/แนวรับ|แนวต้าน|ดัชนี/i.test(text)
      ) {
        continue;
      }
      const r = resolveStockSymbol(sym, mkt);
      found.set(r.symbol, r);
    }
  }

  // 4. Direct uppercase US/ADR/ETF tickers
  const ignoreShort = new Set([
    "V", "MA", "GE", "KO", "PG", "HD", "LI", "JD", "MU", "NOW", "APP", "ARM",
    "LOW", "CAT", "DIS", "LIN", "ALL", "USD", "THB", "HKD", "CNY", "RMB",
    "ADR", "ETF", "AI", "RSI", "EMA", "PDF", "FED", "PBOC", "MS", "BA", "ZS", "DR",
    "US", "UK", "EU", "HK", "CN", "CEO", "CFO", "IPO", "GDP", "CPI", "PCE", "FOMC",
  ]);
  const tokens = text.match(/\b[A-Z]{2,5}(?:-[A-Z])?\b/g) ?? [];
  for (const tok of tokens) {
    if (ignoreShort.has(tok)) continue;
    if (US_AND_ADR_SET.has(tok)) {
      const r = GLOBAL_META_MAP.get(tok)!;
      found.set(r.symbol, r);
    }
  }

  return Array.from(found.values());
}
