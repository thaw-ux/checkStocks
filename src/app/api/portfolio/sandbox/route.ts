import { NextResponse } from "next/server";
import { fetchYahooBatchCharts, fetchYahooChart } from "@/lib/data/yahoo";
import { MARKET_CONFIGS, parseMarketId, resolveStockSymbol } from "@/lib/markets";
import { runSandboxBacktest } from "@/lib/quant/portfolio360";
import type { MarketId } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      holdings?: { symbol: string; weightPct: number }[];
      lookbackDays?: number;
      initialCapital?: number;
      market?: MarketId;
    };

    const market = parseMarketId(body.market, "NASDAQ100");
    const mCfg = MARKET_CONFIGS[market];

    const rawHoldings = (body.holdings ?? [])
      .map((h) => ({
        resolved: resolveStockSymbol(h.symbol, market),
        weightPct: Number(h.weightPct) || 0,
      }))
      .filter((h) => h.resolved.symbol && h.weightPct > 0)
      .slice(0, 10);

    if (rawHoldings.length === 0) {
      return NextResponse.json({ error: "กรุณาระบุหุ้นอย่างน้อย 1 ตัวพร้อมน้ำหนัก (%)" }, { status: 400 });
    }

    const lookbackDays = Math.min(240, Math.max(15, Number(body.lookbackDays) || 60));
    const initialCapital = Math.min(
      100_000_000,
      Math.max(1_000, Number(body.initialCapital) || mCfg.defaultCapital)
    );

    const [benchChart, batch] = await Promise.all([
      fetchYahooChart(mCfg.benchmarkYahoo, "1y", "1d", false, true),
      fetchYahooBatchCharts(
        rawHoldings.map((h) => h.resolved.yahooSymbol),
        "1y",
        8,
        false,
        true
      ),
    ]);

    const holdingsWithBars = rawHoldings
      .map((h) => ({
        symbol: h.resolved.symbol,
        weightPct: h.weightPct,
        bars: batch.get(h.resolved.yahooSymbol)?.bars ?? [],
      }))
      .filter((h) => h.bars.length > 5);

    if (holdingsWithBars.length === 0) {
      return NextResponse.json({ error: "ไม่พบข้อมูลราคาย้อนหลังของหุ้นที่ระบุ" }, { status: 404 });
    }

    const result = runSandboxBacktest({
      holdings: holdingsWithBars,
      setBars: benchChart.bars,
      lookbackDays,
      initialCapital,
    });

    return NextResponse.json({
      result,
      benchmarkLabel: mCfg.benchmarkLabel,
      validSymbols: holdingsWithBars.map((h) => h.symbol),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "รัน Sandbox Backtest ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
