import { GoogleGenAI } from "@google/genai";
import type {
  AffectedStockItem,
  BrokerReportItem,
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
import { extractThaiTickersFromText, getStockMeta } from "../set50";

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
  const setCard = macroCards.find((m) => m.symbol === "^SET.BK");
  const spCard = macroCards.find((m) => m.symbol === "^GSPC");
  const goldCard = macroCards.find((m) => m.symbol === "GC=F");
  const oilCard = macroCards.find((m) => m.symbol === "BZ=F");
  const thbCard = macroCards.find((m) => m.symbol === "THB=X");

  // Count tickers mentioned across today's news for deterministic grounding
  const tickerFreq = new Map<string, number>();
  for (const list of Object.values(categorizedNews)) {
    for (const item of list) {
      for (const t of item.tickers ?? []) {
        tickerFreq.set(t, (tickerFreq.get(t) ?? 0) + 1);
      }
    }
  }
  const topNewsTickers = Array.from(tickerFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([sym]) => sym);

  const defaultAffected: AffectedStockItem[] = (
    topNewsTickers.length >= 4
      ? topNewsTickers
      : ["BDMS", "CPALL", "AOT", "KBANK", "PTT", "PTTEP", "ADVANC", "GULF"]
  ).map((sym) => {
    const meta = getStockMeta(sym);
    const oilBias = (oilCard?.changePct ?? 0) >= 0 ? "positive" : "negative";
    const sentiment: AffectedStockItem["sentiment"] =
      sym === "PTT" || sym === "PTTEP"
        ? oilBias
        : (setCard?.changePct ?? 0) >= 0
          ? "positive"
          : "neutral";
    return {
      symbol: sym,
      sector: meta.sector,
      sentiment,
      reason: `ถูกกล่าวถึงในกระแสข่าวและดัชนีตลาดวันนี้ (${meta.sector})`,
    };
  });

  const moodDefault: "Risk-On" | "Neutral" | "Risk-Off" =
    (setCard?.changePct ?? 0) > 0.4 && (spCard?.changePct ?? 0) >= 0
      ? "Risk-On"
      : (setCard?.changePct ?? 0) < -0.5 || (spCard?.changePct ?? 0) < -0.8
        ? "Risk-Off"
        : "Neutral";

  const fallbackSections: DailyBriefingSection[] = [
    {
      key: "atmosphere",
      title: "1. บรรยากาศการลงทุนวันนี้",
      content: `ดัชนี SET Index อยู่ที่ ${setCard?.price?.toFixed(2) ?? "-"} จุด (${(setCard?.changePct ?? 0) >= 0 ? "+" : ""}${setCard?.changePct?.toFixed(2) ?? "0"}%) ท่ามกลางภาพรวมตลาดโลกโทน ${moodDefault} โดย S&P 500 เคลื่อนไหว ${(spCard?.changePct ?? 0) >= 0 ? "+" : ""}${spCard?.changePct?.toFixed(2) ?? "0"}%`,
    },
    {
      key: "sectors",
      title: "2. กลุ่มอุตสาหกรรมที่โดดเด่น / ควรระวัง",
      content: `กลุ่มพลังงานเชื่อมโยงราคาน้ำมันดิบ Brent (${oilCard?.price?.toFixed(2) ?? "-"} USD, ${oilCard?.changePct?.toFixed(2) ?? "0"}%) ขณะที่กลุ่มค้าปลีก-การแพทย์-สื่อสารยังคงเป็นกลุ่ม Defensive ที่ตลาดใช้พักเงินเมื่อความผันผวนสูง`,
    },
    {
      key: "global_flow",
      title: "3. เชื่อมโยงตลาดโลก & ฟันด์โฟลว์",
      content: `ค่าเงินบาท (USD/THB) เคลื่อนไหวบริเวณ ${thbCard?.price?.toFixed(2) ?? "-"} บาท/ดอลลาร์ และราคาทองคำโลกอยู่ที่ ${goldCard?.price?.toFixed(2) ?? "-"} USD สะท้อนทิศทางกระแสเงินทุนต่างชาติและการป้องกันความเสี่ยง`,
    },
    {
      key: "thai_econ",
      title: "4. เศรษฐกิจและการเงินไทย",
      content: `ติดตามพาดหัวล่าสุดด้านทิศทางดอกเบี้ยนโยบาย กนง., ภาวะส่งออก และตัวเลขเศรษฐกิจไทยจากแหล่งข่าวสาธารณะด้านล่าง (ใส่ GEMINI_API_KEY เพื่อเปิดระบบสังเคราะห์ข่าวอัจฉริยะเต็มรูปแบบ)`,
    },
    {
      key: "politics",
      title: "5. การเมืองและนโยบายภาครัฐ",
      content: `ติดตามมาตรการกระตุ้นเศรษฐกิจ การเบิกจ่ายงบประมาณ และเสถียรภาพนโยบายรัฐซึ่งมีผลต่อกลุ่มรับเหมา ค้าปลีก และนิคมอุตสาหกรรม`,
    },
    {
      key: "consumer",
      title: "6. สังคม ท่องเที่ยว และกำลังซื้อ",
      content: `ติดตามตัวเลขนักท่องเที่ยวต่างชาติและดัชนีความเชื่อมั่นผู้บริโภคที่เป็นแรงขับเคลื่อนหลักของกลุ่มสนามบิน โรงแรม และค้าปลีก`,
    },
  ];

  const client = getClient();
  const model = getFlashModelName(modelOverride);
  if (!client) {
    return {
      headline: `สรุปภาวะตลาดหุ้นไทย & โลก (${moodDefault}) — โหมดข้อมูลสด (ยังไม่ได้ตั้งค่า GEMINI_API_KEY)`,
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

    const prompt = `คุณคือนักกลยุทธ์ตลาดหุ้นไทยอาวุโส สรุปภาวะตลาดและข่าวใหญ่ประจำวันเป็นภาษาไทยที่กระชับ คมชัด อ่านจบใน 1 นาที โดยยึดเฉพาะข้อเท็จจริงจากข้อมูลตลาดและพาดหัวข่าวด้านล่าง ห้ามแต่งตัวเลขขึ้นเอง

ข้อมูลตลาดโลกและไทยล่าสุด:
${macroText}

พาดหัวข่าวสาธารณะล่าสุดแยกหมวด:
${newsDigest}

ตอบกลับเป็น JSON ตามโครงสร้างนี้เท่านั้น (ห้ามมีข้อความนอก JSON):
{
  "headline": "พาดหัวสรุปภาวะตลาดวันนี้ 1 บรรทัดแบบคมชัด",
  "mood": "Risk-On" | "Neutral" | "Risk-Off",
  "sections": [
    { "key": "atmosphere", "title": "1. บรรยากาศการลงทุนวันนี้", "content": "..." },
    { "key": "sectors", "title": "2. กลุ่มอุตสาหกรรมที่โดดเด่น / ควรระวัง", "content": "..." },
    { "key": "global_flow", "title": "3. เชื่อมโยงตลาดโลก & ฟันด์โฟลว์", "content": "..." },
    { "key": "thai_econ", "title": "4. เศรษฐกิจและการเงินไทย", "content": "..." },
    { "key": "politics", "title": "5. การเมืองและนโยบายภาครัฐ", "content": "..." },
    { "key": "consumer", "title": "6. สังคม ท่องเที่ยว และกำลังซื้อ", "content": "..." }
  ],
  "affectedStocks": [
    { "symbol": "PTT", "sector": "พลังงาน", "sentiment": "positive" | "neutral" | "negative", "reason": "เหตุผลสั้นๆ 1 ประโยค" }
  ]
}
ให้เลือก affectedStocks 6-8 หุ้นไทย SET จริงที่เกี่ยวข้องกับข่าวและภาวะตลาดวันนี้ที่สุด`;

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

    return {
      headline: parsed.headline || `สรุปภาวะตลาดหุ้นไทย (${parsed.mood ?? moodDefault})`,
      mood: parsed.mood ?? moodDefault,
      sections: parsed.sections,
      affectedStocks:
        parsed.affectedStocks && parsed.affectedStocks.length > 0
          ? parsed.affectedStocks.slice(0, 8)
          : defaultAffected,
      modelUsed: model,
      isAiGenerated: true,
    };
  } catch {
    return {
      headline: `สรุปภาวะตลาดหุ้นไทย & โลก (${moodDefault})`,
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
  const detectedTickers = extractThaiTickersFromText(text);
  const client = getClient();
  const model = getFlashModelName(modelOverride);

  if (!client) {
    const stocks: AffectedStockItem[] = (
      detectedTickers.length > 0 ? detectedTickers : ["PTT", "CPALL", "AOT", "KBANK"]
    )
      .slice(0, 6)
      .map((sym) => ({
        symbol: sym,
        sector: getStockMeta(sym).sector,
        sentiment: /ลด|ร่วง|เสี่ยง|ชะลอ|ขาดทุน/.test(text)
          ? "negative"
          : /พุ่ง|โต|นิวไฮ|ลดดอกเบี้ย|กระตุ้น|สถิติใหม่/.test(text)
            ? "positive"
            : "neutral",
        reason: "ตรวจพบความเชื่อมโยงจากประเด็นข่าวที่ระบุ (ใส่ GEMINI_API_KEY เพื่อวิเคราะห์เชิงลึก)",
      }));

    return {
      headline: text.slice(0, 90),
      overallImpact: "ผสมผสาน (Mixed)",
      summary:
        "วิเคราะห์เบื้องต้นจากคำสำคัญและชื่อหุ้นไทยในข้อความ (เชื่อมต่อ GEMINI_API_KEY เพื่อเปิดการวิเคราะห์ผลกระทบเชิงลึกแบบ AI Pro)",
      affectedSectors: [
        {
          sector: stocks[0]?.sector ?? "ตลาดรวม SET",
          impact: stocks[0]?.sentiment ?? "neutral",
          reason: "กลุ่มอุตสาหกรรมที่เชื่อมโยงโดยตรงกับหัวข้อข่าว",
        },
      ],
      affectedStocks: stocks,
      actionableTakeaway:
        "ตรวจสอบกราฟเทคนิค แนวรับ-แนวต้าน และเป้า IAA ของหุ้นที่เกี่ยวข้องก่อนตัดสินใจวางแผนเทรด",
      modelUsed: "Rule-Based Fallback",
      isAiGenerated: false,
    };
  }

  try {
    const prompt = `วิเคราะห์ผลกระทบของข่าวต่อไปนี้ต่อตลาดหุ้นไทย (SET/mai) เป็นภาษาไทยแบบมืออาชีพ ชัดเจน ไม่อ้อมค้อม
${sourceUrl ? `ลิงก์ต้นทาง: ${sourceUrl}` : ""}
เนื้อหาข่าว/ประเด็น:
"""
${text.slice(0, 4500)}
"""

ตอบเป็น JSON เท่านั้น:
{
  "headline": "สรุปหัวข้อข่าวสั้นๆ",
  "overallImpact": "เชิงบวก (Bullish)" | "เป็นกลาง (Neutral)" | "เชิงลบ (Bearish)" | "ผสมผสาน (Mixed)",
  "summary": "สรุปผลกระทบต่อตลาดหุ้นไทย 2-3 ประโยค",
  "affectedSectors": [
    { "sector": "ชื่อกลุ่มธุรกิจไทย", "impact": "positive" | "neutral" | "negative", "reason": "เหตุผลสั้นๆ" }
  ],
  "affectedStocks": [
    { "symbol": "ชื่อย่อหุ้น SET เช่น PTTEP, AOT, MTC", "sector": "กลุ่มธุรกิจ", "sentiment": "positive" | "neutral" | "negative", "reason": "เหตุผลที่ได้/เสียประโยชน์" }
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
      modelUsed: model,
      isAiGenerated: true,
    };
  } catch {
    return {
      headline: text.slice(0, 90),
      overallImpact: "ผสมผสาน (Mixed)",
      summary: "ไม่สามารถเรียก Gemini API ได้ชั่วคราว ระบบแสดงผลวิเคราะห์เบื้องต้นแทน",
      affectedSectors: [],
      affectedStocks: detectedTickers.slice(0, 5).map((sym) => ({
        symbol: sym,
        sector: getStockMeta(sym).sector,
        sentiment: "neutral",
        reason: "ถูกกล่าวถึงในข้อความข่าว",
      })),
      actionableTakeaway: "ลองกดวิเคราะห์อีกครั้ง หรือตรวจสอบการตั้งค่า GEMINI_API_KEY",
      modelUsed: "Rule-Based Fallback",
      isAiGenerated: false,
    };
  }
}

export async function synthesizeStockSinglePassAI(params: {
  symbol: string;
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

  const yahooUrl = `https://finance.yahoo.com/quote/${symbol}.BK`;
  const settradeUrl = iaaConsensus.settradeUrl;
  const risk = Math.max(0.01, technicals.price - technicals.standardStop);
  const rrRatio = Number(((technicals.shortTarget - technicals.price) / risk).toFixed(2));

  // Deterministic 5-rule checklist (always verifiable!)
  const checklist5: StockAiSynthesis["checklist5"] = [
    {
      label: "1. มูลค่า & เป้า Consensus (IAA)",
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
          ? `เป้าเฉลี่ย ${iaaConsensus.avgTargetPrice.toFixed(2)} บ. (Upside ${iaaConsensus.upsidePct?.toFixed(1)}%, โบรกฯ ${iaaConsensus.totalBrokers} ราย)`
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
          ? `ราคา ${technicals.price.toFixed(2)} vs EMA200 ${technicals.ema200.toFixed(2)} (${technicals.trendLabel})`
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
        (technicals.volRatio ?? 1) >= 0.8 && (fundamentals.pe === null || fundamentals.pe < 35)
          ? "pass"
          : "warn",
      detail: `Vol ${technicals.volRatio?.toFixed(2) ?? "-"}x ค่าเฉลี่ย 20 วัน · P/E ${fundamentals.pe?.toFixed(1) ?? "-"}x · Yield ${fundamentals.dividendYield?.toFixed(2) ?? "-"}%`,
    },
    {
      label: "5. เกณฑ์กำกับ & ความผันผวน (ATR)",
      status:
        technicals.atr14 && technicals.price > 0 && technicals.atr14 / technicals.price < 0.045
          ? "pass"
          : "warn",
      detail: `ATR(14) ${technicals.atr14?.toFixed(2) ?? "-"} บ. · สถานะกำกับ: ${fundamentals.cashBalanceStatus}`,
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
    oneLineConclusion: `ฟันธง ${symbol}: ${fallbackVerdict} (แนวรับ S1 ${technicals.s1.toFixed(2)} / แนวต้าน R1 ${technicals.r1.toFixed(2)} / Stop ${technicals.standardStop.toFixed(2)} บ.)`,
    bullCase: [
      ...(iaaConsensus.avgTargetPrice
        ? [
            {
              text: `เป้าพื้นฐานเฉลี่ยอยู่ที่ ${iaaConsensus.avgTargetPrice.toFixed(2)} บาท คิดเป็น Upside ${iaaConsensus.upsidePct?.toFixed(1)}% จากโบรกเกอร์ ${iaaConsensus.totalBrokers} ราย (แนะซื้อ ${iaaConsensus.buyCount} ราย)`,
              sourceLabel: "IAA / Consensus",
              sourceUrl: settradeUrl,
            },
          ]
        : []),
      {
        text: `โครงสร้างราคาอยู่ที่ ${technicals.price.toFixed(2)} บาท (${technicals.trendLabel}) มีแนวรับใกล้สุด S1 ที่ ${technicals.s1.toFixed(2)} บาท`,
        sourceLabel: "กราฟเทคนิค · Yahoo Finance",
        sourceUrl: yahooUrl,
      },
      ...(fundamentals.dividendYield
        ? [
            {
              text: `อัตราเงินปันผลประมาณ ${fundamentals.dividendYield.toFixed(2)}% และ ROE ${fundamentals.roe?.toFixed(1) ?? "-"}% ช่วยพยุงดาวน์ไซด์`,
              sourceLabel: "งบการเงิน/ปันผล",
              sourceUrl: settradeUrl,
            },
          ]
        : []),
    ],
    bearCase: [
      {
        text: `หากราคาหลุดจุดตัดขาดทุนมาตรฐานที่ ${technicals.standardStop.toFixed(2)} บาท จะเสียทรงระยะสั้นและมีแนวรับถัดไปที่ S2 ${technicals.s2.toFixed(2)} บาท`,
        sourceLabel: "กราฟเทคนิค · Yahoo Finance",
        sourceUrl: yahooUrl,
      },
      {
        text:
          companyNews.length > 0
            ? `ควรติดตามข่าวล่าสุดของบริษัท (${companyNews[0].title.slice(0, 75)}) เพื่อประเมินความต่อเนื่องของกำไร`
            : "ช่วง 30 วันที่ผ่านมามีข่าวเฉพาะบริษัทไม่มาก ควรระวังความผันผวนตามภาวะตลาดรวม SET",
        sourceLabel: "ข่าวบริษัท 30 วัน",
        sourceUrl: companyNews[0]?.link ?? settradeUrl,
      },
    ],
    fundamentalView12M: iaaConsensus.avgTargetPrice
      ? `กรอบพื้นฐาน 12 เดือนอิง Consensus เฉลี่ย ${iaaConsensus.avgTargetPrice.toFixed(2)} บ. (ช่วง ${iaaConsensus.lowTargetPrice?.toFixed(2) ?? "-"} – ${iaaConsensus.highTargetPrice?.toFixed(2) ?? "-"} บ.) ที่ P/E ${fundamentals.pe?.toFixed(1) ?? "-"}x และ P/BV ${fundamentals.pbv?.toFixed(2) ?? "-"}x`
      : `P/E ${fundamentals.pe?.toFixed(1) ?? "-"}x · P/BV ${fundamentals.pbv?.toFixed(2) ?? "-"}x · Yield ${fundamentals.dividendYield?.toFixed(2) ?? "-"}% (ตรวจสอบงบการเงินล่าสุดใน Settrade ประกอบ)`,
    shortTermPlan: {
      entry: technicals.price,
      stop: technicals.standardStop,
      target: technicals.shortTarget,
      rrRatio,
      note: `กรอบเทคนิค 20 วัน: แนวรับ S1 ${technicals.s1.toFixed(2)} / S2 ${technicals.s2.toFixed(2)} · แนวต้าน R1 ${technicals.r1.toFixed(2)} / R2 ${technicals.r2.toFixed(2)}`,
    },
    riskConditions: `ยกเลิกแผนทันทีหากปิดหลุด ${technicals.standardStop.toFixed(2)} บ. หรือปริมาณการซื้อขายหดตัวผิดปกติพร้อมหลุดแนวรับหลัก`,
    checklist5,
    modelUsed: "Rule-Based Fallback",
    isAiGenerated: false,
  };

  const client = getClient();
  const model = getProModelName(modelOverride);
  if (!client) return fallbackSynthesis;

  try {
    const prompt = `คุณคือหัวหน้าทีมนักวิเคราะห์หุ้นไทย (AI Agents 360°) หน้าที่ของคุณคือสังเคราะห์ข้อมูลหุ้น ${symbol} (${companyName}) แบบ Single-Pass JSON รอบเดียวอย่างแม่นยำ โดยใช้เฉพาะตัวเลขและข้อเท็จจริงจาก Fact Sheet ด้านล่าง ห้ามเดาหรือสร้างตัวเลขขึ้นมาเอง

=== VERIFIED FACT SHEET ===
${factSheetMarkdown}
===========================

ตอบกลับเป็น JSON ตามโครงสร้างนี้เท่านั้น:
{
  "verdict": "คำแนะนำสั้นๆ เช่น ทยอยสะสม / เก็งกำไรตามกรอบ / รอดูฐาน / หลีกเลี่ยง",
  "verdictBias": "positive" | "neutral" | "negative",
  "oneLineConclusion": "สรุปฟันธง 1 บรรทัดชัดเจนพร้อมจุดเข้า/ตัดขาดทุน/เป้าหมาย",
  "bullCase": [
    { "text": "ปัจจัยบวกพร้อมตัวเลขอ้างอิงจาก Fact Sheet", "sourceLabel": "IAA Consensus หรือ กราฟเทคนิค หรือ ข่าวบริษัท หรือ PDF โบรกเกอร์", "sourceUrl": "ลิงก์จริงจาก Fact Sheet" }
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
    "note": "อธิบายจังหวะเข้าซื้อและเงื่อนไขยืนยัน 1-2 ประโยค"
  },
  "riskConditions": "เงื่อนไขที่ทำให้สมมติฐานผิดและต้องตัดขาดทุน"
}
สร้าง bullCase 3-4 ข้อ และ bearCase 2-3 ข้อ โดยใช้ภาษาไทยที่เป็นธรรมชาติสำหรับนักลงทุนหุ้นไทย`;

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
    const prompt = `อ่านข้อความที่สกัดจากไฟล์บทวิเคราะห์ PDF "${fileName}" ของหุ้นไทย ${symbol} (ราคาปัจจุบัน ${currentPrice.toFixed(2)} บาท) แล้วสรุปเป็นภาษาไทยแบบคมชัด
เนื้อหา PDF:
"""
${extractedText.slice(0, 5000)}
"""
ตอบเป็น JSON เท่านั้น:
{
  "brokerName": "ชื่อโบรกเกอร์ในไฟล์ (ถ้าไม่พบให้ระบุ ไม่ระบุ)",
  "rating": "คำแนะนำในไฟล์ เช่น ซื้อ / Outperform / ถือ / ขาย",
  "targetPrice": ตัวเลขราคาเป้าหมาย หรือ null,
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

  const client = getClient();
  const model = getProModelName(modelOverride);

  const deterministicSummary = `ณ วันที่ ${asOfDate} หุ้น ${symbol} ปิดที่ ${priceAtAsOf.toFixed(2)} บ. (${asOfTechSummary.trendLabel}) RSI(14) = ${asOfTechSummary.rsi14?.toFixed(1) ?? "-"} · แนวรับ S1 ${asOfTechSummary.s1.toFixed(2)} · แนวต้าน R1 ${asOfTechSummary.r1.toFixed(2)} · ตัดข้อมูลอนาคตออกครบถ้วน (ข่าวหลังวันทดสอบที่ถูกกรองออก ${excludedFutureNewsCount} รายการ)`;

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

ข้อมูลหุ้น ${symbol} ณ สิ้นวัน ${asOfDate}:
- ราคาปิด: ${priceAtAsOf.toFixed(2)} บ.
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

  // Zero-Future-Leakage Audit Scanner
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
      : `${daysElapsed} วันทำการต่อมา ราคาจริงอยู่ที่ ${actualPriceLater?.toFixed(2)} บ. (${actualReturnPct >= 0 ? "+" : ""}${actualReturnPct.toFixed(2)}%) — โครงสร้าง ณ วันนั้น (${asOfTechSummary.trendBias}) ${
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

  const systemInstruction = `คุณคือ "SET 360° AI" ผู้ช่วยวิเคราะห์หุ้นไทยอัจฉริยะที่เชี่ยวชาญตลาดหุ้นไทย (SET/mai)
กติกาเหล็กในการตอบทุกครั้ง:
1. **บรรทัดแรกสุดต้องขึ้นต้นด้วย "ฟันธง:"** สรุปมุมมองหรือคำตอบหลักให้ชัดเจนจบใน 1 บรรทัดทันที ห้ามอ้อมค้อม
2. ใช้เฉพาะตัวเลขจริงจาก Live Context ด้านล่าง (ราคา, แนวรับ-ต้าน, EMA, RSI, เป้า IAA Consensus, ผล Time Machine 10,000 รอบ, ผลสแกน SET50, พอร์ตจำลอง 360° และพอร์ต Paper Trade ของผู้ใช้) ห้ามแต่งตัวเลขราคาหรือเป้าโบรกเกอร์ขึ้นมาเองเด็ดขาด
3. ตอบเป็นภาษาไทยที่กระชับ อ่านง่าย จัดหมวดหมู่ด้วย Bullet ชัดเจน
4. **สำคัญมาก:** เมื่อวิเคราะห์หรือแนะนำแผนเทรดของหุ้นไทยตัวใดตัวหนึ่ง ให้แนบบล็อก JSON พิเศษไว้ท้ายคำตอบเสมอในรูปแบบนี้เป๊ะๆ เพื่อให้เว็บแสดงการ์ดแผนเทรดที่กดส่งเข้า Time Machine / Paper Trade ได้ทันที:
\`\`\`tradeplan
{"symbol":"PTT","action":"ทยอยสะสม / ซื้อตามกรอบ","entry":37.4,"stop":35.5,"target":41.5,"rrRatio":2.16,"iaaTarget":44.92,"timeMachineWinPct":48.5,"note":"รอจังหวะย่อใกล้แนวรับหรือเบรกพร้อมวอลุ่ม"}
\`\`\`
(ถ้าไม่ได้ถามเจาะจงหุ้นรายตัว ไม่ต้องใส่บล็อก tradeplan)
5. ปิดท้ายสั้นๆ ว่าข้อมูลนี้เพื่อการศึกษาประกอบการตัดสินใจ มิใช่คำแนะนำการลงทุน

=== LIVE 360° MARKET & PORTFOLIO CONTEXT ===
${liveContextMarkdown}
=============================================`;

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
