import { createChatStreamAI } from "@/lib/ai/gemini";
import { fetchMarketConsensusAll, fetchSingleStockConsensusAndFundamentals } from "@/lib/data/marketConsensus";
import { fetchCompanyNews30D, fetchDailyBrokerResearchFeeds } from "@/lib/data/news";
import { fetchYahooBatchCharts, fetchYahooChart } from "@/lib/data/yahoo";
import { computeTechnicalSummary } from "@/lib/quant/indicators";
import { buildWeeklyPortfolio360 } from "@/lib/quant/portfolio360";
import { detectTechnicalSetup } from "@/lib/quant/scanner";
import { runTimeMachineSimulation } from "@/lib/quant/timeMachine";
import { extractThaiTickersFromText, getStockMeta, SET50_SYMBOLS, toYahooSymbol } from "@/lib/set50";
import type { PaperTradeEntry } from "@/lib/types";

const THAI_ALIAS_TO_TICKER: [RegExp, string][] = [
  [/ปตท\.?\s*สผ/i, "PTTEP"],
  [/ปตท/i, "PTT"],
  [/ซีพี\s*ออลล์/i, "CPALL"],
  [/กสิกร/i, "KBANK"],
  [/ไทยพาณิชย์/i, "SCB"],
  [/กรุงไทย/i, "KTB"],
  [/กรุงเทพ(?!ดุสิต)/i, "BBL"],
  [/กรุงเทพดุสิต|หมอเสริฐ/i, "BDMS"],
  [/บำรุงราษฎร์/i, "BH"],
  [/ท่าอากาศยาน|การท่า/i, "AOT"],
  [/แอดวานซ์|เอไอเอส/i, "ADVANC"],
  [/ทรู/i, "TRUE"],
  [/กัลฟ์/i, "GULF"],
  [/เดลต้า/i, "DELTA"],
  [/เซ็นทรัลพัฒนา/i, "CPN"],
  [/ปูนใหญ่|ปูนซิเมนต์/i, "SCC"],
  [/โฮมโปร/i, "HMPRO"],
  [/เมืองไทย\s*แคปปิตอล/i, "MTC"],
  [/ศรีสวัสดิ์/i, "SAWAD"],
  [/ติดล้อ/i, "TIDLOR"],
];

function detectTickersFromPrompt(text: string): string[] {
  const found = new Set<string>(extractThaiTickersFromText(text));
  for (const [re, sym] of THAI_ALIAS_TO_TICKER) {
    if (re.test(text)) found.add(sym);
  }
  // Also catch explicit uppercase standalone tickers that might not be in our 100-stock dictionary (e.g. "วิเคราะห์ TISCO" or "หุ้น XYZ")
  const explicitMatch = text.match(/(?:หุ้น|วิเคราะห์|ดู|แผนเทรด|เช็ก)\s+([A-Z][A-Z0-9&-]{1,8})\b/i);
  if (explicitMatch?.[1]) {
    const cand = explicitMatch[1].toUpperCase();
    if (!["SET", "SET50", "SET100", "MAI", "IAA", "AI", "RSI", "EMA", "MACD", "PDF"].includes(cand)) {
      found.add(cand);
    }
  }
  return Array.from(found).slice(0, 2);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: { role: "user" | "assistant"; content: string }[];
      paperTrades?: PaperTradeEntry[];
      activeSymbol?: string;
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
    const detectedTickers = detectTickersFromPrompt(latestUserMsg);
    const wantsScanner = /breakout|pullback|oversold|สแกน|กราฟสวย|หุ้นเด่น|ตัวไหนน่า/i.test(latestUserMsg);
    const wantsPortfolio360 = /พอร์ตจำลอง|360|รายสัปดาห์|สัปดาห์นี้|วันจันทร์/i.test(latestUserMsg);
    const wantsBrokerToday = /โบรก|iaa|บทวิเคราะห์|เป้าหมาย|เชียร์/i.test(latestUserMsg);

    const contextBlocks: string[] = [];
    contextBlocks.push(`วันที่ปัจจุบัน: ${new Date().toISOString().slice(0, 10)}`);

    // 1. Live Single-Stock Deep Context (Price + Technicals + IAA + 10,000-run Time Machine + News)
    if (detectedTickers.length > 0) {
      await Promise.all(
        detectedTickers.map(async (sym) => {
          const [chart, consensus, news] = await Promise.all([
            fetchYahooChart(toYahooSymbol(sym), "1y", "1d"),
            fetchSingleStockConsensusAndFundamentals(sym),
            fetchCompanyNews30D(sym),
          ]);
          if (!chart.ok || chart.bars.length === 0) {
            contextBlocks.push(`## หุ้น ${sym}\n- ไม่พบข้อมูลราคาตลาด SET/mai ของ ${sym}`);
            return;
          }
          const tech = computeTechnicalSummary(chart.bars);
          const tm = runTimeMachineSimulation({
            symbol: sym,
            bars: chart.bars.slice(-260),
            entry: tech.price,
            stop: tech.standardStop,
            target: tech.shortTarget,
            horizon: "10d",
            simulations: 10_000,
          });
          const meta = getStockMeta(sym);
          const iaa = consensus?.consensus;
          const fund = consensus?.fundamentals;

          contextBlocks.push(
            [
              `## ข้อมูลสด 360° ของหุ้น ${sym} (${meta.nameTh} · ${iaa?.sector ?? meta.sector})`,
              `- ราคาปิดล่าสุด: ${tech.price.toFixed(2)} บ. (${tech.changePct >= 0 ? "+" : ""}${tech.changePct.toFixed(2)}%) ณ ${tech.candleTimestamp}`,
              `- แนวโน้มเทคนิค: ${tech.trendLabel} | EMA20=${tech.ema20 ?? "-"} | EMA50=${tech.ema50 ?? "-"} | EMA200=${tech.ema200 ?? "-"} | RSI(14)=${tech.rsi14 ?? "-"} | Vol=${tech.volRatio ?? "-"}x`,
              `- แนวรับ-แนวต้าน 20D: S1=${tech.s1} / S2=${tech.s2} | R1=${tech.r1} / R2=${tech.r2}`,
              `- กรอบแผนเทรดมาตรฐาน: Entry=${tech.price} | Stop=${tech.standardStop} | Target=${tech.shortTarget} | R:R=1:${tm.rrRatio}`,
              `- Time Machine 10,000 รอบ (Swing 10 วันทำการ): โอกาสถึงเป้าก่อน ${tm.hitTargetPct}% | ชน Stop ก่อน ${tm.hitStopPct}% | ไม่ถึงทั้งคู่ ${tm.unresolvedPct}% | Expectancy ${tm.expectancyR >= 0 ? "+" : ""}${tm.expectancyR}R (${tm.verdictLabel}) | ย้อนเช็กกราฟจริง ${tm.historicalBackcheck.totalCases} รอบ (ชนเป้า ${tm.historicalBackcheck.hitTarget}, โดน Stop ${tm.historicalBackcheck.hitStop})`,
              iaa && iaa.avgTargetPrice
                ? `- IAA / Analyst Consensus (${iaa.totalBrokers} โบรกฯ): เป้าเฉลี่ย ${iaa.avgTargetPrice.toFixed(2)} บ. (Upside ${iaa.upsidePct?.toFixed(1)}% · ช่วง ${iaa.lowTargetPrice ?? "-"}-${iaa.highTargetPrice ?? "-"}) | ซื้อ ${iaa.buyCount} / ถือ ${iaa.holdCount} / ขาย ${iaa.sellCount}`
                : `- IAA / Analyst Consensus: ยังไม่มีเป้าเฉลี่ยชัดเจน`,
              fund
                ? `- พื้นฐาน: P/E=${fund.pe ?? "-"}x | P/BV=${fund.pbv ?? "-"}x | ROE=${fund.roe ?? "-"}% | Yield=${fund.dividendYield ?? "-"}% | MktCap=${fund.marketCapBillion ?? "-"} พันลบ.`
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

    // 2. SET50 Technical Scanner context if requested
    if (wantsScanner) {
      const batch = await fetchYahooBatchCharts(SET50_SYMBOLS, "1y", 12);
      const setups = SET50_SYMBOLS.map((sym) => {
        const c = batch.get(sym);
        return c?.ok ? detectTechnicalSetup(sym, c.bars) : null;
      }).filter((x): x is NonNullable<typeof x> => x !== null);

      contextBlocks.push(
        `## ผลสแกนกราฟเทคนิค SET50 ล่าสุด (พบ ${setups.length} Setup)\n` +
          setups
            .slice(0, 10)
            .map(
              (s) =>
                `- ${s.symbol} [${s.setupType}] ราคา ${s.price} (${s.changePct1d >= 0 ? "+" : ""}${s.changePct1d}%) | Entry ${s.entry} / Stop ${s.stop} / Target ${s.target} (R:R 1:${s.rrRatio}) | ${s.reasonTh}`
            )
            .join("\n")
      );
    }

    // 3. Broker Research Feed if asked
    if (wantsBrokerToday && detectedTickers.length === 0) {
      const reports = await fetchDailyBrokerResearchFeeds();
      contextBlocks.push(
        `## บทวิเคราะห์โบรกเกอร์ออกใหม่ล่าสุด\n` +
          reports
            .slice(0, 10)
            .map(
              (r) =>
                `- [${r.reportDate}] ${r.symbol} · ${r.broker}: ${r.rating}${r.targetPrice ? ` เป้า ${r.targetPrice} บ.` : ""} — ${r.headline}`
            )
            .join("\n")
      );
    }

    // 4. Weekly 360° Portfolio context if asked
    if (wantsPortfolio360) {
      const [setChart, batch, consensusRes] = await Promise.all([
        fetchYahooChart("^SET.BK", "1y", "1d"),
        fetchYahooBatchCharts(SET50_SYMBOLS, "1y", 12),
        fetchMarketConsensusAll(false),
      ]);
      const iaaMap = new Map(consensusRes.records.map((r) => [r.symbol, r.consensus]));
      const universe = SET50_SYMBOLS.map((sym) => ({
        symbol: sym,
        bars: batch.get(sym)?.bars ?? [],
        iaa: iaaMap.get(sym) ?? null,
      })).filter((u) => u.bars.length >= 45);
      const weekly = buildWeeklyPortfolio360({ universe, setBars: setChart.bars });
      contextBlocks.push(
        `## พอร์ตจำลองรายสัปดาห์ 360° (${weekly.weekLabel} | พอร์ต ${weekly.totalPnlPct >= 0 ? "+" : ""}${weekly.totalPnlPct}% vs SET ${weekly.setWeekReturnPct >= 0 ? "+" : ""}${weekly.setWeekReturnPct}%)\n` +
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
                `- [${t.status.toUpperCase()}] ${t.symbol}: ${t.shares.toLocaleString()} หุ้น @ ${t.entryPrice} บ. | Stop ${t.stopLoss} | Target ${t.targetPrice}${t.exitPrice ? ` | ปิดที่ ${t.exitPrice}` : ""} | กลยุทธ์: ${t.strategy || "-"} | โน้ต: ${t.note || "-"}`
            )
            .join("\n")
      );
    } else if (/พอร์ต|paper/i.test(latestUserMsg)) {
      contextBlocks.push(`## พอร์ต Paper Trade ส่วนตัวของผู้ใช้\n- ยังไม่มีรายการในสมุดจด Paper Trade`);
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
        "X-Detected-Tickers": detectedTickers.join(","),
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "AI Chat Bot ขัดข้องชั่วคราว" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
