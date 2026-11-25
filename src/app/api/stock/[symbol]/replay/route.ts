import { NextResponse } from "next/server";
import { runPointInTimeReplayAI } from "@/lib/ai/gemini";
import { fetchCompanyNews30D } from "@/lib/data/news";
import { fetchYahooChart } from "@/lib/data/yahoo";
import { resolveStockSymbol } from "@/lib/markets";
import { computeTechnicalSummary } from "@/lib/quant/indicators";
import type { MarketId } from "@/lib/types";

export async function POST(request: Request, context: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol: rawParam } = await context.params;
    const body = (await request.json()) as {
      asOfDate?: string;
      runAiLeakageCheck?: boolean;
      model?: string;
      market?: MarketId;
    };

    const resolved = resolveStockSymbol(decodeURIComponent(rawParam), body.market);
    const asOfDate = body.asOfDate?.trim();
    if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      return NextResponse.json({ error: "กรุณาเลือกวันที่ย้อนหลังรูปแบบ YYYY-MM-DD" }, { status: 400 });
    }

    const [chartRes, newsBundle] = await Promise.all([
      fetchYahooChart(resolved.yahooSymbol, "2y", "1d", false, true),
      fetchCompanyNews30D(resolved.symbol, false, resolved.market),
    ]);

    if (!chartRes.ok || chartRes.bars.length < 25) {
      return NextResponse.json(
        { error: "ข้อมูลราคาย้อนหลังไม่เพียงพอสำหรับการทดสอบย้อนเวลา" },
        { status: 404 }
      );
    }

    const cutoffBars = chartRes.bars.filter((b) => b.time <= asOfDate);
    const futureBars = chartRes.bars.filter((b) => b.time > asOfDate);

    if (cutoffBars.length < 20) {
      return NextResponse.json(
        { error: "วันที่เลือกเก่าเกินไป (ต้องมีแท่งเทียนก่อนหน้าอย่างน้อย 20 วันทำการ)" },
        { status: 400 }
      );
    }

    const asOfTechSummary = computeTechnicalSummary(cutoffBars, resolved.currency);
    const priceAtAsOf = cutoffBars[cutoffBars.length - 1].close;
    const actualPriceLater = futureBars.length > 0 ? futureBars[futureBars.length - 1].close : null;
    const actualReturnPct =
      actualPriceLater !== null && priceAtAsOf > 0
        ? ((actualPriceLater - priceAtAsOf) / priceAtAsOf) * 100
        : null;

    const allNews = [...newsBundle.companyNews, ...newsBundle.brokerWebResearch];
    const cutoffNews = allNews.filter((n) => n.pubDate.slice(0, 10) <= asOfDate);
    const excludedFutureNewsCount = allNews.length - cutoffNews.length;

    const result = await runPointInTimeReplayAI({
      symbol: resolved.symbol,
      currency: resolved.currency,
      asOfDate,
      priceAtAsOf,
      actualPriceLater,
      actualReturnPct,
      daysElapsed: futureBars.length,
      asOfTechSummary,
      cutoffNews,
      excludedFutureNewsCount,
      runAiLeakageCheck: body.runAiLeakageCheck !== false,
      modelOverride: body.model,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "รันทดสอบย้อนเวลาไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
