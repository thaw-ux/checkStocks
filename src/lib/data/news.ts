import * as cheerio from "cheerio";
import { getOrFetch } from "../cache";
import { extractThaiTickersFromText, getStockMeta } from "../set50";
import type { BrokerReportItem, NewsItem } from "../types";

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
    // Google News titles often end with " - SourceName"
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
    const tickers = extractThaiTickersFromText(`${cleanTitle} ${snippet}`);

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

function gnewsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=th&gl=TH&ceid=TH:th`;
}

export const NEWS_CATEGORIES: {
  key: string;
  label: string;
  feeds: { url: string; source: string; limit?: number }[];
}[] = [
  {
    key: "broker_picks",
    label: "1. บทวิเคราะห์ & โพยหุ้นเด่นเช้าโบรกเกอร์ (KS / KSS / INVX / FSSIA / DAOL / BLS)",
    feeds: [
      {
        url: gnewsUrl('("บล." OR โบรกเกอร์) ("แนะซื้อ" OR "หุ้นเด่น" OR "ราคาเป้าหมาย" OR "Top Pick") หุ้นไทย when:5d'),
        source: "โพยโบรกเกอร์",
        limit: 12,
      },
    ],
  },
  {
    key: "thai_stock_media",
    label: "2. ข่าวหุ้นสายโพยโบรก (มิติหุ้น · ข่าวหุ้น · ทันหุ้น · HoonSmart · efin)",
    feeds: [
      { url: "https://www.kaohoon.com/feed", source: "ข่าวหุ้นธุรกิจ", limit: 6 },
      { url: "https://hoonsmart.com/feed", source: "HoonSmart", limit: 6 },
      { url: "https://www.mitihoon.com/feed", source: "มิติหุ้น", limit: 6 },
    ],
  },
  {
    key: "trade_mainstream",
    label: "3. ดีลการค้าโลก ภาษีนำเข้า & สื่อหลักไทย (ประชาชาติ / กรุงเทพธุรกิจ / MGR)",
    feeds: [
      {
        url: gnewsUrl('(ภาษีนำเข้า OR ส่งออกไทย OR สงครามการค้า) (ประชาชาติธุรกิจ OR กรุงเทพธุรกิจ OR ผู้จัดการ) when:7d'),
        source: "สื่อธุรกิจไทย",
        limit: 8,
      },
    ],
  },
  {
    key: "politics_policy",
    label: "4. ข่าวการเมือง & นโยบายภาครัฐ",
    feeds: [
      {
        url: gnewsUrl('(ครม. OR รัฐบาล OR มาตรการกระตุ้นเศรษฐกิจ OR กระทรวงการคลัง) หุ้น OR เศรษฐกิจ when:7d'),
        source: "นโยบายรัฐ",
        limit: 7,
      },
    ],
  },
  {
    key: "thai_macro",
    label: "5. ข่าวเศรษฐกิจไทย การค้า & การเงิน (กนง. / ธปท. / GDP)",
    feeds: [
      {
        url: gnewsUrl('(กนง. OR ธปท. OR ดอกเบี้ยนโยบาย OR เงินเฟ้อไทย OR ค่าเงินบาท) when:7d'),
        source: "เศรษฐกิจไทย",
        limit: 7,
      },
    ],
  },
  {
    key: "global_macro",
    label: "6. ข่าวตลาดโลก เฟด ทองคำ & น้ำมัน",
    feeds: [
      {
        url: gnewsUrl('(เฟด OR ดอกเบี้ยสหรัฐ OR ราคาทองคำ OR ราคาน้ำมันดิบ OR ตลาดหุ้นสหรัฐ) when:5d'),
        source: "ตลาดโลก",
        limit: 8,
      },
    ],
  },
  {
    key: "tourism_consumer",
    label: "7. ข่าวสังคม ท่องเที่ยว เกษตร & กำลังซื้อ",
    feeds: [
      {
        url: gnewsUrl('(นักท่องเที่ยวต่างชาติ OR ท่องเที่ยวไทย OR กำลังซื้อ OR ค้าปลีกไทย) when:7d'),
        source: "ท่องเที่ยว/บริโภค",
        limit: 7,
      },
    ],
  },
];

export async function fetchAllCategorizedNews(
  forceRefresh = false
): Promise<Record<string, NewsItem[]>> {
  return getOrFetch(
    "news:categorized:all",
    12 * 60 * 1000,
    async () => {
      const result: Record<string, NewsItem[]> = {};
      await Promise.all(
        NEWS_CATEGORIES.map(async (cat) => {
          const arrays = await Promise.all(
            cat.feeds.map((f) => fetchRss(f.url, f.source, cat.label, f.limit ?? 8))
          );
          const merged = arrays.flat();
          // Deduplicate by title prefix
          const seen = new Set<string>();
          const unique = merged.filter((item) => {
            const key = item.title.slice(0, 48).toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
          result[cat.label] = unique.slice(0, 14);
        })
      );
      return result;
    },
    forceRefresh
  );
}

export async function fetchCompanyNews30D(
  symbol: string,
  forceRefresh = false
): Promise<{ companyNews: NewsItem[]; brokerWebResearch: NewsItem[] }> {
  const clean = symbol.toUpperCase();
  const meta = getStockMeta(clean);

  return getOrFetch(
    `news:company:${clean}`,
    15 * 60 * 1000,
    async () => {
      const [newsRaw, brokerRaw] = await Promise.all([
        fetchRss(
          gnewsUrl(`("${clean}" OR "${meta.nameTh}") (หุ้น OR กำไร OR งบ OR ปันผล OR เป้าหมาย) when:30d`),
          "ข่าวบริษัท",
          "company_news",
          14
        ),
        fetchRss(
          gnewsUrl(`"${clean}" ("บล." OR "ราคาเป้าหมาย" OR "โบรก" OR "Outperform" OR "แนะซื้อ") when:45d`),
          "บทวิเคราะห์โบรกเกอร์",
          "broker_web",
          10
        ),
      ]);

      // Ensure relevance by matching symbol or Thai company name
      const nameFragment = meta.nameTh.slice(0, 8);
      const isRelevant = (item: NewsItem) => {
        const hay = `${item.title} ${item.snippet ?? ""}`.toUpperCase();
        return (
          new RegExp(`\\b${clean}\\b`).test(hay) ||
          (nameFragment.length >= 3 && hay.includes(nameFragment.toUpperCase()))
        );
      };

      return {
        companyNews: newsRaw.filter(isRelevant).slice(0, 10),
        brokerWebResearch: brokerRaw.filter(isRelevant).slice(0, 8),
      };
    },
    forceRefresh
  );
}

// Thai Broker Name Matcher (20+ Thai Brokers)
const BROKER_PATTERNS: { code: string; pattern: RegExp }[] = [
  { code: "INVX (อินโนเวสท์ เอกซ์)", pattern: /INVX|อินโนเวสท์\s*เอกซ์|InnovestX/i },
  { code: "KS (กสิกรไทย)", pattern: /บล\.?\s*กสิกร|\bKS\b|Kasikorn\s*Securities/i },
  { code: "KSS (กรุงศรี)", pattern: /บล\.?\s*กรุงศรี|\bKSS\b|Krungsri\s*Securities/i },
  { code: "FSSIA (ฟินันเซีย)", pattern: /FSSIA|ฟินันเซีย|Finansia/i },
  { code: "BLS (บัวหลวง)", pattern: /บล\.?\s*บัวหลวง|\bBLS\b|Bualuang/i },
  { code: "DAOLSEC (ดาโอ)", pattern: /DAOL|ดาโอ/i },
  { code: "MST (เมย์แบงก์)", pattern: /เมย์แบงก์|Maybank|\bMST\b/i },
  { code: "TISCO (ทิสโก้)", pattern: /บล\.?\s*ทิสโก้|TISCO\s*Sec/i },
  { code: "YUANTA (หยวนต้า)", pattern: /หยวนต้า|Yuanta/i },
  { code: "PI (พาย)", pattern: /บล\.?\s*พาย|Pi\s*Securities/i },
  { code: "KGI (เคจีไอ)", pattern: /บล\.?\s*เคจีไอ|\bKGI\b/i },
  { code: "ASPS (เอเซีย พลัส)", pattern: /เอเซีย\s*พลัส|\bASPS\b|Asia\s*Plus/i },
  { code: "CGSI (ซีจีเอส)", pattern: /ซีจีเอส|CGSI|CGS\s*International/i },
  { code: "TRINITY (ทรีนีตี้)", pattern: /ทรีนีตี้|Trinity/i },
  { code: "UOBKH (ยูโอบี)", pattern: /ยูโอบี|UOBKH/i },
  { code: "GLOBLEX (โกลเบล็ก)", pattern: /โกลเบล็ก|Globlex/i },
  { code: "LIB (ลิเบอเรเตอร์)", pattern: /ลิเบอเรเตอร์|Liberator/i },
  { code: "DBS (ดีบีเอส)", pattern: /ดีบีเอส|DBSV|DBS\s*Vickers/i },
  { code: "PST (ฟิลลิป)", pattern: /ฟิลลิป|Phillip/i },
  { code: "CNS (กรุงศรี พัฒนสิน)", pattern: /พัฒนสิน|\bCNS\b/i },
  { code: "BYD (บียอนด์)", pattern: /บล\.?\s*บียอนด์|Beyond\s*Sec/i },
  { code: "KTX (กรุงไทย เอ็กซ์สปริง)", pattern: /กรุงไทย\s*เอ็กซ์สปริง|\bKTX\b/i },
];

export function detectBrokerName(text: string): string {
  for (const b of BROKER_PATTERNS) {
    if (b.pattern.test(text)) return b.code;
  }
  return "Consensus / รวมโบรกเกอร์";
}

export function extractTargetPriceFromText(text: string, referencePrice?: number | null): number | null {
  const patterns = [
    /(?:ราคาเป้าหมาย|เป้าราคา|เคาะเป้า(?:สูงสุด)?|ให้เป้า|เป้าหมาย(?:ปี\s*\d+)?|Target(?:\s*Price)?|TP)\s*(?:ที่|ใหม่|เดิม|ราว|อยู่ที่)?\s*(\d+(?:\.\d{1,2})?)\s*(?:บาท|บ\.|THB)?/i,
    /เป้า\s*(\d+(?:\.\d{1,2})?)\s*(?:บาท|บ\.)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const val = Number(m[1]);
      if (Number.isFinite(val) && val > 0.1 && val < 2000) {
        if (referencePrice && referencePrice > 0) {
          // Sanity check: target within 0.3x - 3.5x of current price (avoid mistaking year '69' or '2570' or profit '220 ล.')
          if (val < referencePrice * 0.35 || val > referencePrice * 3.5) continue;
        }
        return Number(val.toFixed(2));
      }
    }
  }
  return null;
}

export function detectRatingFromText(text: string): {
  rating: string;
  normalized: "Buy" | "Hold" | "Sell";
} {
  if (/ขาย|SELL|UNDERPERFORM|ลดน้ำหนัก/i.test(text)) {
    return { rating: "ขาย / Underperform", normalized: "Sell" };
  }
  if (/ถือ|HOLD|NEUTRAL|TRADING/i.test(text) && !/แนะ.?ซื้อ|เชียร์ซื้อ|OUTPERFORM|BUY/i.test(text)) {
    return { rating: "ถือ / Neutral", normalized: "Hold" };
  }
  if (/OUTPERFORM/i.test(text)) {
    return { rating: "Outperform", normalized: "Buy" };
  }
  if (/ซื้อ|BUY|เชียร์|โดดเด่น|หุ้นเด่น|TOP\s*PICK/i.test(text)) {
    return { rating: "ซื้อ (Buy)", normalized: "Buy" };
  }
  return { rating: "ถือ / ติดตาม", normalized: "Hold" };
}

export async function fetchDailyBrokerResearchFeeds(
  priceLookup?: Map<string, number>,
  forceRefresh = false
): Promise<BrokerReportItem[]> {
  return getOrFetch(
    "news:broker:daily_research",
    15 * 60 * 1000,
    async () => {
      const queries = [
        '("ราคาเป้าหมาย" OR "เคาะเป้า") ("บล." OR โบรก) ("ซื้อ" OR "Outperform" OR "ถือ" OR "ขาย") when:14d',
        '("บล.ดาโอ" OR "บล.กสิกร" OR "บล.กรุงศรี" OR "บล.บัวหลวง" OR "บล.หยวนต้า" OR "บล.ฟินันเซีย" OR "อินโนเวสท์ เอกซ์") เป้าหมาย หุ้น when:14d',
        '("บล.พาย" OR "บล.เคจีไอ" OR "บล.เอเซีย พลัส" OR "บล.ทิสโก้" OR "บล.เมย์แบงก์" OR "บล.ทรีนีตี้" OR "บล.ยูโอบี") ราคาเป้าหมาย when:14d',
        '(site:kaohoon.com OR site:thunhoon.com OR site:hoonsmart.com OR site:mitihoon.com OR site:efinancethai.com) ("เป้า" OR "โบรก") ("ซื้อ" OR "ถือ") when:7d',
      ];

      const [feedGroups, kaohoon, hoonsmart, mitihoon] = await Promise.all([
        Promise.all(queries.map((q) => fetchRss(gnewsUrl(q), "โบรกเกอร์", "broker_research", 18))),
        fetchRss("https://www.kaohoon.com/feed", "ข่าวหุ้นธุรกิจ", "broker_research", 15),
        fetchRss("https://hoonsmart.com/feed", "HoonSmart", "broker_research", 15),
        fetchRss("https://www.mitihoon.com/feed", "มิติหุ้น", "broker_research", 20),
      ]);

      const allItems = [...feedGroups.flat(), ...kaohoon, ...hoonsmart, ...mitihoon];
      const reports: BrokerReportItem[] = [];
      const seenKey = new Set<string>();

      for (const item of allItems) {
        const text = `${item.title} ${item.snippet ?? ""}`;
        // Must look like analyst/broker commentary
        if (!/บล\.|โบรก|เป้า|ซื้อ|Outperform|ถือ|ขาย|Analyst|Target|แนะนำ/i.test(text)) {
          continue;
        }
        const tickers = extractThaiTickersFromText(text);
        if (tickers.length === 0) continue;

        const broker = detectBrokerName(text);
        const { rating, normalized } = detectRatingFromText(text);

        for (const sym of tickers.slice(0, 2)) {
          const curPrice = priceLookup?.get(sym) ?? null;
          const targetPrice = extractTargetPriceFromText(text, curPrice);
          const upsidePct =
            targetPrice && curPrice && curPrice > 0
              ? Number((((targetPrice - curPrice) / curPrice) * 100).toFixed(1))
              : null;

          const dedupeKey = `${sym}|${broker}|${item.title.slice(0, 32)}`;
          if (seenKey.has(dedupeKey)) continue;
          seenKey.add(dedupeKey);

          reports.push({
            id: `br-${sym}-${reports.length}`,
            symbol: sym,
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
        // Prioritize reports with explicit target price & recent date
        const dateDiff = b.reportDate.localeCompare(a.reportDate);
        if (dateDiff !== 0) return dateDiff;
        return (b.targetPrice ? 1 : 0) - (a.targetPrice ? 1 : 0);
      });

      return reports.slice(0, 120);
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
