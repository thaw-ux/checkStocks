import { NextResponse } from "next/server";
import { synthesizeStockSinglePassAI } from "@/lib/ai/gemini";
import { getOrFetch } from "@/lib/cache";
import { fetchSingleStockConsensusAndFundamentals } from "@/lib/data/marketConsensus";
import { fetchCompanyNews30D, fetchDailyBrokerResearchFeeds } from "@/lib/data/news";
import { extractPdfQuoteFromUrl } from "@/lib/data/pdf";
import { fetchYahooChart } from "@/lib/data/yahoo";
import {
  currencySymbol,
  getDefaultGlobalPeers,
  MARKET_CONFIGS,
  resolveStockSymbol,
  type GlobalStockMeta,
} from "@/lib/markets";
import { computeTechnicalSummary } from "@/lib/quant/indicators";
import { aggregateWeeklyBars, computeSmartSupportResistance } from "@/lib/quant/supportResistance";
import type {
  BrokerReportItem,
  DataAuditItem,
  IaaConsensusSummary,
  MarketId,
  PdfQuoteExtract,
  StockAnalysisPayload,
  StockFundamentals,
} from "@/lib/types";

function parseOptionalMarketParam(raw: string | null): MarketId | undefined {
  if (raw === "SP500" || raw === "NASDAQ100" || raw === "HK" || raw === "CHINA" || raw === "DR") {
    return raw;
  }
  return undefined;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: rawParam } = await context.params;
    const decoded = decodeURIComponent(rawParam || "").trim();
    if (!decoded) {
      return NextResponse.json(
        { error: "กรุณาระบุชื่อย่อหุ้น เช่น NVDA, AAPL, 0700.HK, 1211.HK, 600519.SS, BABA, NVDA80" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const extractPdf = searchParams.get("extractPdf") !== "0";
    const includeIntraday = searchParams.get("intraday") === "1";
    const modelOverride = searchParams.get("model") || undefined;
    const marketHint = parseOptionalMarketParam(searchParams.get("market"));

    const resolved: GlobalStockMeta = resolveStockSymbol(decoded, marketHint);

    const cacheKey = `api:stock:global:v3:${resolved.market}:${resolved.yahooSymbol}:pdf=${extractPdf}:intra=${includeIntraday}:m=${modelOverride ?? "def"}`;

    const payload = await getOrFetch<StockAnalysisPayload>(
      cacheKey,
      8 * 60 * 1000,
      async () => {
        const now = new Date().toISOString();

        const chartRes = await fetchYahooChart(
          resolved.yahooSymbol,
          "2y",
          "1d",
          forceRefresh,
          true
        );

        if (!chartRes.ok || chartRes.bars.length === 0) {
          throw new Error(
            `ไม่พบข้อมูลราคาของหุ้น "${decoded}" (ลองระบุรูปแบบให้ตรงตลาด เช่น NVDA สำหรับสหรัฐฯ, 0700.HK สำหรับฮ่องกง, 600519.SS หรือ BABA สำหรับจีน, NVDA80 สำหรับ DR)`
          );
        }

        const [consensusRec, newsBundle, allBrokerFeed, intradayRes] = await Promise.all([
          fetchSingleStockConsensusAndFundamentals(resolved.symbol, forceRefresh, resolved.market),
          fetchCompanyNews30D(resolved.symbol, forceRefresh, resolved.market),
          fetchDailyBrokerResearchFeeds(undefined, forceRefresh, resolved.market),
          includeIntraday
            ? fetchYahooChart(resolved.yahooSymbol, "5d", "5m", forceRefresh, true)
            : Promise.resolve({ bars: [], meta: null, ok: false }),
        ]);

        const currency = resolved.currency;
        const unit = currencySymbol(currency);
        const technicals = computeTechnicalSummary(chartRes.bars, currency);
        const srDaily = computeSmartSupportResistance(chartRes.bars, currency, "day");
        const weeklyBars = aggregateWeeklyBars(chartRes.bars);
        const srWeekly = computeSmartSupportResistance(weeklyBars, currency, "week");

        if (srDaily.supports[0]) technicals.s1 = srDaily.supports[0].price;
        if (srDaily.supports[1]) technicals.s2 = srDaily.supports[1].price;
        if (srDaily.resistances[0]) technicals.r1 = srDaily.resistances[0].price;
        if (srDaily.resistances[1]) technicals.r2 = srDaily.resistances[1].price;

        const livePrice = technicals.price;
        const mktCfg = MARKET_CONFIGS[resolved.market];
        const fallbackRefUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(resolved.yahooSymbol)}/analysis`;

        const iaaConsensus: IaaConsensusSummary = consensusRec?.consensus ?? {
          symbol: resolved.symbol,
          market: resolved.market,
          currency,
          companyName: resolved.name,
          sector: resolved.sector,
          currentPrice: livePrice,
          avgTargetPrice: null,
          medianTargetPrice: null,
          highTargetPrice: null,
          lowTargetPrice: null,
          upsidePct: null,
          buyCount: 0,
          holdCount: 0,
          sellCount: 0,
          totalBrokers: 0,
          buyRatioPct: null,
          recommendationKey: "ยังไม่มีข้อมูล Consensus",
          source: `${mktCfg.label} Analyst Consensus`,
          settradeUrl: fallbackRefUrl,
          updatedAt: now,
        };

        if (iaaConsensus.avgTargetPrice && livePrice > 0) {
          iaaConsensus.currentPrice = livePrice;
          iaaConsensus.upsidePct = Number(
            (((iaaConsensus.avgTargetPrice - livePrice) / livePrice) * 100).toFixed(1)
          );
        }

        const fundamentals: StockFundamentals = {
          ...(consensusRec?.fundamentals ?? {
            pe: null,
            forwardPe: null,
            pbv: null,
            roe: null,
            dividendYield: null,
            exDividendDate: null,
            marketCapBillion: null,
            volumeRatio20d: null,
            fiftyTwoWeekHigh: chartRes.meta?.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: chartRes.meta?.fiftyTwoWeekLow ?? null,
            cashBalanceStatus: resolved.market === "DR" ? "DR หุ้นต่างประเทศ" : "ตลาดต่างประเทศ",
          }),
          volumeRatio20d: technicals.volRatio,
          fiftyTwoWeekHigh:
            consensusRec?.fundamentals.fiftyTwoWeekHigh ?? chartRes.meta?.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow:
            consensusRec?.fundamentals.fiftyTwoWeekLow ?? chartRes.meta?.fiftyTwoWeekLow ?? null,
        };

        const brokerReports: BrokerReportItem[] = allBrokerFeed
          .filter((r) => r.symbol === resolved.symbol)
          .map((r) => ({
            ...r,
            currentPrice: livePrice,
            upsidePct:
              r.targetPrice && livePrice > 0
                ? Number((((r.targetPrice - livePrice) / livePrice) * 100).toFixed(1))
                : r.upsidePct,
          }));

        const pdfQuotes: PdfQuoteExtract[] = [];
        if (extractPdf) {
          const pdfCandidates = [
            ...brokerReports
              .filter((r) => r.pdfUrl || r.url.toLowerCase().endsWith(".pdf"))
              .map((r) => ({ broker: r.broker, title: r.headline, url: r.pdfUrl || r.url })),
            ...newsBundle.brokerWebResearch
              .filter((n) => n.link.toLowerCase().endsWith(".pdf"))
              .map((n) => ({ broker: n.source, title: n.title, url: n.link })),
          ].slice(0, 3);

          if (pdfCandidates.length > 0) {
            const extracted = await Promise.all(
              pdfCandidates.map((c) => extractPdfQuoteFromUrl({ ...c, timeoutMs: 4500 }))
            );
            pdfQuotes.push(...extracted);
          }
        }

        const companyName =
          consensusRec?.companyName ||
          (resolved.name !== resolved.symbol
            ? resolved.name
            : chartRes.meta?.longName || chartRes.meta?.shortName || resolved.symbol);

        const factSheetMarkdown = [
          `# Fact Sheet: ${resolved.symbol} (${companyName})`,
          `- ตลาด: ${mktCfg.flag} ${mktCfg.label} | สกุลเงิน: ${currency} (${unit}) | หมวดธุรกิจ: ${iaaConsensus.sector} | แท่งเทียนล่าสุด: ${technicals.candleTimestamp}`,
          `- ราคาล่าสุด: ${technicals.price.toFixed(2)} ${unit} (${technicals.change >= 0 ? "+" : ""}${technicals.change.toFixed(2)} / ${technicals.changePct >= 0 ? "+" : ""}${technicals.changePct.toFixed(2)}%)`,
          `- เทคนิค: ${technicals.trendLabel} | EMA20=${technicals.ema20 ?? "-"} | EMA50=${technicals.ema50 ?? "-"} | EMA200=${technicals.ema200 ?? "-"} | RSI(14)=${technicals.rsi14 ?? "-"} | MACD Hist=${technicals.macdHist ?? "-"} | Vol=${technicals.volRatio ?? "-"}x`,
          `- กรอบ 20D (${unit}): S1=${technicals.s1} | S2=${technicals.s2} | R1=${technicals.r1} | R2=${technicals.r2} | Stop Loss มาตรฐาน=${technicals.standardStop} | เป้าสั้น=${technicals.shortTarget}`,
          `- Smart Confluence S/R [Day]: แนวรับ ${srDaily.supports.map((l) => `${l.label}=${l.price} (-${l.distancePct}%, ${l.strength}★, ${l.sources.join("/")})`).join(" | ")} · แนวต้าน ${srDaily.resistances.map((l) => `${l.label}=${l.price} (+${l.distancePct}%, ${l.strength}★, ${l.sources.join("/")})`).join(" | ")} · Volume POC=${srDaily.pocPrice} · ตำแหน่งโซน: ${srDaily.zoneLabelTh}`,
          `- Smart Confluence S/R [Week]: แนวรับ ${srWeekly.supports.slice(0, 2).map((l) => `${l.label}=${l.price} (-${l.distancePct}%, ${l.strength}★)`).join(" | ")} · แนวต้าน ${srWeekly.resistances.slice(0, 2).map((l) => `${l.label}=${l.price} (+${l.distancePct}%, ${l.strength}★)`).join(" | ")} · POC Week=${srWeekly.pocPrice}`,
          `- พื้นฐาน: P/E=${fundamentals.pe ?? "-"}x | P/BV=${fundamentals.pbv ?? "-"}x | ROE=${fundamentals.roe ?? "-"}% | Yield=${fundamentals.dividendYield ?? "-"}% | Mkt Cap=${fundamentals.marketCapBillion ?? "-"}B ${currency} | 52W=${fundamentals.fiftyTwoWeekLow ?? "-"}-${fundamentals.fiftyTwoWeekHigh ?? "-"}`,
          `- Analyst Consensus (${iaaConsensus.totalBrokers} นักวิเคราะห์): ซื้อ ${iaaConsensus.buyCount} / ถือ ${iaaConsensus.holdCount} / ขาย ${iaaConsensus.sellCount} | เป้าเฉลี่ย ${iaaConsensus.avgTargetPrice ?? "-"} ${unit} (Upside ${iaaConsensus.upsidePct ?? "-"}% · ช่วง ${iaaConsensus.lowTargetPrice ?? "-"}-${iaaConsensus.highTargetPrice ?? "-"} ${unit}) | อ้างอิง: ${iaaConsensus.settradeUrl}`,
          brokerReports.length > 0
            ? `\n## บทวิเคราะห์สถาบัน/โบรกเกอร์ล่าสุด (${brokerReports.length} รายการ)\n${brokerReports
                .slice(0, 6)
                .map(
                  (r) =>
                    `- [${r.reportDate}] ${r.broker}: ${r.rating}${r.targetPrice ? ` เป้า ${r.targetPrice} ${unit}` : ""} — ${r.headline} (${r.url})`
                )
                .join("\n")}`
            : "",
          newsBundle.companyNews.length > 0
            ? `\n## ข่าวเฉพาะบริษัท 30 วันล่าสุด (${newsBundle.companyNews.length} รายการ)\n${newsBundle.companyNews
                .slice(0, 6)
                .map((n) => `- [${n.pubDate.slice(0, 10)}] ${n.title} (${n.source} · ${n.link})`)
                .join("\n")}`
            : "\n## ข่าวเฉพาะบริษัท 30 วันล่าสุด\n- ไม่พบข่าวเฉพาะบริษัทเด่นในรอบ 30 วัน",
          pdfQuotes.filter((p) => p.status === "extracted").length > 0
            ? `\n## ข้อความสกัดจากไฟล์ PDF บทวิเคราะห์\n${pdfQuotes
                .filter((p) => p.status === "extracted")
                .map((p) => `- ${p.broker}: ${p.excerpt.slice(0, 500)}`)
                .join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        const aiSynthesis = await synthesizeStockSinglePassAI({
          symbol: resolved.symbol,
          yahooSymbol: resolved.yahooSymbol,
          currency,
          marketLabel: mktCfg.label,
          companyName,
          technicals,
          fundamentals,
          iaaConsensus,
          brokerReports,
          companyNews: newsBundle.companyNews,
          pdfQuotes,
          factSheetMarkdown,
          modelOverride,
        });

        const extractedPdfCount = pdfQuotes.filter((p) => p.status === "extracted").length;
        const dataAudit: DataAuditItem[] = [
          {
            id: "yahoo",
            label: `ราคาและกราฟเทคนิค (${resolved.yahooSymbol} · Yahoo Finance)`,
            status: "live",
            detail: `${chartRes.bars.length} แท่งเทียนล่าสุด ณ ${technicals.candleTimestamp} (สกุลเงิน ${currency})`,
            url: `https://finance.yahoo.com/quote/${encodeURIComponent(resolved.yahooSymbol)}`,
            timestamp: now,
          },
          {
            id: "consensus",
            label: `Analyst Consensus (${iaaConsensus.totalBrokers} ราย · PDF ${extractedPdfCount})`,
            status:
              iaaConsensus.totalBrokers > 0
                ? "live"
                : brokerReports.length > 0
                  ? "partial"
                  : "unavailable",
            detail:
              iaaConsensus.avgTargetPrice !== null
                ? `เป้าเฉลี่ย ${iaaConsensus.avgTargetPrice.toFixed(2)} ${unit} (${iaaConsensus.buyCount} ซื้อ / ${iaaConsensus.holdCount} ถือ / ${iaaConsensus.sellCount} ขาย)`
                : "ยังไม่มีเป้าเฉลี่ย Consensus (คลิกดูต้นฉบับหรืออัปโหลด PDF เพิ่มได้)",
            url: iaaConsensus.settradeUrl,
            timestamp: now,
          },
          {
            id: "news",
            label: "ข่าวเฉพาะบริษัท & Wall Street (รอบ 30 วัน)",
            status: newsBundle.companyNews.length > 0 ? "live" : "partial",
            detail:
              newsBundle.companyNews.length > 0
                ? `พบ ${newsBundle.companyNews.length} ข่าวเกี่ยวข้อง ล่าสุด ${newsBundle.companyNews[0].pubDate.slice(0, 10)}`
                : "ไม่พบข่าวเฉพาะบริษัทเพิ่มเติมในรอบ 30 วัน",
            timestamp: now,
          },
        ];

        return {
          symbol: resolved.symbol,
          yahooSymbol: resolved.yahooSymbol,
          market: resolved.market,
          currency,
          lotSize: resolved.lotSize,
          companyName,
          sector: iaaConsensus.sector,
          industry: consensusRec?.industry ?? iaaConsensus.sector,
          description: `${mktCfg.flag} ${mktCfg.label} · หมวด${iaaConsensus.sector}`,
          fundamentals,
          technicals,
          iaaConsensus,
          brokerReports,
          companyNews: newsBundle.companyNews,
          brokerWebResearch: newsBundle.brokerWebResearch,
          pdfQuotes,
          aiSynthesis,
          factSheetMarkdown,
          dataAudit,
          srDaily,
          srWeekly,
          bars: chartRes.bars,
          intradayBars: intradayRes.ok ? intradayRes.bars : undefined,
          defaultPeers: getDefaultGlobalPeers(resolved),
          generatedAt: now,
        };
      },
      forceRefresh
    );

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ไม่สามารถวิเคราะห์หุ้นได้" },
      { status: 500 }
    );
  }
}
