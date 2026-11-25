import * as cheerio from "cheerio";
import { getOrFetch } from "../cache";
import { extractGlobalTickersFromText, resolveStockSymbol } from "../markets";
import type { BrokerReportItem, MarketId, NewsItem } from "../types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/xml, text/xml, text/html, */*",
};

function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssXml(xml: string, fallbackSource: string, category: string, limit = 15): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  for (let i = 0; i < Math.min(itemMatches.length, limit); i++) {
    const block = itemMatches[i];
    const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const linkRaw = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "";
    const pubDateRaw = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "";
    const sourceRaw = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "";
    const descRaw = block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";

    const title = decodeXmlEntities(titleRaw);
    const link = decodeXmlEntities(linkRaw);
    if (!title || !link) continue;

    let source = decodeXmlEntities(sourceRaw) || fallbackSource;
    let cleanTitle = title;
    if (!sourceRaw && title.includes(" - ")) {
      const idx = title.lastIndexOf(" - ");
      if (idx > 10) {
        source = title.slice(idx + 3).trim();
        cleanTitle = title.slice(0, idx).trim();
      }
    }

    const parsedDate = pubDateRaw ? new Date(pubDateRaw) : new Date();
    const isoDate = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();

    const snippet = decodeXmlEntities(descRaw).slice(0, 220);
    const tickers = extractGlobalTickersFromText(`${cleanTitle} ${snippet}`)
      .filter((t) => !t.symbol.startsWith("^"))
      .map((t) => t.symbol);

    items.push({
      id: `${category}-${i}-${Buffer.from(link.slice(0, 48)).toString("base64").slice(0, 12)}`,
      title: cleanTitle,
      link,
      source,
      pubDate: isoDate,
      category,
      snippet,
      tickers,
    });
  }

  return items;
}

async function fetchRss(
  url: string,
  fallbackSource: string,
  category: string,
  limit = 12
): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const xml = await res.text();
    if (!xml.includes("<item")) return [];
    return parseRssXml(xml, fallbackSource, category, limit);
  } catch {
    return [];
  }
}

function gnewsUrl(query: string, lang: "th" | "en" = "en"): string {
  if (lang === "th") {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=th&gl=TH&ceid=TH:th`;
  }
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

/** 7 Global Financial News Categories (100% International: US, Hong Kong, China, Macro & Commodities) */
export const NEWS_CATEGORIES: {
  key: string;
  label: string;
  feeds: { url: string; source: string; limit?: number }[];
}[] = [
  {
    key: "wallstreet_calls",
    label: "1. โพย Wall Street & ปรับราคาเป้าหมาย (Goldman / MS / JPM / Citi / Nomura)",
    feeds: [
      {
        url: gnewsUrl(
          '("price target" OR "upgrade" OR "Overweight" OR "Outperform") ("Goldman Sachs" OR "Morgan Stanley" OR "JPMorgan" OR "UBS" OR "Citi" OR "Nomura") stock when:5d',
          "en"
        ),
        source: "Wall Street Calls",
        limit: 12,
      },
    ],
  },
  {
    key: "us_tech_ai",
    label: "2. หุ้นสหรัฐฯ S&P 500 · Nasdaq 100 · เทคฯ & AI Earnings",
    feeds: [
      {
        url: gnewsUrl(
          '("S&P 500" OR "Nasdaq 100" OR "Nvidia" OR "Apple" OR "Microsoft" OR "Tesla" OR "Meta" OR "Amazon") stock market earnings when:4d',
          "en"
        ),
        source: "US Equities",
        limit: 12,
      },
    ],
  },
  {
    key: "us_fed_macro",
    label: "3. นโยบาย Fed · เงินเฟ้อสหรัฐฯ · เศรษฐกิจอเมริกา & บอนด์ยีลด์ 10Y",
    feeds: [
      {
        url: gnewsUrl(
          '("Federal Reserve" OR "Powell" OR "US CPI" OR "Treasury yield" OR "US jobs") market stocks when:5d',
          "en"
        ),
        source: "US Macro & Fed",
        limit: 10,
      },
    ],
  },
  {
    key: "hk_equities",
    label: "4. ตลาดหุ้นฮ่องกง (HKEX / Hang Seng) · เทคฯ & EV (Tencent / Alibaba / BYD / Xiaomi)",
    feeds: [
      {
        url: gnewsUrl(
          '("Hang Seng" OR "HKEX" OR "Tencent" OR "Alibaba" OR "BYD" OR "Xiaomi" OR "Meituan" OR "HSBC") Hong Kong stock when:6d',
          "en"
        ),
        source: "Hong Kong HKEX",
        limit: 12,
      },
    ],
  },
  {
    key: "china_macro_stocks",
    label: "5. เศรษฐกิจจีน · PBOC · มาตรการกระตุ้น & หุ้นจีน A-Share / US ADR",
    feeds: [
      {
        url: gnewsUrl(
          '("China stocks" OR "CSI 300" OR "Shanghai Composite" OR "PBOC" OR "China stimulus" OR "PDD" OR "CATL" OR "Moutai") when:6d',
          "en"
        ),
        source: "China A-Share & ADR",
        limit: 12,
      },
    ],
  },
  {
    key: "global_trade",
    label: "6. สงครามการค้า · ภาษีนำเข้าสหรัฐฯ-จีน & ภูมิรัฐศาสตร์โลก",
    feeds: [
      {
        url: gnewsUrl(
          '("US China" OR "tariffs" OR "semiconductor export" OR "trade war") stocks market when:6d',
          "en"
        ),
        source: "Global Trade",
        limit: 10,
      },
    ],
  },
  {
    key: "commodities_fx",
    label: "7. ทองคำโลก · น้ำมันดิบ · ดอลลาร์ & อัตราแลกเปลี่ยน USD/THB",
    feeds: [
      {
        url: gnewsUrl(
          '("gold price" OR "Brent crude" OR "oil price" OR "US dollar" OR "Thai baht") market when:5d',
          "en"
        ),
        source: "Commodities & FX",
        limit: 10,
      },
    ],
  },
];

export async function fetchAllCategorizedNews(
  forceRefresh = false
): Promise<Record<string, NewsItem[]>> {
  return getOrFetch(
    "news:categorized:global:v2",
    12 * 60 * 1000,
    async () => {
      const result: Record<string, NewsItem[]> = {};
      await Promise.all(
        NEWS_CATEGORIES.map(async (cat) => {
          const arrays = await Promise.all(
            cat.feeds.map((f) => fetchRss(f.url, f.source, cat.label, f.limit ?? 10))
          );
          const merged = arrays.flat();
          const seen = new Set<string>();
          const unique = merged.filter((item) => {
            const key = item.title.slice(0, 48).toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
          result[cat.label] = unique.slice(0, 12);
        })
      );
      return result;
    },
    forceRefresh
  );
}

export async function fetchCompanyNews30D(
  symbol: string,
  forceRefresh = false,
  market: MarketId = "NASDAQ100"
): Promise<{ companyNews: NewsItem[]; brokerWebResearch: NewsItem[] }> {
  const resolved = resolveStockSymbol(symbol, market);
  const clean = resolved.symbol;

  return getOrFetch(
    `news:company:global:${resolved.market}:${clean}`,
    15 * 60 * 1000,
    async () => {
      if (resolved.market === "DR") {
        // Extract underlying global company name (e.g. "DR หุ้น NVIDIA (สหรัฐฯ)" -> "NVIDIA")
        const underlying = resolved.name
          .replace(/^DR\s*(หุ้น|กองทุนดัชนี|กองทุน)?\s*/i, "")
          .split("(")[0]
          .trim();
        const [thDrNews, globalNews, analystNews] = await Promise.all([
          fetchRss(
            gnewsUrl(`("${clean}" OR "${underlying}") (DR OR หุ้นต่างประเทศ) when:30d`, "th"),
            "ข่าว DR หุ้นนอก",
            "company_news",
            8
          ),
          fetchRss(
            gnewsUrl(`"${underlying}" stock earnings outlook when:30d`, "en"),
            "Global News",
            "company_news",
            8
          ),
          fetchRss(
            gnewsUrl(`"${underlying}" ("price target" OR "Buy" OR "Overweight" OR "upgrade") analyst when:45d`, "en"),
            "Wall Street Research",
            "broker_web",
            8
          ),
        ]);
        const merged = [...thDrNews, ...globalNews].sort(
          (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
        );
        return {
          companyNews: merged.slice(0, 10),
          brokerWebResearch: analystNews.slice(0, 8),
        };
      }

      const shortName = resolved.name
        .split("(")[0]
        .replace(/\b(Inc|Corp|Co|Ltd|Holdings|Group|plc|Company)\b\.?/gi, "")
        .trim();
      const queryTerm = shortName.length >= 3 ? `("${clean}" OR "${shortName}")` : `"${clean}"`;

      const [enNews, thNews, analystNews] = await Promise.all([
        fetchRss(
          gnewsUrl(`${queryTerm} stock earnings guidance when:30d`, "en"),
          "Global News",
          "company_news",
          10
        ),
        fetchRss(
          gnewsUrl(`${queryTerm} หุ้น when:30d`, "th"),
          "ข่าวต่างประเทศ (ไทย)",
          "company_news",
          4
        ),
        fetchRss(
          gnewsUrl(
            `${queryTerm} ("price target" OR "upgrade" OR "downgrade" OR "rating" OR "Buy" OR "Overweight") analyst when:45d`,
            "en"
          ),
          "Wall Street Research",
          "broker_web",
          10
        ),
      ]);

      const mergedNews = [...enNews, ...thNews].sort(
        (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
      );
      return {
        companyNews: mergedNews.slice(0, 10),
        brokerWebResearch: analystNews.slice(0, 8),
      };
    },
    forceRefresh
  );
}

const DR_ISSUER_PATTERNS: { code: string; pattern: RegExp }[] = [
  { code: "กรุงไทย (KTB DR80)", pattern: /กรุงไทย|KTB|80\b/i },
  { code: "บัวหลวง (BLS DR01)", pattern: /บัวหลวง|BLS|01\b/i },
  { code: "เคจีไอ (KGI DR13)", pattern: /เคจีไอ|KGI|13\b/i },
  { code: "หยวนต้า (Yuanta DR19)", pattern: /หยวนต้า|Yuanta|19\b/i },
  { code: "InnovestX (INVX)", pattern: /INVX|InnovestX|อินโนเวสท์/i },
];

export function detectRatingFromText(text: string): {
  rating: string;
  normalized: "Buy" | "Hold" | "Sell";
} {
  if (/ขาย|SELL|UNDERPERFORM|UNDERWEIGHT|DOWNGRADE|ลดน้ำหนัก/i.test(text)) {
    return { rating: "ขาย / Underperform", normalized: "Sell" };
  }
  if (
    /ถือ|HOLD|NEUTRAL|EQUAL.?WEIGHT/i.test(text) &&
    !/แนะ.?ซื้อ|เชียร์ซื้อ|OUTPERFORM|OVERWEIGHT|BUY/i.test(text)
  ) {
    return { rating: "ถือ / Neutral", normalized: "Hold" };
  }
  if (/OUTPERFORM|OVERWEIGHT/i.test(text)) {
    return { rating: "Outperform / Overweight", normalized: "Buy" };
  }
  if (/ซื้อ|BUY|UPGRADE|TOP\s*PICK|เชียร์|เด่น/i.test(text)) {
    return { rating: "ซื้อ (Buy)", normalized: "Buy" };
  }
  return { rating: "ถือ / ติดตาม", normalized: "Hold" };
}

const GLOBAL_BROKER_PATTERNS: { code: string; pattern: RegExp }[] = [
  { code: "Goldman Sachs", pattern: /Goldman\s*Sachs/i },
  { code: "Morgan Stanley", pattern: /Morgan\s*Stanley/i },
  { code: "JPMorgan", pattern: /J\.?P\.?\s*Morgan|JPMorgan/i },
  { code: "Bank of America", pattern: /Bank\s*of\s*America|BofA/i },
  { code: "Citigroup", pattern: /Citigroup|\bCiti\b/i },
  { code: "UBS", pattern: /\bUBS\b/i },
  { code: "Barclays", pattern: /Barclays/i },
  { code: "Jefferies", pattern: /Jefferies/i },
  { code: "Wedbush", pattern: /Wedbush/i },
  { code: "Bernstein", pattern: /Bernstein/i },
  { code: "HSBC", pattern: /\bHSBC\b/i },
  { code: "Wells Fargo", pattern: /Wells\s*Fargo/i },
  { code: "Mizuho", pattern: /Mizuho/i },
  { code: "Evercore ISI", pattern: /Evercore/i },
  { code: "TD Cowen", pattern: /TD\s*Cowen|Cowen/i },
  { code: "Piper Sandler", pattern: /Piper\s*Sandler/i },
  { code: "Nomura", pattern: /Nomura/i },
  { code: "CLSA", pattern: /\bCLSA\b/i },
  { code: "CICC", pattern: /\bCICC\b/i },
  { code: "Macquarie", pattern: /Macquarie/i },
  { code: "Daiwa", pattern: /Daiwa/i },
  { code: "Loop Capital", pattern: /Loop\s*Capital/i },
  { code: "Needham", pattern: /Needham/i },
  { code: "KeyBanc", pattern: /KeyBanc/i },
];

function detectGlobalBroker(text: string): string {
  for (const b of GLOBAL_BROKER_PATTERNS) {
    if (b.pattern.test(text)) return b.code;
  }
  return "Wall Street / Institutional";
}

function detectDrBroker(text: string): string {
  for (const b of DR_ISSUER_PATTERNS) {
    if (b.pattern.test(text)) return b.code;
  }
  return detectGlobalBroker(text);
}

function extractGlobalTargetPrice(text: string, refPrice?: number | null): number | null {
  const patterns = [
    /(?:price\s*target|target\s*price|PT|target)\s*(?:of|to|at|raised\s*to|cut\s*to|lowered\s*to|set\s*at)?\s*(?:US\$|HK\$|\$|RMB|¥)?\s*(\d+(?:\.\d{1,2})?)/i,
    /(?:HK\$|US\$|\$|¥)\s*(\d+(?:\.\d{1,2})?)\s*(?:price\s*target|target)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const v = Number(m[1]);
      if (Number.isFinite(v) && v > 0.5 && v < 10_000) {
        if (refPrice && refPrice > 0 && (v < refPrice * 0.35 || v > refPrice * 3.5)) continue;
        return Number(v.toFixed(2));
      }
    }
  }
  return null;
}

export async function fetchDailyBrokerResearchFeeds(
  priceLookup?: Map<string, number>,
  forceRefresh = false,
  market: MarketId = "NASDAQ100"
): Promise<BrokerReportItem[]> {
  if (market === "DR") {
    return getOrFetch(
      "news:broker:daily_research:DR:v2",
      15 * 60 * 1000,
      async () => {
        const q =
          '("DR" OR "NVDA80" OR "AAPL80" OR "MSFT80" OR "TSLA80" OR "TENCENT80" OR "BABA80" OR "BYDCOM80" OR "NDX01" OR "CN01") (หุ้นต่างประเทศ OR โบรก OR แนะนำ OR น่าสนใจ) when:14d';
        const items = await fetchRss(gnewsUrl(q, "th"), "ข่าว DR หุ้นนอก", "broker_research", 30);
        return items.map((item, idx) => {
          const matched = extractGlobalTickersFromText(`${item.title} ${item.snippet ?? ""}`);
          const sym = matched.find((m) => m.market === "DR")?.symbol ?? "NVDA80";
          const { rating, normalized } = detectRatingFromText(item.title);
          return {
            id: `dr-br-${idx}`,
            symbol: sym,
            market: "DR",
            currency: "THB",
            broker: detectDrBroker(item.title),
            rating,
            ratingNormalized: normalized,
            targetPrice: null,
            currentPrice: priceLookup?.get(sym) ?? null,
            upsidePct: null,
            reportDate: item.pubDate.slice(0, 10),
            headline: item.title,
            url: item.link,
            source: item.source,
          };
        });
      },
      forceRefresh
    );
  }

  return getOrFetch(
    `news:broker:daily_research:v2:${market}`,
    15 * 60 * 1000,
    async () => {
      const queries =
        market === "HK"
          ? [
              '("Tencent" OR "Alibaba" OR "BYD" OR "Meituan" OR "Xiaomi" OR "HSBC" OR "AIA" OR "Pop Mart" OR "HKEX") ("price target" OR "Buy" OR "Overweight" OR "Outperform") ("Goldman Sachs" OR "Morgan Stanley" OR "JPMorgan" OR "Nomura" OR "HSBC" OR "Citi" OR "UBS" OR "CLSA") when:14d',
              '("0700.HK" OR "9988.HK" OR "1211.HK" OR "1810.HK" OR "3690.HK" OR "0005.HK") analyst "price target" when:14d',
            ]
          : market === "CHINA"
            ? [
                '("Alibaba" OR "PDD" OR "JD.com" OR "Baidu" OR "NIO" OR "XPeng" OR "Li Auto" OR "Moutai" OR "CATL" OR "Trip.com") ("price target" OR "Buy" OR "Overweight" OR "Outperform") ("Goldman Sachs" OR "Morgan Stanley" OR "JPMorgan" OR "Nomura" OR "CICC" OR "Citi" OR "UBS" OR "Jefferies") when:14d',
                '("BABA" OR "PDD" OR "JD" OR "BIDU" OR "NIO" OR "XPEV" OR "600519.SS" OR "300750.SZ") analyst "price target" when:14d',
              ]
            : market === "NASDAQ100"
              ? [
                  '("NVDA" OR "AAPL" OR "MSFT" OR "AMZN" OR "META" OR "TSLA" OR "AVGO" OR "AMD" OR "PLTR" OR "NFLX" OR "GOOGL") ("price target" OR "upgrade" OR "downgrade") ("Goldman Sachs" OR "Morgan Stanley" OR "JPMorgan" OR "Wedbush" OR "UBS" OR "BofA" OR "Barclays" OR "Jefferies" OR "Citi") when:10d',
                  'Nasdaq stock analyst "price target" ("Buy" OR "Overweight" OR "Outperform") when:7d',
                ]
              : [
                  '("NVDA" OR "AAPL" OR "MSFT" OR "JPM" OR "LLY" OR "AMZN" OR "META" OR "UNH" OR "COST" OR "CRM" OR "ORCL") ("price target" OR "upgrade" OR "Overweight") ("Goldman Sachs" OR "Morgan Stanley" OR "JPMorgan" OR "Bank of America" OR "Citi" OR "Wells Fargo" OR "Barclays") when:10d',
                  '"S&P 500" stock analyst "price target" ("Buy" OR "Outperform" OR "Overweight") when:7d',
                ];

      const groups = await Promise.all(
        queries.map((q) => fetchRss(gnewsUrl(q, "en"), "Wall Street Research", "broker_research", 22))
      );
      const allItems = groups.flat();
      const reports: BrokerReportItem[] = [];
      const seen = new Set<string>();

      for (const item of allItems) {
        const text = `${item.title} ${item.snippet ?? ""}`;
        const matchedMetas = extractGlobalTickersFromText(text);
        if (matchedMetas.length === 0) continue;

        const broker = detectGlobalBroker(text);
        const { rating, normalized } = detectRatingFromText(text);

        for (const meta of matchedMetas.slice(0, 2)) {
          if (market === "HK" && meta.market !== "HK") continue;
          if (market === "CHINA" && meta.market !== "CHINA") continue;
          if ((market === "SP500" || market === "NASDAQ100") && meta.tvMarket !== "america") continue;

          const curPrice = priceLookup?.get(meta.symbol) ?? null;
          const targetPrice = extractGlobalTargetPrice(text, curPrice);
          const upsidePct =
            targetPrice && curPrice && curPrice > 0
              ? Number((((targetPrice - curPrice) / curPrice) * 100).toFixed(1))
              : null;
          const dedupeKey = `${meta.symbol}|${broker}|${item.title.slice(0, 32)}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          reports.push({
            id: `gbr-${meta.symbol}-${reports.length}`,
            symbol: meta.symbol,
            market,
            currency: meta.currency,
            broker,
            rating,
            ratingNormalized: normalized,
            targetPrice,
            currentPrice: curPrice,
            upsidePct,
            reportDate: item.pubDate.slice(0, 10),
            headline: item.title,
            url: item.link,
            source: item.source,
          });
        }
      }

      reports.sort((a, b) => {
        const dateDiff = b.reportDate.localeCompare(a.reportDate);
        if (dateDiff !== 0) return dateDiff;
        return (b.targetPrice ? 1 : 0) - (a.targetPrice ? 1 : 0);
      });
      return reports.slice(0, 80);
    },
    forceRefresh
  );
}

/** SSRF-safe public article fetcher for Tab 1B Custom News URL Analysis */
export async function fetchPublicArticleContent(rawUrl: string): Promise<{
  title: string;
  text: string;
  ok: boolean;
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("รูปแบบ URL ไม่ถูกต้อง");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("รองรับเฉพาะลิงก์ http หรือ https เท่านั้น");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    throw new Error("ไม่อนุญาตให้ดึงข้อมูลจาก Private/Local URL");
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: HEADERS,
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return { title: "", text: "", ok: false };
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, aside, iframe, noscript").remove();
    const title = $("title").text().trim() || $("h1").first().text().trim();
    const paragraphs = $("article p, main p, p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((p) => p.length > 25);
    const text = paragraphs.join("\n").slice(0, 4500);
    return { title, text, ok: text.length > 40 };
  } catch {
    return { title: "", text: "", ok: false };
  }
}
