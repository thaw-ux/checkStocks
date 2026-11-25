import { GoogleGenAI } from "@google/genai";
import {
  currencySymbol,
  extractGlobalTickersFromText,
  formatPrice,
  MARKET_CONFIGS,
  resolveStockSymbol,
} from "../markets";
import type {
  AffectedStockItem,
  BrokerReportItem,
  CurrencyCode,
  DailyBriefingSection,
  GlobalMacroItem,
  IaaConsensusSummary,
  NewsImpactResult,
  NewsItem,
  PdfQuoteExtract,
  PointInTimeReplayResult,
  StockAiSynthesis,
  StockFundamentals,
  StockTechnicalSummary,
} from "../types";

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getProModelName(override?: string): string {
  const clean = override?.trim();
  if (clean && /^gemini-[a-z0-9.\-]+$/i.test(clean)) return clean;
  return process.env.GEMINI_MODEL_PRO?.trim() || "gemini-2.5-pro";
}

export function getFlashModelName(override?: string): string {
  const clean = override?.trim();
  if (clean && /^gemini-[a-z0-9.\-]+$/i.test(clean)) return clean;
  return process.env.GEMINI_MODEL_FAST?.trim() || "gemini-2.5-flash";
}

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  // Auto-detect Vertex AI Express Mode API keys (prefix "AQ.") vs Google AI Studio keys ("AIza...")
  const useVertexAi =
    apiKey.startsWith("AQ.") || process.env.GOOGLE_GENAI_USE_VERTEXAI === "true";
  return useVertexAi ? new GoogleGenAI({ vertexai: true, apiKey }) : new GoogleGenAI({ apiKey });
}

function parseJsonSafe<T>(raw: string): T | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function generateDailyBriefingAI(params: {
  macroCards: GlobalMacroItem[];
  categorizedNews: Record<string, NewsItem[]>;
  modelOverride?: string;
}): Promise<{
  headline: string;
  mood: "Risk-On" | "Neutral" | "Risk-Off";
  sections: DailyBriefingSection[];
  affectedStocks: AffectedStockItem[];
  modelUsed: string;
  isAiGenerated: boolean;
}> {
  const { macroCards, categorizedNews, modelOverride } = params;
  const spCard = macroCards.find((m) => m.symbol === "^GSPC");
  const ndxCard = macroCards.find((m) => m.symbol === "^NDX");
  const hsiCard = macroCards.find((m) => m.symbol === "^HSI");
  const shCard = macroCards.find((m) => m.symbol === "000001.SS");
  const vixCard = macroCards.find((m) => m.symbol === "^VIX");
  const goldCard = macroCards.find((m) => m.symbol === "GC=F");
  const oilCard = macroCards.find((m) => m.symbol === "BZ=F");
  const tnxCard = macroCards.find((m) => m.symbol === "^TNX");
  const usdThbCard = macroCards.find((m) => m.symbol === "THB=X");
  const hkdThbCard = macroCards.find((m) => m.symbol === "HKDTHB=X");

  // Count international tickers mentioned across today's global news
  const tickerFreq = new Map<string, number>();
  for (const list of Object.values(categorizedNews)) {
    for (const item of list) {
      for (const t of item.tickers ?? []) {
        if (t.startsWith("^")) continue;
        tickerFreq.set(t, (tickerFreq.get(t) ?? 0) + 1);
      }
    }
  }
  const topNewsTickers = Array.from(tickerFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([sym]) => sym);

  const defaultSymbols =
    topNewsTickers.length >= 4
      ? topNewsTickers
      : ["NVDA", "AAPL", "MSFT", "TSLA", "0700.HK", "9988.HK", "1211.HK", "600519.SS"];

  const defaultAffected: AffectedStockItem[] = defaultSymbols.map((sym) => {
    const meta = resolveStockSymbol(sym);
    const usPositive = (spCard?.changePct ?? 0) >= 0;
    const hkPositive = (hsiCard?.changePct ?? 0) >= 0;
    const sentiment: AffectedStockItem["sentiment"] =
      meta.market === "HK" || meta.market === "CHINA"
        ? hkPositive
          ? "positive"
          : "neutral"
        : usPositive
          ? "positive"
          : "neutral";
    return {
      symbol: meta.symbol,
      market: meta.market,
      currency: meta.currency,
      sector: meta.sector,
      sentiment,
      reason: `ถูกกล่าวถึงในพาดหัวข่าวตลาดโลกและเชื่อมโยงกับความเคลื่อนไหวกลุ่ม ${meta.sector}`,
    };
  });

  const moodDefault: "Risk-On" | "Neutral" | "Risk-Off" =
    (spCard?.changePct ?? 0) > 0.35 && (ndxCard?.changePct ?? 0) > 0.35 && (vixCard?.price ?? 18) < 22
      ? "Risk-On"
      : (spCard?.changePct ?? 0) < -0.7 || (ndxCard?.changePct ?? 0) < -1.0 || (vixCard?.price ?? 18) > 25
        ? "Risk-Off"
        : "Neutral";

  const fallbackSections: DailyBriefingSection[] = [
    {
      key: "us_mood",
      title: "1. ภาพรวมตลาดสหรัฐฯ & โหมดความเสี่ยงโลก",
      content: `ดัชนี S&P 500 อยู่ที่ ${spCard?.price?.toFixed(2) ?? "-"} (${(spCard?.changePct ?? 0) >= 0 ? "+" : ""}${spCard?.changePct?.toFixed(2) ?? "0"}%) และ Nasdaq 100 อยู่ที่ ${ndxCard?.price?.toFixed(2) ?? "-"} (${(ndxCard?.changePct ?? 0) >= 0 ? "+" : ""}${ndxCard?.changePct?.toFixed(2) ?? "0"}%) ขณะที่ VIX อยู่ที่ ${vixCard?.price?.toFixed(2) ?? "-"} สะท้อนโหมดตลาด ${moodDefault}`,
    },
    {
      key: "us_tech",
      title: "2. หุ้นเทคฯ AI & กลุ่มนำตลาดสหรัฐฯ",
      content: `ติดตามกลุ่มชิป AI, Cloud และ Mega-Cap Tech (NVDA, AAPL, MSFT, META, AVGO) รวมถึงรายงานปรับราคาเป้าหมายล่าสุดจาก Wall Street ในแท็บพาดหัวข่าวด้านล่าง`,
    },
    {
      key: "hk_china",
      title: "3. ตลาดฮ่องกง (HKEX) & หุ้นจีน (A-Share / ADR)",
      content: `Hang Seng ฮ่องกงเคลื่อนไหวที่ ${hsiCard?.price?.toFixed(2) ?? "-"} (${(hsiCard?.changePct ?? 0) >= 0 ? "+" : ""}${hsiCard?.changePct?.toFixed(2) ?? "0"}%) และ Shanghai Composite ที่ ${shCard?.price?.toFixed(2) ?? "-"} (${(shCard?.changePct ?? 0) >= 0 ? "+" : ""}${shCard?.changePct?.toFixed(2) ?? "0"}%) จับตาแรงซื้อหุ้นเทคฯ ฮ่องกง (0700.HK, 9988.HK, 1211.HK) และจีนแผ่นดินใหญ่`,
    },
    {
      key: "fed_pboc",
      title: "4. นโยบาย Fed · บอนด์ยีลด์ 10Y & PBOC",
      content: `บอนด์ยีลด์สหรัฐฯ 10 ปีอยู่ที่ ${tnxCard?.price?.toFixed(2) ?? "-"}% เป็นตัวแปรหลักต่อ Valuation หุ้น Growth สหรัฐฯ ควบคู่มาตรการสภาพคล่องและกระตุ้นเศรษฐกิจจากฝั่งจีน`,
    },
    {
      key: "commodities_fx",
      title: "5. ทองคำ · น้ำมัน & ค่าเงินบาท (USD/THB · HKD/THB)",
      content: `ทองคำโลกอยู่ที่ ${goldCard?.price?.toFixed(2) ?? "-"} USD, น้ำมัน Brent ${oilCard?.price?.toFixed(2) ?? "-"} USD ขณะที่อัตราแลกเปลี่ยน USD/THB อยู่ที่ ${usdThbCard?.price?.toFixed(2) ?? "-"} ฿ และ HKD/THB อยู่ที่ ${hkdThbCard?.price?.toFixed(2) ?? "-"} ฿ (มีผลโดยตรงต่อต้นทุนแลกเงินและราคา DR)`,
    },
    {
      key: "trade_dr",
      title: "6. ภาษีการค้าโลก & มุมมอง DR หุ้นต่างประเทศ",
      content: `ติดตามความเคลื่อนไหวกำแพงภาษีนำเข้าและการจำกัดส่งออกชิประหว่างสหรัฐฯ-จีน ซึ่งส่งผลต่อทั้งหุ้นสหรัฐฯ/ฮ่องกง/จีน และราคา DR หุ้นนอก (NVDA80, TENCENT80, BABA80, NDX01) — ใส่ GEMINI_API_KEY เพื่อเปิดระบบสังเคราะห์ข่าว AI เต็มรูปแบบ`,
    },
  ];

  const client = getClient();
  const model = getFlashModelName(modelOverride);
  if (!client) {
    return {
      headline: `Global Morning Briefing (${moodDefault}) — สหรัฐฯ · ฮ่องกง · จีน (โหมดข้อมูลสด)`,
      mood: moodDefault,
      sections: fallbackSections,
      affectedStocks: defaultAffected,
      modelUsed: "Rule-Based Fallback",
      isAiGenerated: false,
    };
  }

  try {
    const macroText = macroCards
      .map((m) => `- ${m.labelTh}: ${m.price} (${m.changePct >= 0 ? "+" : ""}${m.changePct}%)`)
      .join("\n");

    const newsDigest = Object.entries(categorizedNews)
      .map(([cat, list]) => {
        const lines = list
          .slice(0, 5)
          .map((n) => `  * ${n.title} [${n.source}]`)
          .join("\n");
        return `### ${cat}\n${lines}`;
      })
      .join("\n\n");

    const prompt = `คุณคือนักกลยุทธ์การลงทุนหุ้นต่างประเทศอาวุโส (Global Equity Strategist) เชี่ยวชาญตลาดสหรัฐฯ (S&P 500, Nasdaq 100), ฮ่องกง (HKEX), จีน (A-Share & US ADR) และ DR หุ้นต่างประเทศ
หน้าที่ของคุณคือสรุป Global Morning Briefing ประจำวันเป็นภาษาไทย 100% ที่กระชับ คมชัด อ่านจบใน 1 นาที โดยยึดเฉพาะข้อเท็จจริงจากตัวเลขตลาดและพาดหัวข่าวต่างประเทศด้านล่าง ห้ามแต่งตัวเลขขึ้นเอง และห้ามพูดถึงหุ้นไทย SET (ยกเว้น DR หุ้นนอกถ้าเกี่ยวข้อง)

ข้อมูลดัชนีตลาดโลกและอัตราแลกเปลี่ยนล่าสุด:
${macroText}

พาดหัวข่าวการเงินต่างประเทศล่าสุดแยก 7 หมวด:
${newsDigest}

ตอบกลับเป็น JSON ตามโครงสร้างนี้เท่านั้น (ห้ามมีข้อความนอก JSON):
{
  "headline": "พาดหัวสรุปภาวะตลาดหุ้นโลก สหรัฐฯ-ฮ่องกง-จีน วันนี้ 1 บรรทัดแบบคมชัด",
  "mood": "Risk-On" | "Neutral" | "Risk-Off",
  "sections": [
    { "key": "us_mood", "title": "1. ภาพรวมตลาดสหรัฐฯ & โหมดความเสี่ยงโลก", "content": "..." },
    { "key": "us_tech", "title": "2. หุ้นเทคฯ AI & กลุ่มนำตลาดสหรัฐฯ", "content": "..." },
    { "key": "hk_china", "title": "3. ตลาดฮ่องกง (HKEX) & หุ้นจีน (A-Share / ADR)", "content": "..." },
    { "key": "fed_pboc", "title": "4. นโยบาย Fed · บอนด์ยีลด์ 10Y & PBOC", "content": "..." },
    { "key": "commodities_fx", "title": "5. ทองคำ · น้ำมัน & ค่าเงินบาท (USD/THB · HKD/THB)", "content": "..." },
    { "key": "trade_dr", "title": "6. ภาษีการค้าโลก & มุมมอง DR หุ้นต่างประเทศ", "content": "..." }
  ],
  "affectedStocks": [
    { "symbol": "NVDA", "sector": "Semiconductors", "sentiment": "positive" | "neutral" | "negative", "reason": "เหตุผลสั้นๆ 1 ประโยคเป็นภาษาไทย" }
  ]
}
ให้เลือก affectedStocks 6-8 หุ้นต่างประเทศจริงผสมกันระหว่างสหรัฐฯ (เช่น NVDA, AAPL, MSFT, TSLA, META, JPM), ฮ่องกง (เช่น 0700.HK, 9988.HK, 1211.HK, 1810.HK, 3690.HK), จีน A-Share/ADR (เช่น BABA, PDD, 600519.SS, 300750.SZ) หรือ DR (เช่น NVDA80, TENCENT80) ที่เชื่อมโยงกับข่าววันนี้มากที่สุด`;

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.2 },
    });

    const parsed = parseJsonSafe<{
      headline?: string;
      mood?: "Risk-On" | "Neutral" | "Risk-Off";
      sections?: DailyBriefingSection[];
      affectedStocks?: AffectedStockItem[];
    }>(response.text ?? "");

    if (!parsed || !parsed.sections || parsed.sections.length < 4) {
      throw new Error("Invalid JSON from Gemini");
    }

    const normalizedAffected =
      parsed.affectedStocks && parsed.affectedStocks.length > 0
        ? parsed.affectedStocks.slice(0, 8).map((item) => {
            const meta = resolveStockSymbol(item.symbol);
            return {
              ...item,
              symbol: meta.symbol,
              market: meta.market,
              currency: meta.currency,
            };
          })
        : defaultAffected;

    return {
      headline: parsed.headline || `Global Morning Briefing (${parsed.mood ?? moodDefault})`,
      mood: parsed.mood ?? moodDefault,
      sections: parsed.sections,
      affectedStocks: normalizedAffected,
      modelUsed: model,
      isAiGenerated: true,
    };
  } catch {
    return {
      headline: `Global Morning Briefing (${moodDefault}) — สหรัฐฯ · ฮ่องกง · จีน`,
      mood: moodDefault,
      sections: fallbackSections,
      affectedStocks: defaultAffected,
      modelUsed: "Rule-Based Fallback",
      isAiGenerated: false,
    };
  }
}

export async function analyzeNewsImpactAI(params: {
  text: string;
  sourceUrl?: string;
  modelOverride?: string;
}): Promise<NewsImpactResult> {
  const { text, sourceUrl, modelOverride } = params;
  const detectedMetas = extractGlobalTickersFromText(text);
  const client = getClient();
  const model = getFlashModelName(modelOverride);

  const buildFallbackStocks = (): AffectedStockItem[] => {
    const base =
      detectedMetas.length > 0
        ? detectedMetas
        : ["NVDA", "AAPL", "0700.HK", "9988.HK", "BABA", "NVDA80"].map((s) => resolveStockSymbol(s));
    return base.slice(0, 6).map((meta) => ({
      symbol: meta.symbol,
      market: meta.market,
      currency: meta.currency,
      sector: meta.sector,
      sentiment: /ลดเป้า|ร่วง|เสี่ยง|ชะลอ|ภาษีนำเข้า|จำกัดส่งออก|cut|downgrade|drop|tariff/i.test(text)
        ? "negative"
        : /พุ่ง|โต|นิวไฮ|ลดดอกเบี้ย|กระตุ้น|สถิติใหม่|beat|upgrade|stimulus|rally/i.test(text)
          ? "positive"
          : "neutral",
      reason: "ตรวจพบความเชื่อมโยงจากประเด็นข่าวต่างประเทศที่ระบุ (เชื่อมต่อ GEMINI_API_KEY เพื่อวิเคราะห์เชิงลึก)",
    }));
  };

  if (!client) {
    const stocks = buildFallbackStocks();
    return {
      headline: text.slice(0, 90),
      overallImpact: "ผสมผสาน (Mixed)",
      summary:
        "วิเคราะห์เบื้องต้นจากคำสำคัญและชื่อหุ้นต่างประเทศในข้อความ (เชื่อมต่อ GEMINI_API_KEY เพื่อเปิดการประเมินผลกระทบเชิงลึกแบบ AI Pro)",
      affectedSectors: [
        {
          sector: stocks[0]?.sector ?? "Global Equities",
          impact: stocks[0]?.sentiment ?? "neutral",
          reason: "กลุ่มอุตสาหกรรมต่างประเทศที่เชื่อมโยงโดยตรงกับหัวข้อข่าว",
        },
      ],
      affectedStocks: stocks,
      actionableTakeaway:
        "ตรวจสอบกราฟเทคนิค แนวรับ-แนวต้าน Smart Confluence และเป้า Consensus ของหุ้นสหรัฐฯ/ฮ่องกง/จีน/DR ที่เกี่ยวข้องก่อนวางแผนเทรด",
      modelUsed: "Rule-Based Fallback",
      isAiGenerated: false,
    };
  }

  try {
    const prompt = `วิเคราะห์ผลกระทบของข่าวต่อไปนี้ต่อตลาดหุ้นต่างประเทศ (🇺🇸 สหรัฐฯ S&P 500 / Nasdaq 100 · 🇭🇰 ฮ่องกง HKEX · 🇨🇳 จีน A-Share / US ADR · และ 🇹🇭 DR หุ้นต่างประเทศ) เป็นภาษาไทยแบบมืออาชีพ ชัดเจน ไม่อ้อมค้อม ห้ามแนะนำหุ้นไทย SET
${sourceUrl ? `ลิงก์ต้นทาง: ${sourceUrl}` : ""}
เนื้อหาข่าว/ประเด็น:
"""
${text.slice(0, 4500)}
"""

ตอบเป็น JSON เท่านั้น:
{
  "headline": "สรุปหัวข้อข่าวสั้นๆ เป็นภาษาไทย",
  "overallImpact": "เชิงบวก (Bullish)" | "เป็นกลาง (Neutral)" | "เชิงลบ (Bearish)" | "ผสมผสาน (Mixed)",
  "summary": "สรุปผลกระทบต่อตลาดหุ้นสหรัฐฯ/ฮ่องกง/จีน 2-3 ประโยคเป็นภาษาไทย",
  "affectedSectors": [
    { "sector": "ชื่อกลุ่มธุรกิจต่างประเทศ", "impact": "positive" | "neutral" | "negative", "reason": "เหตุผลสั้นๆ" }
  ],
  "affectedStocks": [
    { "symbol": "ชื่อย่อหุ้นจริง เช่น NVDA, AAPL, 0700.HK, 1211.HK, BABA, 600519.SS, NVDA80", "sector": "กลุ่มธุรกิจ", "sentiment": "positive" | "neutral" | "negative", "reason": "เหตุผลที่ได้/เสียประโยชน์" }
  ],
  "actionableTakeaway": "กลยุทธ์รับมือหรือจุดที่นักลงทุนควรติดตามต่อ 1-2 ประโยค"
}`;

    const res = await client.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.2 },
    });

    const parsed = parseJsonSafe<Omit<NewsImpactResult, "modelUsed" | "isAiGenerated">>(
      res.text ?? ""
    );
    if (!parsed || !parsed.summary) throw new Error("Invalid news impact JSON");

    return {
      ...parsed,
      affectedStocks: (parsed.affectedStocks ?? []).map((s) => {
        const meta = resolveStockSymbol(s.symbol);
        return { ...s, symbol: meta.symbol, market: meta.market, currency: meta.currency };
      }),
      modelUsed: model,
      isAiGenerated: true,
    };
  } catch {
    return {
      headline: text.slice(0, 90),
      overallImpact: "ผสมผสาน (Mixed)",
      summary: "ไม่สามารถเรียก Gemini API ได้ชั่วคราว ระบบแสดงผลวิเคราะห์เบื้องต้นแทน",
      affectedSectors: [],
      affectedStocks: buildFallbackStocks(),
      actionableTakeaway: "ลองกดวิเคราะห์อีกครั้ง หรือตรวจสอบการตั้งค่า GEMINI_API_KEY",
      modelUsed: "Rule-Based Fallback",
      isAiGenerated: false,
    };
  }
}

export async function synthesizeStockSinglePassAI(params: {
  symbol: string;
  yahooSymbol?: string;
  currency?: CurrencyCode;
  marketLabel?: string;
  companyName: string;
  technicals: StockTechnicalSummary;
  fundamentals: StockFundamentals;
  iaaConsensus: IaaConsensusSummary;
  brokerReports: BrokerReportItem[];
  companyNews: NewsItem[];
  pdfQuotes: PdfQuoteExtract[];
  factSheetMarkdown: string;
  modelOverride?: string;
}): Promise<StockAiSynthesis> {
  const {
    symbol,
    companyName,
    technicals,
    fundamentals,
    iaaConsensus,
    companyNews,
    factSheetMarkdown,
    modelOverride,
  } = params;

  const resolved = resolveStockSymbol(symbol, iaaConsensus.market);
  const yahooSym = params.yahooSymbol ?? resolved.yahooSymbol;
  const cur: CurrencyCode = params.currency ?? iaaConsensus.currency ?? resolved.currency;
  const unit = currencySymbol(cur);
  const marketLabel = params.marketLabel ?? MARKET_CONFIGS[resolved.market].label;

  const yahooUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSym)}`;
  const refUrl = iaaConsensus.settradeUrl || `${yahooUrl}/analysis`;
  const risk = Math.max(0.01, technicals.price - technicals.standardStop);
  const rrRatio = Number(((technicals.shortTarget - technicals.price) / risk).toFixed(2));

  const checklist5: StockAiSynthesis["checklist5"] = [
    {
      label: "1. มูลค่า & เป้า Consensus นักวิเคราะห์",
      status:
        iaaConsensus.upsidePct !== null
          ? iaaConsensus.upsidePct >= 10
            ? "pass"
            : iaaConsensus.upsidePct >= 0
              ? "warn"
              : "fail"
          : "warn",
      detail:
        iaaConsensus.avgTargetPrice !== null
          ? `เป้าเฉลี่ย ${formatPrice(iaaConsensus.avgTargetPrice, cur)} (Upside ${iaaConsensus.upsidePct?.toFixed(1)}%, นักวิเคราะห์ ${iaaConsensus.totalBrokers} ราย)`
          : "ยังไม่มีเป้าเฉลี่ยนักวิเคราะห์เพียงพอ",
    },
    {
      label: "2. โครงสร้างแนวโน้ม (EMA200)",
      status:
        technicals.ema200 !== null
          ? technicals.price > technicals.ema200
            ? "pass"
            : "fail"
          : "warn",
      detail:
        technicals.ema200 !== null
          ? `ราคา ${formatPrice(technicals.price, cur)} vs EMA200 ${formatPrice(technicals.ema200, cur)} (${technicals.trendLabel})`
          : technicals.trendLabel,
    },
    {
      label: "3. โมเมนตัมระยะสั้น (RSI 14)",
      status:
        technicals.rsi14 !== null
          ? technicals.rsi14 >= 45 && technicals.rsi14 <= 70
            ? "pass"
            : technicals.rsi14 > 75
              ? "fail"
              : "warn"
          : "warn",
      detail:
        technicals.rsi14 !== null
          ? `RSI(14) = ${technicals.rsi14.toFixed(1)} · MACD Hist = ${technicals.macdHist?.toFixed(3) ?? "-"}`
          : "ข้อมูล RSI ไม่เพียงพอ",
    },
    {
      label: "4. สภาพคล่อง & พื้นฐาน (Vol / P/E / Yield)",
      status:
        (technicals.volRatio ?? 1) >= 0.8 && (fundamentals.pe === null || fundamentals.pe < 45)
          ? "pass"
          : "warn",
      detail: `Vol ${technicals.volRatio?.toFixed(2) ?? "-"}x ค่าเฉลี่ย 20 วัน · P/E ${fundamentals.pe?.toFixed(1) ?? "-"}x · Yield ${fundamentals.dividendYield?.toFixed(2) ?? "-"}%`,
    },
    {
      label: "5. ความผันผวน (ATR) & สถานะตลาด",
      status:
        technicals.atr14 && technicals.price > 0 && technicals.atr14 / technicals.price < 0.055
          ? "pass"
          : "warn",
      detail: `ATR(14) ${formatPrice(technicals.atr14, cur)} · ตลาด: ${marketLabel}`,
    },
  ];

  const passCount = checklist5.filter((c) => c.status === "pass").length;
  const fallbackVerdictBias: StockAiSynthesis["verdictBias"] =
    passCount >= 4 ? "positive" : passCount <= 1 ? "negative" : "neutral";
  const fallbackVerdict =
    fallbackVerdictBias === "positive"
      ? "ทยอยสะสม / เก็งกำไรตามกรอบขาขึ้น"
      : fallbackVerdictBias === "negative"
        ? "ชะลอ / เฝ้ารอสร้างฐานใหม่"
        : "ถือรอดูสัญญาณ / เทรดในกรอบแนวรับ-ต้าน";

  const fallbackSynthesis: StockAiSynthesis = {
    verdict: fallbackVerdict,
    verdictBias: fallbackVerdictBias,
    oneLineConclusion: `ฟันธง ${symbol}: ${fallbackVerdict} (แนวรับ S1 ${formatPrice(technicals.s1, cur)} / แนวต้าน R1 ${formatPrice(technicals.r1, cur)} / Stop ${formatPrice(technicals.standardStop, cur)})`,
    bullCase: [
      ...(iaaConsensus.avgTargetPrice
        ? [
            {
              text: `เป้า Consensus เฉลี่ยอยู่ที่ ${formatPrice(iaaConsensus.avgTargetPrice, cur)} คิดเป็น Upside ${iaaConsensus.upsidePct?.toFixed(1)}% จากนักวิเคราะห์ ${iaaConsensus.totalBrokers} ราย (แนะซื้อ ${iaaConsensus.buyCount} ราย)`,
              sourceLabel: "Analyst Consensus",
              sourceUrl: refUrl,
            },
          ]
        : []),
      {
        text: `โครงสร้างราคาอยู่ที่ ${formatPrice(technicals.price, cur)} (${technicals.trendLabel}) มีแนวรับสำคัญ S1 ที่ ${formatPrice(technicals.s1, cur)}`,
        sourceLabel: "กราฟเทคนิค · Yahoo Finance",
        sourceUrl: yahooUrl,
      },
      ...(fundamentals.roe || fundamentals.dividendYield
        ? [
            {
              text: `ROE ${fundamentals.roe?.toFixed(1) ?? "-"}% และอัตราเงินปันผล ${fundamentals.dividendYield?.toFixed(2) ?? "-"}% ช่วยหนุนพื้นฐานระยะกลาง`,
              sourceLabel: "งบการเงิน/พื้นฐาน",
              sourceUrl: refUrl,
            },
          ]
        : []),
    ],
    bearCase: [
      {
        text: `หากราคาปิดหลุดจุดตัดขาดทุนมาตรฐานที่ ${formatPrice(technicals.standardStop, cur)} จะเสียทรงระยะสั้นและมีแนวรับถัดไปที่ S2 ${formatPrice(technicals.s2, cur)}`,
        sourceLabel: "กราฟเทคนิค · Yahoo Finance",
        sourceUrl: yahooUrl,
      },
      {
        text:
          companyNews.length > 0
            ? `ควรติดตามข่าวล่าสุดของบริษัท (${companyNews[0].title.slice(0, 75)}) เพื่อประเมินความต่อเนื่องของกำไรและ Guidance`
            : `ช่วง 30 วันที่ผ่านมามีข่าวเฉพาะบริษัทไม่มาก ควรระวังความผันผวนตามภาวะตลาด ${marketLabel} และอัตราแลกเปลี่ยน`,
        sourceLabel: "ข่าวบริษัท 30 วัน",
        sourceUrl: companyNews[0]?.link ?? refUrl,
      },
    ],
    fundamentalView12M: iaaConsensus.avgTargetPrice
      ? `กรอบพื้นฐาน 12 เดือนอิง Analyst Consensus เฉลี่ย ${formatPrice(iaaConsensus.avgTargetPrice, cur)} (ช่วง ${formatPrice(iaaConsensus.lowTargetPrice, cur)} – ${formatPrice(iaaConsensus.highTargetPrice, cur)}) ที่ P/E ${fundamentals.pe?.toFixed(1) ?? "-"}x และ P/BV ${fundamentals.pbv?.toFixed(2) ?? "-"}x`
      : `P/E ${fundamentals.pe?.toFixed(1) ?? "-"}x · P/BV ${fundamentals.pbv?.toFixed(2) ?? "-"}x · Yield ${fundamentals.dividendYield?.toFixed(2) ?? "-"}% (${marketLabel})`,
    shortTermPlan: {
      entry: technicals.price,
      stop: technicals.standardStop,
      target: technicals.shortTarget,
      rrRatio,
      note: `กรอบเทคนิค (${unit}): แนวรับ S1 ${technicals.s1.toFixed(2)} / S2 ${technicals.s2.toFixed(2)} · แนวต้าน R1 ${technicals.r1.toFixed(2)} / R2 ${technicals.r2.toFixed(2)}`,
    },
    riskConditions: `ยกเลิกแผนทันทีหากปิดหลุด ${formatPrice(technicals.standardStop, cur)} หรือปริมาณการซื้อขายหดตัวพร้อมหลุดแนวรับหลัก`,
    checklist5,
    modelUsed: "Rule-Based Fallback",
    isAiGenerated: false,
  };

  const client = getClient();
  const model = getProModelName(modelOverride);
  if (!client) return fallbackSynthesis;

  try {
    const prompt = `คุณคือหัวหน้าทีมนักวิเคราะห์หุ้นต่างประเทศ (GLOBAL 360° AI) หน้าที่ของคุณคือสังเคราะห์ข้อมูลหุ้น ${symbol} (${companyName} · ${marketLabel} · สกุลเงิน ${cur}) แบบ Single-Pass JSON รอบเดียวอย่างแม่นยำ โดยใช้เฉพาะตัวเลขและข้อเท็จจริงจาก Fact Sheet ด้านล่าง ห้ามเดาหรือสร้างตัวเลขขึ้นมาเอง และใช้สกุลเงิน ${cur} (${unit}) ให้ถูกต้องตลอดบทวิเคราะห์

=== VERIFIED FACT SHEET ===
${factSheetMarkdown}
===========================

ตอบกลับเป็น JSON ตามโครงสร้างนี้เท่านั้น:
{
  "verdict": "คำแนะนำสั้นๆ เช่น ทยอยสะสม / เก็งกำไรตามกรอบ / รอดูฐาน / หลีกเลี่ยง",
  "verdictBias": "positive" | "neutral" | "negative",
  "oneLineConclusion": "สรุปฟันธง 1 บรรทัดชัดเจนพร้อมจุดเข้า/ตัดขาดทุน/เป้าหมายในสกุลเงิน ${unit}",
  "bullCase": [
    { "text": "ปัจจัยบวกพร้อมตัวเลขอ้างอิงจาก Fact Sheet", "sourceLabel": "Analyst Consensus หรือ กราฟเทคนิค หรือ ข่าวบริษัท หรือ PDF โบรกเกอร์", "sourceUrl": "ลิงก์จริงจาก Fact Sheet" }
  ],
  "bearCase": [
    { "text": "ปัจจัยเสี่ยง/ข้อจำกัดข้อมูลพร้อมตัวเลขจริง", "sourceLabel": "...", "sourceUrl": "..." }
  ],
  "fundamentalView12M": "มุมมองพื้นฐาน 12 เดือน 2 ประโยค",
  "shortTermPlan": {
    "entry": ${technicals.price},
    "stop": ${technicals.standardStop},
    "target": ${technicals.shortTarget},
    "rrRatio": ${rrRatio},
    "note": "อธิบายจังหวะเข้าซื้อ แนวรับ-แนวต้านสำคัญ และเงื่อนไขยืนยัน 1-2 ประโยค"
  },
  "riskConditions": "เงื่อนไขที่ทำให้สมมติฐานผิดและต้องตัดขาดทุน"
}
สร้าง bullCase 3-4 ข้อ และ bearCase 2-3 ข้อ โดยใช้ภาษาไทยที่เป็นธรรมชาติสำหรับนักลงทุนไทยที่เทรดหุ้นต่างประเทศ`;

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.2 },
    });

    const parsed = parseJsonSafe<Partial<StockAiSynthesis>>(response.text ?? "");
    if (!parsed || !parsed.verdict || !parsed.bullCase?.length) {
      throw new Error("Incomplete stock synthesis JSON");
    }

    return {
      verdict: parsed.verdict,
      verdictBias: parsed.verdictBias ?? fallbackVerdictBias,
      oneLineConclusion: parsed.oneLineConclusion ?? fallbackSynthesis.oneLineConclusion,
      bullCase: parsed.bullCase,
      bearCase: parsed.bearCase ?? fallbackSynthesis.bearCase,
      fundamentalView12M: parsed.fundamentalView12M ?? fallbackSynthesis.fundamentalView12M,
      shortTermPlan: parsed.shortTermPlan ?? fallbackSynthesis.shortTermPlan,
      riskConditions: parsed.riskConditions ?? fallbackSynthesis.riskConditions,
      checklist5,
      modelUsed: model,
      isAiGenerated: true,
    };
  } catch {
    return fallbackSynthesis;
  }
}

export async function analyzeUploadedBrokerPdfAI(params: {
  symbol: string;
  currency?: CurrencyCode;
  fileName: string;
  extractedText: string;
  currentPrice: number;
  modelOverride?: string;
}): Promise<{
  summary: string;
  brokerName: string;
  rating: string;
  targetPrice: number | null;
  upsidePct: number | null;
  keyTakeaways: string[];
  risks: string[];
  modelUsed: string;
  isAiGenerated: boolean;
}> {
  const { symbol, fileName, extractedText, currentPrice, modelOverride } = params;
  const cur = params.currency ?? resolveStockSymbol(symbol).currency;
  const client = getClient();
  const model = getProModelName(modelOverride);

  if (!client) {
    return {
      summary: `สกัดข้อความจากไฟล์ ${fileName} สำเร็จ (${extractedText.length} ตัวอักษร) — กรุณาตั้งค่า GEMINI_API_KEY เพื่อให้ Gemini Pro ช่วยสรุปประเด็นสำคัญจาก PDF`,
      brokerName: "PDF ที่อัปโหลด",
      rating: "รอ AI สังเคราะห์",
      targetPrice: null,
      upsidePct: null,
      keyTakeaways: [extractedText.slice(0, 320)],
      risks: ["ยังไม่ได้เชื่อมต่อ GEMINI_API_KEY"],
      modelUsed: "Text Extract Only",
      isAiGenerated: false,
    };
  }

  try {
    const prompt = `อ่านข้อความที่สกัดจากไฟล์บทวิเคราะห์ PDF "${fileName}" ของหุ้น ${symbol} (ราคาปัจจุบัน ${formatPrice(currentPrice, cur)} · สกุลเงิน ${cur}) แล้วสรุปเป็นภาษาไทยแบบคมชัด
เนื้อหา PDF:
"""
${extractedText.slice(0, 5000)}
"""
ตอบเป็น JSON เท่านั้น:
{
  "brokerName": "ชื่อสถาบัน/โบรกเกอร์ในไฟล์ (ถ้าไม่พบให้ระบุ ไม่ระบุ)",
  "rating": "คำแนะนำในไฟล์ เช่น ซื้อ / Outperform / Overweight / ถือ / ขาย",
  "targetPrice": ตัวเลขราคาเป้าหมายในสกุลเงิน ${cur} หรือ null,
  "summary": "สรุปสาระสำคัญ 2-3 ประโยค",
  "keyTakeaways": ["ประเด็นสำคัญ 1", "ประเด็นสำคัญ 2", "ประเด็นสำคัญ 3"],
  "risks": ["ความเสี่ยงสำคัญ 1", "ความเสี่ยงสำคัญ 2"]
}`;

    const res = await client.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.15 },
    });

    const parsed = parseJsonSafe<{
      brokerName?: string;
      rating?: string;
      targetPrice?: number | null;
      summary?: string;
      keyTakeaways?: string[];
      risks?: string[];
    }>(res.text ?? "");

    if (!parsed?.summary) throw new Error("Invalid PDF AI response");
    const tp = typeof parsed.targetPrice === "number" && parsed.targetPrice > 0 ? parsed.targetPrice : null;
    const upsidePct =
      tp && currentPrice > 0 ? Number((((tp - currentPrice) / currentPrice) * 100).toFixed(1)) : null;

    return {
      brokerName: parsed.brokerName || "PDF บทวิเคราะห์",
      rating: parsed.rating || "ไม่ระบุ",
      targetPrice: tp,
      upsidePct,
      summary: parsed.summary,
      keyTakeaways: parsed.keyTakeaways ?? [],
      risks: parsed.risks ?? [],
      modelUsed: model,
      isAiGenerated: true,
    };
  } catch {
    return {
      summary: `อ่านข้อความจาก ${fileName} เรียบร้อยแล้ว แต่เรียก Gemini Pro ไม่สำเร็จชั่วคราว`,
      brokerName: "PDF ที่อัปโหลด",
      rating: "ไม่ระบุ",
      targetPrice: null,
      upsidePct: null,
      keyTakeaways: [extractedText.slice(0, 320)],
      risks: [],
      modelUsed: "Text Extract Only",
      isAiGenerated: false,
    };
  }
}

export async function runPointInTimeReplayAI(params: {
  symbol: string;
  currency?: CurrencyCode;
  asOfDate: string;
  priceAtAsOf: number;
  actualPriceLater: number | null;
  actualReturnPct: number | null;
  daysElapsed: number;
  asOfTechSummary: StockTechnicalSummary;
  cutoffNews: NewsItem[];
  excludedFutureNewsCount: number;
  runAiLeakageCheck: boolean;
  modelOverride?: string;
}): Promise<PointInTimeReplayResult> {
  const {
    symbol,
    asOfDate,
    priceAtAsOf,
    actualPriceLater,
    actualReturnPct,
    daysElapsed,
    asOfTechSummary,
    cutoffNews,
    excludedFutureNewsCount,
    runAiLeakageCheck,
    modelOverride,
  } = params;

  const cur = params.currency ?? resolveStockSymbol(symbol).currency;
  const client = getClient();
  const model = getProModelName(modelOverride);

  const deterministicSummary = `ณ วันที่ ${asOfDate} หุ้น ${symbol} ปิดที่ ${formatPrice(priceAtAsOf, cur)} (${asOfTechSummary.trendLabel}) RSI(14) = ${asOfTechSummary.rsi14?.toFixed(1) ?? "-"} · แนวรับ S1 ${formatPrice(asOfTechSummary.s1, cur)} · แนวต้าน R1 ${formatPrice(asOfTechSummary.r1, cur)} · ตัดข้อมูลอนาคตออกครบถ้วน (ข่าวหลังวันทดสอบที่ถูกกรองออก ${excludedFutureNewsCount} รายการ)`;

  let aiSummary = deterministicSummary;
  let isAiGenerated = false;
  let modelUsed = "Deterministic Point-in-Time Engine";

  if (client && runAiLeakageCheck) {
    try {
      const newsLines =
        cutoffNews.length > 0
          ? cutoffNews.map((n) => `- [${n.pubDate.slice(0, 10)}] ${n.title}`).join("\n")
          : "- ไม่มีข่าวเฉพาะบริษัทในช่วงก่อนวันทดสอบ";

      const prompt = `คุณกำลังอยู่ในโหมด "ทดสอบย้อนเวลาแบบปิดตา (Strict Point-in-Time Replay)"
วันนี้คือวันที่ ${asOfDate} เท่านั้น คุณไม่รู้เหตุการณ์ใดๆ ที่เกิดขึ้นหลังวันที่ ${asOfDate} โดยเด็ดขาด!

ข้อมูลหุ้น ${symbol} (${cur}) ณ สิ้นวัน ${asOfDate}:
- ราคาปิด: ${formatPrice(priceAtAsOf, cur)}
- แนวโน้ม: ${asOfTechSummary.trendLabel}
- EMA20: ${asOfTechSummary.ema20 ?? "-"}, EMA50: ${asOfTechSummary.ema50 ?? "-"}, EMA200: ${asOfTechSummary.ema200 ?? "-"}
- RSI(14): ${asOfTechSummary.rsi14 ?? "-"}, ปริมาณซื้อขายเทียบค่าเฉลี่ย 20 วัน: ${asOfTechSummary.volRatio ?? "-"}x
- แนวรับ S1/S2: ${asOfTechSummary.s1}/${asOfTechSummary.s2} | แนวต้าน R1/R2: ${asOfTechSummary.r1}/${asOfTechSummary.r2}
- ข่าวที่มีอยู่จริงก่อน/ณ ${asOfDate}:
${newsLines}

จงสรุปมุมมองและแผนเทรดสั้นๆ 3-4 บรรทัด เป็นภาษาไทย ณ วันที่ ${asOfDate} (ห้ามอ้างถึงอนาคตหลัง ${asOfDate})`;

      const res = await client.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.2 },
      });
      if (res.text?.trim()) {
        aiSummary = res.text.trim();
        isAiGenerated = true;
        modelUsed = model;
      }
    } catch {
      // keep deterministic summary
    }
  }

  const asOfYear = Number(asOfDate.slice(0, 4));
  const flaggedTerms: string[] = [];
  const futureDateMatches = aiSummary.match(/20\d{2}-\d{2}-\d{2}/g) ?? [];
  for (const dt of futureDateMatches) {
    if (dt > asOfDate) flaggedTerms.push(dt);
  }
  const futureYearMatches = aiSummary.match(/\b(20\d{2})\b/g) ?? [];
  for (const yr of futureYearMatches) {
    if (Number(yr) > asOfYear + 1) flaggedTerms.push(yr);
  }
  const hindsightWords = ["ภายหลังพบว่า", "ต่อมาราคาได้พุ่ง", "ผลลัพธ์จริงหลังจากนั้น", "ย้อนกลับมาดู"];
  for (const w of hindsightWords) {
    if (aiSummary.includes(w)) flaggedTerms.push(w);
  }

  const passed = flaggedTerms.length === 0;
  const verdictAccuracy =
    actualReturnPct === null
      ? "ยังไม่มีแท่งเทียนหลังวันทดสอบ"
      : `${daysElapsed} วันทำการต่อมา ราคาจริงอยู่ที่ ${formatPrice(actualPriceLater, cur)} (${actualReturnPct >= 0 ? "+" : ""}${actualReturnPct.toFixed(2)}%) — โครงสร้าง ณ วันนั้น (${asOfTechSummary.trendBias}) ${
          (asOfTechSummary.trendBias === "bullish" && actualReturnPct >= 0) ||
          (asOfTechSummary.trendBias === "bearish" && actualReturnPct <= 0)
            ? "สอดคล้องกับทิศทางจริง"
            : "สวนทาง/ผันผวนตามตลาด"
        }`;

  return {
    symbol,
    asOfDate,
    priceAtAsOf: Number(priceAtAsOf.toFixed(2)),
    actualPriceLater: actualPriceLater !== null ? Number(actualPriceLater.toFixed(2)) : null,
    actualReturnPct: actualReturnPct !== null ? Number(actualReturnPct.toFixed(2)) : null,
    daysElapsed,
    cutoffNewsCount: cutoffNews.length,
    excludedFutureNewsCount,
    aiSummary,
    leakageAudit: {
      passed,
      flaggedTerms,
      explanation: passed
        ? `ผ่านการตรวจสอบ Zero Future Leakage — ตัดแท่งเทียนและข่าวหลัง ${asOfDate} ออกทั้งหมด และไม่พบคำรั่วไหลอนาคตในบทสรุป AI`
        : `ตรวจพบคำ/วันที่ที่อาจอ้างถึงหลัง ${asOfDate}: ${flaggedTerms.join(", ")}`,
    },
    verdictAccuracy,
    modelUsed,
    isAiGenerated,
  };
}

export async function createChatStreamAI(params: {
  messages: { role: "user" | "assistant"; content: string }[];
  liveContextMarkdown: string;
  modelOverride?: string;
}): Promise<{
  stream: AsyncIterable<string>;
  modelUsed: string;
  isAiGenerated: boolean;
}> {
  const { messages, liveContextMarkdown, modelOverride } = params;
  const client = getClient();
  const model = getProModelName(modelOverride);

  if (!client) {
    async function* fallbackStream() {
      yield `**ฟันธง:** ระบบกำลังทำงานในโหมดข้อมูลสด (ยังไม่ได้ตั้งค่า \`GEMINI_API_KEY\` ใน \`.env.local\` / Vercel)\n\n`;
      yield `นี่คือข้อมูลสด 360° ที่ระบบดึงมาให้เรียบร้อยแล้วจากแหล่งข้อมูลจริง:\n\n`;
      yield liveContextMarkdown;
      yield `\n\n> 💡 เติม \`GEMINI_API_KEY\` ในไฟล์ \`.env.local\` หรือ Vercel Environment Variables เพื่อเปิดใช้งาน **Gemini 2.5 Pro AI Chat Bot** แบบถาม-ตอบเต็มรูปแบบครับ`;
    }
    return { stream: fallbackStream(), modelUsed: "Live Data Fallback", isAiGenerated: false };
  }

  const systemInstruction = `คุณคือ "GLOBAL 360° AI" ผู้ช่วยวิเคราะห์หุ้นต่างประเทศอัจฉริยะ 5 ตลาดหลัก:
1. 🇺🇸 สหรัฐฯ S&P 500 (USD $)
2. 🇺🇸 สหรัฐฯ Nasdaq 100 (USD $)
3. 🇭🇰 ฮ่องกง HKEX / Hang Seng (HKD HK$)
4. 🇨🇳 จีนแผ่นดินใหญ่ A-Share (CNY ¥) & China US ADR (USD $)
5. 🇹🇭 DR หุ้นต่างประเทศที่เทรดเป็นเงินบาท (THB ฿ เช่น NVDA80, AAPL80, TENCENT80, BABA80, NDX01)

กติกาเหล็กในการตอบทุกครั้ง:
1. **บรรทัดแรกสุดต้องขึ้นต้นด้วย "ฟันธง:"** สรุปมุมมองหรือคำตอบหลักให้ชัดเจนจบใน 1 บรรทัดทันที ห้ามอ้อมค้อม
2. ใช้เฉพาะตัวเลขจริงและสกุลเงินที่ถูกต้อง (USD $ / HKD HK$ / CNY ¥ / THB ฿ สำหรับ DR) จาก Live Context ด้านล่าง ห้ามแต่งตัวเลขราคาหรือเป้าโบรกเกอร์ขึ้นมาเองเด็ดขาด
3. ตอบเป็นภาษาไทยที่กระชับ อ่านง่าย จัดหมวดหมู่ด้วย Bullet ชัดเจน พร้อมระบุแนวรับ S1/S2, แนวต้าน R1/R2 และ Volume POC เมื่อมีใน Context
4. **สำคัญมาก:** เมื่อวิเคราะห์หรือแนะนำแผนเทรดของหุ้นตัวใดตัวหนึ่ง ให้แนบบล็อก JSON พิเศษไว้ท้ายคำตอบเสมอในรูปแบบนี้เป๊ะๆ เพื่อให้เว็บแสดงการ์ดแผนเทรดที่กดส่งเข้า Time Machine / Paper Trade ได้ทันที:
\`\`\`tradeplan
{"symbol":"NVDA","market":"NASDAQ100","currency":"USD","action":"ทยอยสะสม / ซื้อตามกรอบ","entry":165.05,"stop":156.8,"target":181.5,"rrRatio":1.99,"iaaTarget":241.19,"timeMachineWinPct":48.5,"note":"รอจังหวะย่อใกล้แนวรับหรือเบรกพร้อมวอลุ่ม"}
\`\`\`
(ระบุ symbol, market ("SP500"|"NASDAQ100"|"HK"|"CHINA"|"DR") และ currency ("USD"|"HKD"|"CNY"|"THB") ให้ตรงกับหุ้นนั้นๆ; ถ้าไม่ได้ถามเจาะจงหุ้นรายตัว ไม่ต้องใส่บล็อก tradeplan)
5. ปิดท้ายสั้นๆ ว่าข้อมูลนี้เพื่อการศึกษาประกอบการตัดสินใจ มิใช่คำแนะนำการลงทุน

=== LIVE 360° GLOBAL MARKET & PORTFOLIO CONTEXT ===
${liveContextMarkdown}
==================================================`;

  const contents = messages.slice(-10).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const responseStream = await client.models.generateContentStream({
    model,
    contents,
    config: {
      systemInstruction,
      temperature: 0.25,
    },
  });

  async function* gen() {
    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) yield text;
    }
  }

  return { stream: gen(), modelUsed: model, isAiGenerated: true };
}
