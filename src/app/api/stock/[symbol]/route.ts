import { NextResponse } from "next/server";
import { synthesizeStockSinglePassAI } from "@/lib/ai/gemini";
import { getOrFetch } from "@/lib/cache";
import { fetchSingleStockConsensusAndFundamentals } from "@/lib/data/marketConsensus";
import { fetchCompanyNews30D, fetchDailyBrokerResearchFeeds } from "@/lib/data/news";
import { extractPdfQuoteFromUrl } from "@/lib/data/pdf";
import { fetchYahooChart } from "@/lib/data/yahoo";
import { computeTechnicalSummary } from "@/lib/quant/indicators";
import { getDefaultPeers, getStockMeta, normalizeThaiSymbol, toYahooSymbol } from "@/lib/set50";
import type {
  BrokerReportItem,
  DataAuditItem,
  IaaConsensusSummary,
  PdfQuoteExtract,
  StockAnalysisPayload,
  StockFundamentals,
} from "@/lib/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: rawParam } = await context.params;
    const symbol = normalizeThaiSymbol(rawParam);
    if (!symbol) {
      return NextResponse.json({ error: "กรุณาระบุชื่อย่อหุ้นไทย เช่น PTT, CPALL, BDMS, AAI" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const extractPdf = searchParams.get("extractPdf") !== "0";
    const includeIntraday = searchParams.get("intraday") === "1";
    const modelOverride = searchParams.get("model") || undefined;

    const cacheKey = `api:stock:${symbol}:pdf=${extractPdf}:intra=${includeIntraday}:m=${modelOverride ?? "def"}`;

    const payload = await getOrFetch<StockAnalysisPayload>(
      cacheKey,
      8 * 60 * 1000,
      async () => {
        const now = new Date().toISOString();
        const meta = getStockMeta(symbol);
        const yahooSymbol = toYahooSymbol(symbol);

        // Step 1-2: Parallel fetch OHLCV, Consensus/Fundamentals, 30D News, Daily Broker Feed, optional Intraday
        const [chartRes, consensusRec, newsBundle, allBrokerFeed, intradayRes] =
          await Promise.all([
            fetchYahooChart(yahooSymbol, "1y", "1d", forceRefresh),
            fetchSingleStockConsensusAndFundamentals(symbol, forceRefresh),
            fetchCompanyNews30D(symbol, forceRefresh),
            fetchDailyBrokerResearchFeeds(undefined, forceRefresh),
            includeIntraday
              ? fetchYahooChart(yahooSymbol, "5d", "5m", forceRefresh)
              : Promise.resolve({ bars: [], meta: null, ok: false }),
          ]);

        if (!chartRes.ok || chartRes.bars.length === 0) {
          throw new Error(
            `ไม่พบข้อมูลราคาของหุ้น "${symbol}" ในตลาดหลักทรัพย์ไทย (SET/mai) กรุณาตรวจสอบชื่อย่อหุ้นอีกครั้ง`
          );
        }

        const technicals = computeTechnicalSummary(chartRes.bars);
        const livePrice = technicals.price;

        const iaaConsensus: IaaConsensusSummary = consensusRec?.consensus ?? {
          symbol,
          companyName: meta.nameTh,
          sector: meta.sector,
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
          source: "Settrade / Consensus ตลาดหุ้นไทย",
          settradeUrl: `https://www.settrade.com/th/equities/quote/${encodeURIComponent(symbol)}/analyst-consensus`,
          updatedAt: now,
        };

        // Ensure upsidePct uses freshest price
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
            cashBalanceStatus: "ปกติ",
          }),
          volumeRatio20d: technicals.volRatio,
          fiftyTwoWeekHigh:
            consensusRec?.fundamentals.fiftyTwoWeekHigh ?? chartRes.meta?.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow:
            consensusRec?.fundamentals.fiftyTwoWeekLow ?? chartRes.meta?.fiftyTwoWeekLow ?? null,
        };

        // Filter broker reports for this ticker & enrich with live upside
        const brokerReports: BrokerReportItem[] = allBrokerFeed
          .filter((r) => r.symbol === symbol)
          .map((r) => ({
            ...r,
            currentPrice: livePrice,
            upsidePct:
              r.targetPrice && livePrice > 0
                ? Number((((r.targetPrice - livePrice) / livePrice) * 100).toFixed(1))
                : r.upsidePct,
          }));

        // Step 3: Toggleable PDF quote extraction (with strict 4.5s timeout guard)
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
              pdfCandidates.map((c) =>
                extractPdfQuoteFromUrl({ ...c, timeoutMs: 4500 })
              )
            );
            pdfQuotes.push(...extracted);
          }
        }

        const companyName =
          consensusRec?.companyName ||
          (meta.nameTh !== symbol
            ? `${meta.nameTh}${chartRes.meta?.shortName ? ` (${chartRes.meta.shortName})` : ""}`
            : chartRes.meta?.longName || chartRes.meta?.shortName || symbol);

        // Build transparent Verified Fact Sheet Markdown (passed to Gemini AND shown to user!)
        const factSheetMarkdown = [
          `# Fact Sheet: ${symbol} (${companyName})`,
          `- หมวดธุรกิจ: ${iaaConsensus.sector} | แท่งเทียนล่าสุด: ${technicals.candleTimestamp}`,
          `- ราคาล่าสุด: ${technicals.price.toFixed(2)} บ. (${technicals.change >= 0 ? "+" : ""}${technicals.change.toFixed(2)} / ${technicals.changePct >= 0 ? "+" : ""}${technicals.changePct.toFixed(2)}%)`,
          `- เทคนิค: ${technicals.trendLabel} | EMA20=${technicals.ema20 ?? "-"} | EMA50=${technicals.ema50 ?? "-"} | EMA200=${technicals.ema200 ?? "-"} | RSI(14)=${technicals.rsi14 ?? "-"} | MACD Hist=${technicals.macdHist ?? "-"} | Vol=${technicals.volRatio ?? "-"}x`,
          `- กรอบ 20D: S1=${technicals.s1} | S2=${technicals.s2} | R1=${technicals.r1} | R2=${technicals.r2} | Stop Loss มาตรฐาน=${technicals.standardStop} | เป้าสั้น=${technicals.shortTarget}`,
          `- พื้นฐาน: P/E=${fundamentals.pe ?? "-"}x | P/BV=${fundamentals.pbv ?? "-"}x | ROE=${fundamentals.roe ?? "-"}% | Yield=${fundamentals.dividendYield ?? "-"}% | Mkt Cap=${fundamentals.marketCapBillion ?? "-"} พันลบ. | 52W=${fundamentals.fiftyTwoWeekLow ?? "-"}-${fundamentals.fiftyTwoWeekHigh ?? "-"}`,
          `- IAA / Analyst Consensus (${iaaConsensus.totalBrokers} โบรกฯ): ซื้อ ${iaaConsensus.buyCount} / ถือ ${iaaConsensus.holdCount} / ขาย ${iaaConsensus.sellCount} | เป้าเฉลี่ย ${iaaConsensus.avgTargetPrice ?? "-"} บ. (Upside ${iaaConsensus.upsidePct ?? "-"}% · ช่วง ${iaaConsensus.lowTargetPrice ?? "-"}-${iaaConsensus.highTargetPrice ?? "-"} บ.) | อ้างอิง: ${iaaConsensus.settradeUrl}`,
          brokerReports.length > 0
            ? `\n## บทวิเคราะห์โบรกเกอร์ล่าสุด (${brokerReports.length} รายการ)\n${brokerReports
                .slice(0, 6)
                .map(
                  (r) =>
                    `- [${r.reportDate}] ${r.broker}: ${r.rating}${r.targetPrice ? ` เป้า ${r.targetPrice} บ.` : ""} — ${r.headline} (${r.url})`
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
            ? `\n## ข้อความสกัดจากไฟล์ PDF โบรกเกอร์\n${pdfQuotes
                .filter((p) => p.status === "extracted")
                .map((p) => `- ${p.broker}: ${p.excerpt.slice(0, 500)}`)
                .join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        // Step 4: Single-Pass JSON AI Synthesis
        const aiSynthesis = await synthesizeStockSinglePassAI({
          symbol,
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
            label: "ราคาและกราฟเทคนิค (Yahoo Finance)",
            status: "live",
            detail: `${chartRes.bars.length} แท่งเทียนล่าสุด ณ ${technicals.candleTimestamp} (ดีเลย์ ~15 นาที)`,
            url: `https://finance.yahoo.com/quote/${yahooSymbol}`,
            timestamp: now,
          },
          {
            id: "iaa",
            label: `IAA / Consensus (${iaaConsensus.totalBrokers} โบรกฯ · PDF ${extractedPdfCount} ฉบับ)`,
            status:
              iaaConsensus.totalBrokers > 0
                ? "live"
                : brokerReports.length > 0
                  ? "partial"
                  : "unavailable",
            detail:
              iaaConsensus.avgTargetPrice !== null
                ? `เป้าเฉลี่ย ${iaaConsensus.avgTargetPrice.toFixed(2)} บ. (${iaaConsensus.buyCount} ซื้อ / ${iaaConsensus.holdCount} ถือ / ${iaaConsensus.sellCount} ขาย)`
                : "ยังไม่มีเป้าเฉลี่ย Consensus (คลิกตรวจสอบที่ Settrade หรืออัปโหลด PDF โบรกฯ เพิ่มได้)",
            url: iaaConsensus.settradeUrl,
            timestamp: now,
          },
          {
            id: "news",
            label: `ข่าวเฉพาะบริษัท (คัดกรอง 30 วัน)`,
            status: newsBundle.companyNews.length > 0 ? "live" : "partial",
            detail:
              newsBundle.companyNews.length > 0
                ? `พบ ${newsBundle.companyNews.length} ข่าวเกี่ยวข้อง ล่าสุด ${newsBundle.companyNews[0].pubDate.slice(0, 10)}`
                : "ไม่พบข่าวเฉพาะบริษัทเพิ่มเติมในรอบ 30 วัน",
            timestamp: now,
          },
        ];

        return {
          symbol,
          yahooSymbol,
          companyName,
          sector: iaaConsensus.sector,
          industry: consensusRec?.industry ?? iaaConsensus.sector,
          description: `หุ้นจดทะเบียนตลาดหลักทรัพย์แห่งประเทศไทย หมวด${iaaConsensus.sector}${meta.isSet50 ? " (อยู่ในดัชนี SET50)" : ""}`,
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
          bars: chartRes.bars,
          intradayBars: intradayRes.ok ? intradayRes.bars : undefined,
          defaultPeers: getDefaultPeers(symbol),
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
