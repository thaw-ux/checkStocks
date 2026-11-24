import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { fetchMarketConsensusAll } from "@/lib/data/marketConsensus";
import { fetchYahooBatchCharts, fetchYahooChart } from "@/lib/data/yahoo";
import { buildWeeklyPortfolio360, type StockUniverseBundle } from "@/lib/quant/portfolio360";
import { SET50_SYMBOLS } from "@/lib/set50";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const capitalRaw = Number(searchParams.get("capital") || "100000");
    const baseCapital =
      Number.isFinite(capitalRaw) && capitalRaw >= 10_000 && capitalRaw <= 100_000_000
        ? capitalRaw
        : 100_000;

    const payload = await getOrFetch(
      `api:portfolio:weekly:${baseCapital}`,
      15 * 60 * 1000,
      async () => {
        const [setChart, batchCharts, consensusRes] = await Promise.all([
          fetchYahooChart("^SET.BK", "1y", "1d", forceRefresh),
          fetchYahooBatchCharts(SET50_SYMBOLS, "1y", 12, forceRefresh),
          fetchMarketConsensusAll(false),
        ]);

        const iaaMap = new Map(consensusRes.records.map((r) => [r.symbol, r.consensus]));

        const universe: StockUniverseBundle[] = [];
        for (const sym of SET50_SYMBOLS) {
          const chart = batchCharts.get(sym);
          if (!chart?.ok || chart.bars.length < 45) continue;
          universe.push({
            symbol: sym,
            bars: chart.bars,
            iaa: iaaMap.get(sym) ?? null,
          });
        }

        return buildWeeklyPortfolio360({
          universe,
          setBars: setChart.bars,
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
