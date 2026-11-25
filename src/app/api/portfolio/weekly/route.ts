import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { fetchMarketConsensusByMarket } from "@/lib/data/marketConsensus";
import { fetchYahooBatchCharts, fetchYahooChart } from "@/lib/data/yahoo";
import { getUniverseByMarket, MARKET_CONFIGS, parseMarketId } from "@/lib/markets";
import { buildWeeklyPortfolio360, type StockUniverseBundle } from "@/lib/quant/portfolio360";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const market = parseMarketId(searchParams.get("market"), "NASDAQ100");
    const mCfg = MARKET_CONFIGS[market];

    const capitalRaw = Number(searchParams.get("capital") || String(mCfg.defaultCapital));
    const baseCapital =
      Number.isFinite(capitalRaw) && capitalRaw >= 1_000 && capitalRaw <= 100_000_000
        ? capitalRaw
        : mCfg.defaultCapital;

    const payload = await getOrFetch(
      `api:portfolio:weekly:v2:${market}:${baseCapital}`,
      15 * 60 * 1000,
      async () => {
        const universeMeta = getUniverseByMarket(market);
        const yahooSymbols = universeMeta.map((u) => u.yahooSymbol);

        const [benchChart, batchCharts, consensusRes] = await Promise.all([
          fetchYahooChart(mCfg.benchmarkYahoo, "1y", "1d", forceRefresh, true),
          fetchYahooBatchCharts(yahooSymbols, "1y", 12, forceRefresh, true),
          fetchMarketConsensusByMarket(market, false),
        ]);

        const iaaMap = new Map(consensusRes.records.map((r) => [r.symbol, r.consensus]));

        const universe: StockUniverseBundle[] = [];
        for (const meta of universeMeta) {
          const chart = batchCharts.get(meta.yahooSymbol);
          if (!chart?.ok || chart.bars.length < 45) continue;
          universe.push({
            symbol: meta.symbol,
            bars: chart.bars,
            iaa: iaaMap.get(meta.symbol) ?? null,
          });
        }

        return buildWeeklyPortfolio360({
          universe,
          setBars: benchChart.bars,
          market,
          baseCapital,
        });
      },
      forceRefresh
    );

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "คำนวณพอร์ตจำลองรายสัปดาห์ 360° ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
