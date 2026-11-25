import { createChatStreamAI } from "@/lib/ai/gemini";
import {
  fetchMarketConsensusByMarket,
  fetchSingleStockConsensusAndFundamentals,
} from "@/lib/data/marketConsensus";
import { fetchCompanyNews30D, fetchDailyBrokerResearchFeeds } from "@/lib/data/news";
import { fetchFxRatesToThb, fetchYahooBatchCharts, fetchYahooChart } from "@/lib/data/yahoo";
import {
  currencySymbol,
  extractGlobalTickersFromText,
  getUniverseByMarket,
  MARKET_CONFIGS,
  parseMarketId,
  resolveStockSymbol,
  type GlobalStockMeta,
} from "@/lib/markets";
import { computeTechnicalSummary } from "@/lib/quant/indicators";
import { buildWeeklyPortfolio360 } from "@/lib/quant/portfolio360";
import { detectTechnicalSetup } from "@/lib/quant/scanner";
import { aggregateWeeklyBars, computeSmartSupportResistance } from "@/lib/quant/supportResistance";
import { runTimeMachineSimulation } from "@/lib/quant/timeMachine";
import type { MarketId, PaperTradeEntry } from "@/lib/types";

function detectMarketIntent(text: string, fallbackMarket: MarketId): MarketId {
  if (/\bdr\b|nvda80|aapl80|tencent80|baba80|bydcom80|ndx01|sp50001|cn01|hk01/i.test(text)) {
    return "DR";
  }
  if (/nasdaq|แนสแด็ก|ndx/i.test(text)) return "NASDAQ100";
  if (/s&p\s*500|sp500|เอสแอนด์พี|dow\s*jones|หุ้นเมกา|หุ้นสหรัฐ/i.test(text)) return "SP500";
  if (/ฮ่องกง|hkex|hang\s*seng|ฮั่งเส็ง|\.hk\b/i.test(text)) return "HK";
  if (/หุ้นจีน|จีนแผ่นดินใหญ่|a-share|เซี่ยงไฮ้|เซินเจิ้น|adr|shanghai|shenzhen|\.(ss|sz)\b/i.test(text)) {
    return "CHINA";
  }
  return fallbackMarket;
}

function detectAllTickersFromPrompt(text: string, defaultMarket: MarketId): GlobalStockMeta[] {
  const found = new Map<string, GlobalStockMeta>();

  for (const g of extractGlobalTickersFromText(text)) {
    found.set(g.symbol, g);
  }

  // Explicit ticker pattern e.g. "วิเคราะห์ SMCI" or "หุ้น COIN"
  const explicitMatch = text.match(/(?:หุ้น|วิเคราะห์|ดู|แผนเทรด|เช็ก)\s+([A-Z0-9^][A-Z0-9.\-&]{1,10})\b/i);
  if (explicitMatch?.[1]) {
    const cand = explicitMatch[1].toUpperCase();
    const skip = new Set([
      "SP500", "NASDAQ", "NASDAQ100", "CHINA", "HKEX", "AI", "RSI", "EMA", "MACD",
      "PDF", "BREAKOUT", "PULLBACK", "OVERSOLD", "PAPER", "TRADE", "USD", "HKD", "CNY", "THB",
    ]);
    if (!skip.has(cand) && !found.has(cand)) {
      const r = resolveStockSymbol(cand, defaultMarket);
      found.set(r.symbol, r);
    }
  }

  return Array.from(found.values()).slice(0, 2);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: { role: "user" | "assistant"; content: string }[];
      paperTrades?: PaperTradeEntry[];
      activeSymbol?: string;
      activeMarket?: MarketId;
      model?: string;
    };

    const messages = (body.messages ?? []).filter((m) => m.content?.trim());
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "กรุณาพิมพ์ข้อความคำถาม" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const latestUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const fallbackMarket = parseMarketId(body.activeMarket, "NASDAQ100");
    const targetMarket = detectMarketIntent(latestUserMsg, fallbackMarket);
    const detectedMetas = detectAllTickersFromPrompt(latestUserMsg, targetMarket);

    const wantsScanner = /breakout|pullback|oversold|สแกน|กราฟสวย|หุ้นเด่น|ตัวไหนน่า/i.test(latestUserMsg);
    const wantsPortfolio360 = /พอร์ตจำลอง|360|รายสัปดาห์|สัปดาห์นี้|วันจันทร์/i.test(latestUserMsg);
    const wantsBrokerToday = /โบรก|consensus|บทวิเคราะห์|เป้าหมาย|เชียร์|wall\s*street/i.test(latestUserMsg);

    const contextBlocks: string[] = [];
    const fxRates = await fetchFxRatesToThb();
    contextBlocks.push(
      `วันที่ปัจจุบัน: ${new Date().toISOString().slice(0, 10)} | อัตราแลกเปลี่ยนอ้างอิง: USD/THB=${fxRates.USD.toFixed(2)} ฿ · HKD/THB=${fxRates.HKD.toFixed(2)} ฿ · CNY/THB=${fxRates.CNY.toFixed(2)} ฿`
    );

    // 1. Live Single-Stock / Index / ETF / DR Deep Context with Smart Confluence S/R (Day & Week)
    if (detectedMetas.length > 0) {
      await Promise.all(
        detectedMetas.map(async (resolved) => {
          const chart = await fetchYahooChart(resolved.yahooSymbol, "2y", "1d", false, true);

          if (!chart.ok || chart.bars.length === 0) {
            contextBlocks.push(`## ${resolved.symbol}\n- ไม่พบข้อมูลราคาตลาดของ ${resolved.symbol}`);
            return;
          }

          const [consensus, news] = await Promise.all([
            fetchSingleStockConsensusAndFundamentals(resolved.symbol, false, resolved.market),
            fetchCompanyNews30D(resolved.symbol, false, resolved.market),
          ]);

          const unit = currencySymbol(resolved.currency);
          const tech = computeTechnicalSummary(chart.bars, resolved.currency);
          const srDaily = computeSmartSupportResistance(chart.bars, resolved.currency, "day");
          const srWeekly = computeSmartSupportResistance(
            aggregateWeeklyBars(chart.bars),
            resolved.currency,
            "week"
          );
          const tm = runTimeMachineSimulation({
            symbol: resolved.symbol,
            bars: chart.bars.slice(-260),
            entry: tech.price,
            stop: tech.standardStop,
            target: tech.shortTarget,
            horizon: "10d",
            simulations: 10_000,
          });
          const iaa = consensus?.consensus;
          const fund = consensus?.fundamentals;
          const mktLabel = `${MARKET_CONFIGS[resolved.market].flag} ${MARKET_CONFIGS[resolved.market].label}`;

          contextBlocks.push(
            [
              `## ข้อมูลสด 360° ของ ${resolved.symbol} (${resolved.name} · ${mktLabel} · สกุลเงิน ${resolved.currency})`,
              `- ราคาปิดล่าสุด: ${tech.price.toFixed(2)} ${unit} (${tech.changePct >= 0 ? "+" : ""}${tech.changePct.toFixed(2)}%) ณ ${tech.candleTimestamp}`,
              `- แนวโน้มเทคนิค: ${tech.trendLabel} | EMA20=${tech.ema20 ?? "-"} | EMA50=${tech.ema50 ?? "-"} | EMA200=${tech.ema200 ?? "-"} | RSI(14)=${tech.rsi14 ?? "-"} | Vol=${tech.volRatio ?? "-"}x`,
              `- Smart Confluence แนวรับ-แนวต้าน [Day] (${unit}):`,
              `  * แนวรับ: ${srDaily.supports.map((l) => `${l.label}=${l.price} (ห่าง -${l.distancePct}%, ${l.strength}★, ทดสอบ ${l.touches} ครั้ง, แหล่ง: ${l.sources.join("/")})`).join(" | ")}`,
              `  * แนวต้าน: ${srDaily.resistances.map((l) => `${l.label}=${l.price} (ห่าง +${l.distancePct}%, ${l.strength}★, ทดสอบ ${l.touches} ครั้ง, แหล่ง: ${l.sources.join("/")})`).join(" | ")}`,
              `  * Volume POC=${srDaily.pocPrice} | Fibonacci 38.2%/50%/61.8%: ${srDaily.fibLevels.filter((f) => [0.382, 0.5, 0.618].includes(f.ratio)).map((f) => `${f.label}=${f.price}`).join(", ")} | โซนราคา: ${srDaily.zoneLabelTh}`,
              `- Smart Confluence แนวรับ-แนวต้าน [Week ระยะกลาง-ยาว] (${unit}): แนวรับ ${srWeekly.supports.slice(0, 2).map((l) => `${l.label}=${l.price} (${l.strength}★)`).join(" / ")} | แนวต้าน ${srWeekly.resistances.slice(0, 2).map((l) => `${l.label}=${l.price} (${l.strength}★)`).join(" / ")} | POC Week=${srWeekly.pocPrice}`,
              `- กรอบแผนเทรดมาตรฐาน (${unit}): Entry=${tech.price} | Stop=${tech.standardStop} | Target=${tech.shortTarget} | R:R=1:${tm.rrRatio}`,
              `- Time Machine 10,000 รอบ (Swing 10 วันทำการ): โอกาสถึงเป้าก่อน ${tm.hitTargetPct}% | ชน Stop ก่อน ${tm.hitStopPct}% | ไม่ถึงทั้งคู่ ${tm.unresolvedPct}% | Expectancy ${tm.expectancyR >= 0 ? "+" : ""}${tm.expectancyR}R (${tm.verdictLabel})`,
              iaa && iaa.avgTargetPrice
                ? `- Analyst Consensus (${iaa.totalBrokers} ราย): เป้าเฉลี่ย ${iaa.avgTargetPrice.toFixed(2)} ${unit} (Upside ${iaa.upsidePct?.toFixed(1)}% · ช่วง ${iaa.lowTargetPrice ?? "-"}-${iaa.highTargetPrice ?? "-"}) | ซื้อ ${iaa.buyCount} / ถือ ${iaa.holdCount} / ขาย ${iaa.sellCount}`
                : "",
              fund
                ? `- พื้นฐาน: P/E=${fund.pe ?? "-"}x | P/BV=${fund.pbv ?? "-"}x | ROE=${fund.roe ?? "-"}% | Yield=${fund.dividendYield ?? "-"}%`
                : "",
              news.companyNews.length > 0
                ? `- ข่าวล่าสุด 30 วัน:\n${news.companyNews
                    .slice(0, 3)
                    .map((n) => `  * [${n.pubDate.slice(0, 10)}] ${n.title} (${n.source})`)
                    .join("\n")}`
                : "",
            ]
              .filter(Boolean)
              .join("\n")
          );
        })
      );
    }

    // 2. Technical Scanner context for detected global market
    if (wantsScanner) {
      const universe = getUniverseByMarket(targetMarket);
      const batch = await fetchYahooBatchCharts(
        universe.map((u) => u.yahooSymbol),
        "1y",
        12,
        false,
        true
      );
      const setups = universe
        .map((u) => {
          const c = batch.get(u.yahooSymbol);
          return c?.ok ? detectTechnicalSetup(u.symbol, c.bars, targetMarket) : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      contextBlocks.push(
        `## ผลสแกนกราฟเทคนิค ${MARKET_CONFIGS[targetMarket].label} ล่าสุด (พบ ${setups.length} Setup)\n` +
          setups
            .slice(0, 10)
            .map(
              (s) =>
                `- ${s.symbol} [${s.setupType}] ราคา ${s.price} ${currencySymbol(s.currency)} (${s.changePct1d >= 0 ? "+" : ""}${s.changePct1d}%) | Entry ${s.entry} / Stop ${s.stop} / Target ${s.target} (R:R 1:${s.rrRatio}) | ${s.reasonTh}`
            )
            .join("\n")
      );
    }

    // 3. Wall Street / Institutional Research Feed
    if (wantsBrokerToday && detectedMetas.length === 0) {
      const reports = await fetchDailyBrokerResearchFeeds(undefined, false, targetMarket);
      contextBlocks.push(
        `## บทวิเคราะห์สถาบัน/Wall Street ล่าสุด (${MARKET_CONFIGS[targetMarket].label})\n` +
          reports
            .slice(0, 10)
            .map(
              (r) =>
                `- [${r.reportDate}] ${r.symbol} · ${r.broker}: ${r.rating}${r.targetPrice ? ` เป้า ${r.targetPrice} ${currencySymbol(r.currency)}` : ""} — ${r.headline}`
            )
            .join("\n")
      );
    }

    // 4. Weekly 360° Portfolio context for detected global market
    if (wantsPortfolio360) {
      const mCfg = MARKET_CONFIGS[targetMarket];
      const universeMeta = getUniverseByMarket(targetMarket);
      const [benchChart, batch, consensusRes] = await Promise.all([
        fetchYahooChart(mCfg.benchmarkYahoo, "1y", "1d", false, true),
        fetchYahooBatchCharts(
          universeMeta.map((u) => u.yahooSymbol),
          "1y",
          12,
          false,
          true
        ),
        fetchMarketConsensusByMarket(targetMarket, false),
      ]);
      const iaaMap = new Map(consensusRes.records.map((r) => [r.symbol, r.consensus]));
      const universe = universeMeta
        .map((u) => ({
          symbol: u.symbol,
          bars: batch.get(u.yahooSymbol)?.bars ?? [],
          iaa: iaaMap.get(u.symbol) ?? null,
        }))
        .filter((u) => u.bars.length >= 45);
      const weekly = buildWeeklyPortfolio360({
        universe,
        setBars: benchChart.bars,
        market: targetMarket,
      });
      contextBlocks.push(
        `## พอร์ตจำลองรายสัปดาห์ 360° (${mCfg.label} · ${weekly.weekLabel} | พอร์ต ${weekly.totalPnlPct >= 0 ? "+" : ""}${weekly.totalPnlPct}% vs ${mCfg.benchmarkLabel} ${weekly.setWeekReturnPct >= 0 ? "+" : ""}${weekly.setWeekReturnPct}%)\n` +
          weekly.picks
            .map(
              (p) =>
                `- #${p.rank} ${p.symbol} (คะแนน ${p.scores.total}/100): เข้า ${p.entryPrice} ปัจจุบัน ${p.currentPrice} (${p.pnlPct >= 0 ? "+" : ""}${p.pnlPct}%) | Stop ${p.stopLoss} / Target ${p.targetPrice} | 5D Win ${p.winRate5dPct}% | ${p.rationaleTh}`
            )
            .join("\n")
      );
    }

    // 5. User's Personal Paper Trade Journal context
    const paperTrades = body.paperTrades ?? [];
    if (paperTrades.length > 0) {
      contextBlocks.push(
        `## พอร์ต Paper Trade ส่วนตัวของผู้ใช้ (${paperTrades.length} รายการ)\n` +
          paperTrades
            .slice(0, 15)
            .map(
              (t) =>
                `- [${t.status.toUpperCase()}] ${t.symbol} (${t.currency ?? "USD"}): ${t.shares.toLocaleString()} หุ้น @ ${t.entryPrice} | Stop ${t.stopLoss} | Target ${t.targetPrice}${t.exitPrice ? ` | ปิดที่ ${t.exitPrice}` : ""} | กลยุทธ์: ${t.strategy || "-"} | โน้ต: ${t.note || "-"}`
            )
            .join("\n")
      );
    } else if (/พอร์ต|paper/i.test(latestUserMsg)) {
      contextBlocks.push("## พอร์ต Paper Trade ส่วนตัวของผู้ใช้\n- ยังไม่มีรายการในสมุดจด Paper Trade");
    }

    const liveContextMarkdown = contextBlocks.join("\n\n");
    const { stream, modelUsed } = await createChatStreamAI({
      messages,
      liveContextMarkdown,
      modelOverride: body.model,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `\n\n[เกิดข้อผิดพลาดระหว่างเชื่อมต่อ Gemini API: ${err instanceof Error ? err.message : "Unknown error"}]`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Model-Used": modelUsed,
        "X-Detected-Tickers": detectedMetas.map((m) => m.symbol).join(","),
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "AI Chat Bot ขัดข้องชั่วคราว" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
